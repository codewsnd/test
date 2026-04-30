package com.zhou4h.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhou4h.backend.dto.ConversationSaveRequest;
import com.zhou4h.backend.entity.ConversationHistory;
import com.zhou4h.backend.exception.CustomException;
import com.zhou4h.backend.repository.ConversationHistoryRepository;
import com.zhou4h.backend.vo.ConversationHistoryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
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

    private final ConversationHistoryRepository repository;
    private final ObjectMapper objectMapper;

    public Page<ConversationHistoryResponse> pageConversations(String staffId, String search, Pageable pageable) {
        try {
            String searchTerm = (search == null) ? "" : search.trim();
            return repository.findByStaffIdAndSearch(staffId, searchTerm, pageable)
                    .map(conversation -> ConversationHistoryResponse.from(conversation, null));
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to page conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to page conversations");
        }
    }

    public ConversationHistoryResponse getConversationDetail(String id, String staffId) {
        try {
            ConversationHistory conversation = repository.findById(id)
                    .filter(item -> staffId.equals(item.getStaffId()))
                    .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found"));
            return ConversationHistoryResponse.from(conversation, deserializeConversationState(conversation.getConversationState()));
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
            ConversationHistory conversation = repository.findById(request.getId())
                    .orElseGet(() -> {
                        ConversationHistory newConversation = new ConversationHistory();
                        newConversation.setId(request.getId());
                        newConversation.setCreatedAt(request.getCreatedAt());
                        return newConversation;
                    });

            applyRequest(request, conversation);
            ConversationHistory saved = repository.save(conversation);
            return ConversationHistoryResponse.from(saved, deserializeConversationState(saved.getConversationState()));
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
            ConversationHistory conversation = repository.findById(id)
                    .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND.value(), "Conversation not found"));
            conversation.setTitle(newTitle);
            ConversationHistory saved = repository.save(conversation);
            return ConversationHistoryResponse.from(saved, deserializeConversationState(saved.getConversationState()));
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
            repository.deleteAllByIdInBatch(conversationIds);
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
            Instant now = Instant.now();
            List<ConversationHistory> conversations = repository.findAllById(conversationIds);
            conversations.forEach(conversation -> {
                conversation.setIsPinned(true);
                conversation.setPinnedAt(now);
            });
            repository.saveAll(conversations);
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
            List<ConversationHistory> conversations = repository.findAllById(conversationIds);
            conversations.forEach(conversation -> {
                conversation.setIsPinned(false);
                conversation.setPinnedAt(null);
            });
            repository.saveAll(conversations);
        } catch (RuntimeException e) {
            log.error("Failed to unpin conversations", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to unpin conversations");
        }
    }

    private void applyRequest(ConversationSaveRequest request, ConversationHistory conversation) {
        conversation.setTitle(request.getTitle());
        conversation.setStaffId(request.getStaffId());
        conversation.setConversationState(serializeConversationState(request.getConversationState()));
        conversation.setIsPinned(request.getIsPinned() == null ? false : request.getIsPinned());
        conversation.setUpdatedAt(request.getUpdatedAt() == null ? Instant.now() : request.getUpdatedAt());
        conversation.setPinnedAt(request.getPinnedAt());
        conversation.setTitleGenerating(request.getTitleGenerating());
        conversation.setIsDeleted(false);
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
