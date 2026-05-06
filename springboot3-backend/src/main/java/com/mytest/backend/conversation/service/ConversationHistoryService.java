package com.mytest.backend.conversation.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.mytest.backend.conversation.dto.ConversationCreateRequest;
import com.mytest.backend.conversation.dto.ConversationStatePatchRequest;
import com.mytest.backend.conversation.entity.ConversationHistory;
import com.mytest.backend.conversation.mapper.ConversationHistoryMapper;
import com.mytest.backend.conversation.vo.ConversationHistoryResponse;
import com.mytest.backend.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;
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

    public org.springframework.data.domain.Page<ConversationHistoryResponse> pageConversations(
            String staffId,
            String search,
            Pageable pageable
    ) {
        try {
            Page<ConversationHistory> result = conversationHistoryMapper.selectPageByStaffIdAndSearch(
                    Page.of(pageable.getPageNumber() + 1L, pageable.getPageSize(), true),
                    staffId,
                    StringUtils.hasText(search) ? search.trim() : ""
            );
            List<ConversationHistoryResponse> content = result.getRecords().stream()
                    .map(ConversationHistoryResponse::from)
                    .toList();
            log.info(
                    "[ConversationHistory] Page conversations, staffId: {}, search: {}, page: {}, size: {}, total: {}",
                    staffId,
                    StringUtils.hasText(search) ? search.trim() : "",
                    pageable.getPageNumber(),
                    pageable.getPageSize(),
                    result.getTotal()
            );
            return PageableExecutionUtils.getPage(content, pageable, result::getTotal);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to page conversations, staffId: {}", staffId, e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to page conversations, staffId: {}", staffId, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to page conversations");
        }
    }

    public ConversationHistoryResponse getConversationDetail(String id, String staffId) {
        try {
            ConversationHistory conversation = requireAccessibleConversation(id, staffId);
            log.info("[ConversationHistory] Get conversation detail, staffId: {}, id: {}", staffId, id);
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to get conversation detail, staffId: {}, id: {}", staffId, id, e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to get conversation detail, staffId: {}, id: {}", staffId, id, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get conversation detail");
        }
    }

    @Transactional
    public ConversationHistoryResponse createConversation(String staffId, ConversationCreateRequest request) {
        try {
            ConversationHistory conversation = new ConversationHistory();
            BeanUtils.copyProperties(request, conversation);
            conversation.setId(request.getId());
            conversation.setStaffId(staffId);
            conversation.setIsDeleted(Boolean.FALSE);
            conversationHistoryMapper.insert(conversation);
            log.info("[ConversationHistory] Create conversation, staffId: {}, id: {}", staffId, conversation.getId());
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to create conversation, staffId: {}, id: {}", staffId, request.getId(), e);
            throw e;
        } catch (DuplicateKeyException e) {
            log.error("[ConversationHistory:Failed] Conversation already exists, staffId: {}, id: {}", staffId, request.getId(), e);
            throw new CustomException(HttpStatus.CONFLICT.value(), "Conversation already exists");
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to create conversation, staffId: {}, id: {}", staffId, request.getId(), e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to create conversation");
        }
    }

    @Transactional
    public ConversationHistoryResponse updateConversationState(
            String id,
            String staffId,
            ConversationStatePatchRequest request
    ) {
        try {
            conversationHistoryMapper.updateConversationState(
                    id,
                    staffId,
                    request.getConversationState(),
                    request.getUpdatedAt()
            );
            ConversationHistory conversation = requireAccessibleConversation(id, staffId);
            log.info("[ConversationHistory] Update conversation state, staffId: {}, id: {}", staffId, id);
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to update conversation state, staffId: {}, id: {}", staffId, id, e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to update conversation state, staffId: {}, id: {}", staffId, id, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to patch conversation state");
        }
    }

    @Transactional
    public ConversationHistoryResponse renameConversation(String id, String staffId, String newTitle) {
        try {
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistory>lambdaUpdate()
                    .eq(ConversationHistory::getId, id)
                    .eq(ConversationHistory::getStaffId, staffId)
                    .set(ConversationHistory::getTitle, newTitle.trim())
                    .set(ConversationHistory::getTitleGenerating, Boolean.FALSE)
                    .set(ConversationHistory::getUpdatedAt, Instant.now()));
            ConversationHistory conversation = requireAccessibleConversation(id, staffId);
            log.info("[ConversationHistory] Rename conversation, staffId: {}, id: {}", staffId, id);
            return ConversationHistoryResponse.from(conversation);
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to rename conversation, staffId: {}, id: {}", staffId, id, e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to rename conversation, staffId: {}, id: {}", staffId, id, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to rename conversation");
        }
    }

    @Transactional
    public void batchDeleteConversations(List<String> conversationIds, String staffId) {
        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                log.info("[ConversationHistory] Skip batch delete conversations, staffId: {}, count: 0", staffId);
                return;
            }
            conversationHistoryMapper.delete(Wrappers.<ConversationHistory>lambdaQuery()
                    .eq(ConversationHistory::getStaffId, staffId)
                    .in(ConversationHistory::getId, ids));
            log.info("[ConversationHistory] Batch delete conversations, staffId: {}, count: {}", staffId, ids.size());
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to delete conversations, staffId: {}", staffId, e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to delete conversations, staffId: {}", staffId, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to delete conversations");
        }
    }

    @Transactional
    public void batchPinConversations(List<String> conversationIds, String staffId) {
        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                log.info("[ConversationHistory] Skip batch pin conversations, staffId: {}, count: 0", staffId);
                return;
            }
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistory>lambdaUpdate()
                    .eq(ConversationHistory::getStaffId, staffId)
                    .in(ConversationHistory::getId, ids)
                    .set(ConversationHistory::getIsPinned, Boolean.TRUE)
                    .set(ConversationHistory::getPinnedAt, Instant.now()));
            log.info("[ConversationHistory] Batch pin conversations, staffId: {}, count: {}", staffId, ids.size());
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to pin conversations, staffId: {}", staffId, e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to pin conversations, staffId: {}", staffId, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to pin conversations");
        }
    }

    @Transactional
    public void batchUnpinConversations(List<String> conversationIds, String staffId) {
        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                log.info("[ConversationHistory] Skip batch unpin conversations, staffId: {}, count: 0", staffId);
                return;
            }
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistory>lambdaUpdate()
                    .eq(ConversationHistory::getStaffId, staffId)
                    .in(ConversationHistory::getId, ids)
                    .set(ConversationHistory::getIsPinned, Boolean.FALSE)
                    .set(ConversationHistory::getPinnedAt, null));
            log.info("[ConversationHistory] Batch unpin conversations, staffId: {}, count: {}", staffId, ids.size());
        } catch (CustomException e) {
            log.error("[ConversationHistory:Failed] Failed to unpin conversations, staffId: {}", staffId, e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[ConversationHistory:Failed] Failed to unpin conversations, staffId: {}", staffId, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to unpin conversations");
        }
    }

    private ConversationHistory requireAccessibleConversation(String id, String staffId) {
        ConversationHistory conversation = conversationHistoryMapper.selectOne(Wrappers.<ConversationHistory>lambdaQuery()
                .eq(ConversationHistory::getStaffId, staffId)
                .eq(ConversationHistory::getId, id));
        if (conversation == null) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
        return conversation;
    }


    private List<String> normalizeIds(List<String> conversationIds) {
        return conversationIds.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
    }

}
