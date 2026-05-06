package com.mytest.backend.conversation.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mytest.backend.conversation.dto.ConversationCreateRequest;
import com.mytest.backend.conversation.dto.ConversationStatePatchRequest;
import com.mytest.backend.conversation.entity.ConversationHistory;
import com.mytest.backend.conversation.mapper.ConversationHistoryMapper;
import com.mytest.backend.conversation.vo.ConversationHistoryResponse;
import com.mytest.backend.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
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
            Page<ConversationHistory> result = conversationHistoryMapper.selectPageByStaffIdAndSearch(
                    Page.of(pageable.getPageNumber() + 1L, pageable.getPageSize(), true),
                    staffId,
                    trimOrEmpty(search)
            );
            return PageableExecutionUtils.getPage(toSummaryResponses(result), pageable, result::getTotal);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to page conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to page conversations");
        }
    }

    public ConversationHistoryResponse getConversationDetail(String id, String staffId) {
        try {
            return toDetailResponse(requireAccessibleConversation(id, staffId));
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to get conversation detail", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get conversation detail");
        }
    }

    @Transactional
    public ConversationHistoryResponse createConversation(String staffId, ConversationCreateRequest request) {
        try {
            String conversationId = request.getId().trim();
            if (conversationHistoryMapper.countById(conversationId) > 0) {
                throw new CustomException(HttpStatus.CONFLICT.value(), "Conversation already exists");
            }

            ConversationHistory conversation = new ConversationHistory();
            BeanUtils.copyProperties(request, conversation);
            conversation.setId(conversationId);
            conversation.setStaffId(staffId);
            conversation.setConversationState(serializeConversationState(request.getConversationState()));
            conversation.setIsDeleted(Boolean.FALSE);
            conversationHistoryMapper.insert(conversation);
            return toDetailResponse(conversation);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to create conversation", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to create conversation");
        }
    }

    @Transactional
    public ConversationHistoryResponse patchConversationState(
            String id,
            String staffId,
            ConversationStatePatchRequest request
    ) {
        try {
            String conversationId = id.trim();
            int updatedRows = conversationHistoryMapper.patchConversationState(
                    conversationId,
                    staffId,
                    serializeConversationStatePatch(request.getConversationState()),
                    request.getUpdatedAt()
            );

            ensureUpdated(updatedRows);
            return toDetailResponse(requireAccessibleConversation(conversationId, staffId));
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to patch conversation state", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to patch conversation state");
        }
    }

    @Transactional
    public ConversationHistoryResponse renameConversation(String id, String staffId, String newTitle) {
        try {
            String conversationId = id.trim();
            int updatedRows = conversationHistoryMapper.renameConversation(
                    conversationId,
                    staffId,
                    newTitle.trim(),
                    Instant.now()
            );

            ensureUpdated(updatedRows);
            return toDetailResponse(requireAccessibleConversation(conversationId, staffId));
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to rename conversation", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to rename conversation");
        }
    }

    @Transactional
    public void batchDeleteConversations(List<String> conversationIds, String staffId) {
        if (CollectionUtils.isEmpty(conversationIds)) {
            return;
        }

        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                return;
            }

            requireAccessibleConversations(ids, staffId);
            int updatedRows = conversationHistoryMapper.softDeleteByStaffIdAndIds(staffId, ids);
            ensureAllRowsUpdated(updatedRows, ids.size());
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to delete conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to delete conversations");
        }
    }

    @Transactional
    public void batchPinConversations(List<String> conversationIds, String staffId) {
        if (CollectionUtils.isEmpty(conversationIds)) {
            return;
        }

        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                return;
            }

            requireAccessibleConversations(ids, staffId);
            int updatedRows = conversationHistoryMapper.pinByStaffIdAndIds(staffId, ids, Instant.now());
            ensureAllRowsUpdated(updatedRows, ids.size());
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to pin conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to pin conversations");
        }
    }

    @Transactional
    public void batchUnpinConversations(List<String> conversationIds, String staffId) {
        if (CollectionUtils.isEmpty(conversationIds)) {
            return;
        }

        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                return;
            }

            requireAccessibleConversations(ids, staffId);
            int updatedRows = conversationHistoryMapper.unpinByStaffIdAndIds(staffId, ids);
            ensureAllRowsUpdated(updatedRows, ids.size());
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to unpin conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to unpin conversations");
        }
    }

    private List<ConversationHistoryResponse> toSummaryResponses(Page<ConversationHistory> page) {
        return page.getRecords().stream()
                .map(item -> ConversationHistoryResponse.from(item, null))
                .toList();
    }

    private ConversationHistoryResponse toDetailResponse(ConversationHistory conversation) {
        return ConversationHistoryResponse.from(
                conversation,
                deserializeConversationState(conversation.getConversationState())
        );
    }

    private ConversationHistory requireAccessibleConversation(String id, String staffId) {
        ConversationHistory conversation = conversationHistoryMapper.selectAccessibleById(id.trim(), staffId);
        if (conversation == null) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
        return conversation;
    }

    private void requireAccessibleConversations(List<String> ids, String staffId) {
        int accessibleCount = conversationHistoryMapper.countAccessibleByIds(staffId, ids);
        if (accessibleCount != ids.size()) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
    }

    private void ensureUpdated(int updatedRows) {
        if (updatedRows == 0) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
    }

    private void ensureAllRowsUpdated(int updatedRows, int expectedRows) {
        if (updatedRows != expectedRows) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
    }

    private String serializeConversationStatePatch(Object conversationStatePatch) {
        JsonNode patchNode = objectMapper.valueToTree(conversationStatePatch);
        if (!(patchNode instanceof ObjectNode patchObject)) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Invalid conversation state patch");
        }

        JsonNode turnsNode = patchObject.get("turns");
        if (turnsNode != null && !turnsNode.isNull()) {
            validateTurnsPatch(turnsNode);
        }

        try {
            return objectMapper.writeValueAsString(patchObject);
        } catch (JsonProcessingException e) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Invalid conversation state patch");
        }
    }

    private void validateTurnsPatch(JsonNode turnsNode) {
        if (!turnsNode.isArray()) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Invalid conversation turns patch");
        }

        for (JsonNode turnNode : turnsNode) {
            if (!turnNode.isObject() || !StringUtils.hasText(turnNode.path("id").asText(null))) {
                throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Conversation turn id is required");
            }
        }
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

    private List<String> normalizeIds(List<String> conversationIds) {
        return conversationIds.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
    }

    private String trimOrEmpty(String text) {
        return StringUtils.hasText(text) ? text.trim() : "";
    }
}
