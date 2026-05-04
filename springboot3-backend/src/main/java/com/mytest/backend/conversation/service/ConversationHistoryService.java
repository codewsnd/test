package com.mytest.backend.conversation.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.mytest.backend.conversation.dto.ConversationSaveRequest;
import com.mytest.backend.conversation.dto.ConversationStatePatchRequest;
import com.mytest.backend.conversation.entity.ConversationHistoryDO;
import com.mytest.backend.conversation.mapper.ConversationHistoryMapper;
import com.mytest.backend.conversation.vo.ConversationHistoryResponse;
import com.mytest.backend.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.data.support.PageableExecutionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

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
            String searchTerm = StringUtils.hasText(search) ? search.trim() : "";
            Page<ConversationHistoryDO> page = Page.of(
                    pageable.getPageNumber() + 1L,
                    pageable.getPageSize(),
                    false
            );
            Page<ConversationHistoryDO> result =
                    conversationHistoryMapper.selectPageByStaffIdAndSearch(page, staffId, searchTerm);
            List<ConversationHistoryResponse> content = result.getRecords().stream()
                    .map(item -> ConversationHistoryResponse.from(item, null))
                    .toList();
            return PageableExecutionUtils.getPage(content, pageable, result::getTotal);
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
        try {
            Instant now = Instant.now();
            String conversationId = request.getId().trim();
            ConversationHistoryDO conversation = conversationHistoryMapper.selectById(conversationId);
            boolean isNew = conversation == null;
            if (isNew) {
                conversation = new ConversationHistoryDO();
                conversation.setId(conversationId);
                conversation.setCreatedAt(Objects.requireNonNullElse(request.getCreatedAt(), now));
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
    public ConversationHistoryResponse patchConversationState(String id, ConversationStatePatchRequest request) {
        try {
            Instant now = Instant.now();
            ConversationHistoryDO conversation = requireAccessibleConversation(id, request.getStaffId());
            ObjectNode mergedConversationState = mergeConversationState(
                    conversation.getConversationState(),
                    request.getConversationState()
            );
            conversation.setConversationState(serializeConversationState(mergedConversationState));
            conversation.setUpdatedAt(Objects.requireNonNullElse(request.getUpdatedAt(), now));
            conversationHistoryMapper.updateById(conversation);
            return ConversationHistoryResponse.from(
                    conversation,
                    objectMapper.convertValue(mergedConversationState, Object.class)
            );
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to patch conversation state", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to patch conversation state");
        }
    }

    @Transactional
    public ConversationHistoryResponse renameConversation(String id, String newTitle) {
        try {
            ConversationHistoryDO conversation = requireExistingConversation(id);
            conversation.setTitle(newTitle.trim());
            conversation.setTitleGenerating(Boolean.FALSE);
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
        if (CollectionUtils.isEmpty(conversationIds)) {
            return;
        }

        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                return;
            }
            conversationHistoryMapper.delete(Wrappers.<ConversationHistoryDO>lambdaQuery()
                    .in(ConversationHistoryDO::getId, ids));
        } catch (RuntimeException e) {
            log.error("Failed to delete conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to delete conversations");
        }
    }

    @Transactional
    public void batchPinConversations(List<String> conversationIds) {
        if (CollectionUtils.isEmpty(conversationIds)) {
            return;
        }

        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                return;
            }
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistoryDO>lambdaUpdate()
                    .in(ConversationHistoryDO::getId, ids)
                    .set(ConversationHistoryDO::getIsPinned, true)
                    .set(ConversationHistoryDO::getPinnedAt, Instant.now()));
        } catch (RuntimeException e) {
            log.error("Failed to pin conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to pin conversations");
        }
    }

    @Transactional
    public void batchUnpinConversations(List<String> conversationIds) {
        if (CollectionUtils.isEmpty(conversationIds)) {
            return;
        }

        try {
            List<String> ids = normalizeIds(conversationIds);
            if (ids.isEmpty()) {
                return;
            }
            conversationHistoryMapper.update(null, Wrappers.<ConversationHistoryDO>lambdaUpdate()
                    .in(ConversationHistoryDO::getId, ids)
                    .set(ConversationHistoryDO::getIsPinned, false)
                    .set(ConversationHistoryDO::getPinnedAt, null));
        } catch (RuntimeException e) {
            log.error("Failed to unpin conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to unpin conversations");
        }
    }

    private ConversationHistoryDO requireAccessibleConversation(String id, String staffId) {
        ConversationHistoryDO conversation = requireExistingConversation(id);
        if (!Objects.equals(staffId, conversation.getStaffId())) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
        return conversation;
    }

    private ConversationHistoryDO requireExistingConversation(String id) {
        ConversationHistoryDO conversation = conversationHistoryMapper.selectById(id.trim());
        if (conversation == null || Boolean.TRUE.equals(conversation.getIsDeleted())) {
            throw new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found");
        }
        return conversation;
    }

    private void applyRequest(ConversationSaveRequest request, ConversationHistoryDO conversation, Instant now) {
        conversation.setTitle(request.getTitle());
        conversation.setStaffId(request.getStaffId());
        conversation.setConversationState(serializeConversationState(request.getConversationState()));
        conversation.setIsPinned(Boolean.TRUE.equals(request.getIsPinned()));
        conversation.setUpdatedAt(Objects.requireNonNullElse(request.getUpdatedAt(), now));
        conversation.setPinnedAt(request.getPinnedAt());
        conversation.setTitleGenerating(request.getTitleGenerating());
        conversation.setIsDeleted(Boolean.FALSE);
    }

    private ObjectNode mergeConversationState(String currentConversationState, Object conversationStatePatch) {
        ObjectNode mergedState = deserializeConversationStateNode(currentConversationState);
        JsonNode patchNode = objectMapper.valueToTree(conversationStatePatch);
        if (!(patchNode instanceof ObjectNode patchObject)) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Invalid conversation state patch");
        }

        patchObject.fields().forEachRemaining(entry -> {
            if ("turns".equals(entry.getKey())) {
                mergeTurns(mergedState, entry.getValue());
                return;
            }
            mergedState.set(entry.getKey(), entry.getValue().deepCopy());
        });
        return mergedState;
    }

    private void mergeTurns(ObjectNode mergedState, JsonNode turnsPatchNode) {
        if (turnsPatchNode == null || turnsPatchNode.isNull()) {
            mergedState.set("turns", objectMapper.createArrayNode());
            return;
        }
        if (!(turnsPatchNode instanceof ArrayNode turnsPatchArray)) {
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Invalid conversation turns patch");
        }

        ArrayNode mergedTurns = objectMapper.createArrayNode();
        JsonNode existingTurnsNode = mergedState.get("turns");
        if (existingTurnsNode instanceof ArrayNode existingTurnsArray) {
            existingTurnsArray.forEach(item -> mergedTurns.add(item.deepCopy()));
        }

        Map<String, Integer> turnIndexes = new LinkedHashMap<>();
        for (int index = 0; index < mergedTurns.size(); index++) {
            JsonNode turnNode = mergedTurns.get(index);
            String turnId = extractTurnId(turnNode);
            if (StringUtils.hasText(turnId)) {
                turnIndexes.put(turnId, index);
            }
        }

        for (JsonNode turnPatchNode : turnsPatchArray) {
            String turnId = extractTurnId(turnPatchNode);
            if (!StringUtils.hasText(turnId)) {
                throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Conversation turn id is required");
            }

            JsonNode copiedTurn = turnPatchNode.deepCopy();
            Integer existingIndex = turnIndexes.get(turnId);
            if (existingIndex == null) {
                turnIndexes.put(turnId, mergedTurns.size());
                mergedTurns.add(copiedTurn);
                continue;
            }
            mergedTurns.set(existingIndex, copiedTurn);
        }

        sortTurnsByTimestamp(mergedTurns);
        mergedState.set("turns", mergedTurns);
    }

    private String extractTurnId(JsonNode turnNode) {
        if (turnNode == null || !turnNode.isObject()) {
            return null;
        }
        JsonNode idNode = turnNode.get("id");
        return idNode != null ? idNode.asText(null) : null;
    }

    private void sortTurnsByTimestamp(ArrayNode turns) {
        List<JsonNode> sortedTurns = new ArrayList<>();
        turns.forEach(item -> sortedTurns.add(item.deepCopy()));
        sortedTurns.sort(Comparator.comparing(
                this::extractTurnTimestamp,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));

        turns.removeAll();
        sortedTurns.forEach(turns::add);
    }

    private Instant extractTurnTimestamp(JsonNode turnNode) {
        if (turnNode == null || !turnNode.isObject()) {
            return null;
        }

        JsonNode timestampNode = turnNode.get("timestamp");
        if (timestampNode == null || timestampNode.isNull()) {
            return null;
        }
        if (timestampNode.isNumber()) {
            return Instant.ofEpochMilli(timestampNode.asLong());
        }

        String timestamp = timestampNode.asText(null);
        if (!StringUtils.hasText(timestamp)) {
            return null;
        }

        try {
            return Instant.parse(timestamp.trim());
        } catch (DateTimeParseException e) {
            return null;
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

    private ObjectNode deserializeConversationStateNode(String conversationState) {
        if (!StringUtils.hasText(conversationState)) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode conversationStateNode = objectMapper.readTree(conversationState);
            if (conversationStateNode == null || conversationStateNode.isNull()) {
                return objectMapper.createObjectNode();
            }
            if (conversationStateNode instanceof ObjectNode objectNode) {
                return objectNode.deepCopy();
            }
            throw new CustomException(HttpStatus.BAD_REQUEST.value(), "Invalid conversation state");
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
                .toList();
    }
}
