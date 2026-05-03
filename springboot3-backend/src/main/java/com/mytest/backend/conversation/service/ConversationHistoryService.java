package com.mytest.backend.conversation.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mytest.backend.conversation.dto.ConversationSaveRequest;
import com.mytest.backend.conversation.entity.ConversationHistoryDO;
import com.mytest.backend.conversation.mapper.ConversationHistoryMapper;
import com.mytest.backend.conversation.vo.ConversationHistoryResponse;
import com.mytest.backend.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHistoryService {

    private final ConversationHistoryMapper conversationHistoryMapper;
    private final ObjectMapper objectMapper;

    public org.springframework.data.domain.Page<ConversationHistoryResponse> pageConversations(
            String staffId,
            String search,
            Pageable pageable
    ) {
        try {
            String searchTerm = search == null ? "" : search.trim();
            Page<ConversationHistoryDO> page = new Page<>(pageable.getPageNumber() + 1L, pageable.getPageSize());
            Page<ConversationHistoryDO> result = conversationHistoryMapper.selectPageByStaffIdAndSearch(page, staffId, searchTerm);
            List<ConversationHistoryResponse> content = result.getRecords().stream()
                    .map(item -> ConversationHistoryResponse.from(item, null))
                    .toList();
            return new PageImpl<>(content, pageable, result.getTotal());
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to page conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to page conversations");
        }
    }

    public ConversationHistoryResponse getConversationDetail(String id, String staffId) {
        try {
            ConversationHistoryDO conversation = requireAccessibleConversation(id, staffId);
            return ConversationHistoryResponse.from(
                    conversation,
                    deserializeConversationState(conversation.getConversationState())
            );
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to get conversation detail", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get conversation detail");
        }
    }

    @Transactional
    public ConversationHistoryResponse saveConversation(ConversationSaveRequest request) {
        if (!StringUtils.hasText(request.getId())) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Conversation id is required");
        }

        try {
            Instant now = Instant.now();
            ConversationHistoryDO conversation = conversationHistoryMapper.selectById(request.getId());
            boolean isNew = conversation == null;
            if (isNew) {
                conversation = new ConversationHistoryDO();
                conversation.setId(request.getId());
                conversation.setCreatedAt(request.getCreatedAt() == null ? now : request.getCreatedAt());
            }

            applyRequest(request, conversation, now);
            if (isNew) {
                conversationHistoryMapper.insert(conversation);
            } else {
                conversationHistoryMapper.updateById(conversation);
            }
            return ConversationHistoryResponse.from(
                    conversation,
                    deserializeConversationState(conversation.getConversationState())
            );
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to save conversation", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to save conversation");
        }
    }

    @Transactional
    public ConversationHistoryResponse renameConversation(String id, String newTitle) {
        try {
            ConversationHistoryDO conversation = requireExistingConversation(id);
            conversation.setTitle(newTitle);
            conversationHistoryMapper.updateById(conversation);
            return ConversationHistoryResponse.from(
                    conversation,
                    deserializeConversationState(conversation.getConversationState())
            );
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to rename conversation", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to rename conversation");
        }
    }

    @Transactional
    public void batchDeleteConversations(List<String> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) {
            return;
        }

        try {
            conversationHistoryMapper.delete(Wrappers.<ConversationHistoryDO>lambdaQuery()
                    .in(ConversationHistoryDO::getId, conversationIds));
        } catch (RuntimeException e) {
            log.error("Failed to delete conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to delete conversations");
        }
    }

    @Transactional
    public void batchPinConversations(List<String> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) {
            return;
        }

        try {
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistoryDO>lambdaUpdate()
                    .in(ConversationHistoryDO::getId, conversationIds)
                    .set(ConversationHistoryDO::getIsPinned, true)
                    .set(ConversationHistoryDO::getPinnedAt, Instant.now()));
        } catch (RuntimeException e) {
            log.error("Failed to pin conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to pin conversations");
        }
    }

    @Transactional
    public void batchUnpinConversations(List<String> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) {
            return;
        }

        try {
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistoryDO>lambdaUpdate()
                    .in(ConversationHistoryDO::getId, conversationIds)
                    .set(ConversationHistoryDO::getIsPinned, false)
                    .set(ConversationHistoryDO::getPinnedAt, null));
        } catch (RuntimeException e) {
            log.error("Failed to unpin conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to unpin conversations");
        }
    }

    private ConversationHistoryDO requireAccessibleConversation(String id, String staffId) {
        ConversationHistoryDO conversation = requireExistingConversation(id);
        if (!staffId.equals(conversation.getStaffId())) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
        return conversation;
    }

    private ConversationHistoryDO requireExistingConversation(String id) {
        ConversationHistoryDO conversation = conversationHistoryMapper.selectById(id);
        if (conversation == null || Boolean.TRUE.equals(conversation.getIsDeleted())) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
        return conversation;
    }

    private void applyRequest(ConversationSaveRequest request, ConversationHistoryDO conversation, Instant now) {
        conversation.setTitle(request.getTitle());
        conversation.setStaffId(request.getStaffId());
        conversation.setConversationState(serializeConversationState(request.getConversationState()));
        conversation.setIsPinned(request.getIsPinned() == null ? Boolean.FALSE : request.getIsPinned());
        conversation.setUpdatedAt(request.getUpdatedAt() == null ? now : request.getUpdatedAt());
        conversation.setPinnedAt(request.getPinnedAt());
        conversation.setTitleGenerating(request.getTitleGenerating());
        conversation.setIsDeleted(Boolean.FALSE);
    }

    private String serializeConversationState(Object conversationState) {
        if (conversationState == null) {
            return null;
        }
        if (conversationState instanceof String text) {
            return text;
        }
        try {
            return objectMapper.writeValueAsString(conversationState);
        } catch (JsonProcessingException e) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Invalid conversation state");
        }
    }

    private Object deserializeConversationState(String conversationState) {
        if (!StringUtils.hasText(conversationState)) {
            return null;
        }
        try {
            return objectMapper.readValue(conversationState, Object.class);
        } catch (JsonProcessingException e) {
            return conversationState;
        }
    }
}
