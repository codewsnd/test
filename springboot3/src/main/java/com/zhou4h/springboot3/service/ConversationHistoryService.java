package com.zhou4h.springboot3.service;

import com.zhou4h.springboot3.dto.ConversationSaveRequest;
import com.zhou4h.springboot3.entity.ConversationHistory;
import com.zhou4h.springboot3.exception.CustomBaseException;
import com.zhou4h.springboot3.repository.ConversationHistoryRepository;
import com.zhou4h.springboot3.vo.ConversationHistoryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHistoryService {

    private final ConversationHistoryRepository repository;
    private final R2dbcEntityTemplate r2dbcEntityTemplate;

    public Mono<Page<ConversationHistoryResponse>> pageConversations(String staffId, String search, Pageable pageable) {
        String searchTerm = (search == null) ? "" : search.trim();

        return repository.countByStaffIdAndSearch(staffId, searchTerm)
                .flatMap(total ->
                        repository.findByStaffIdAndSearch(staffId, searchTerm, pageable)
                                .map(conversation -> ConversationHistoryResponse.builder()
                                        .id(conversation.getId())
                                        .title(conversation.getTitle())
                                        .isPinned(conversation.getIsPinned())
                                        .createdAt(conversation.getCreatedAt())
                                        .updatedAt(conversation.getUpdatedAt())
                                        .pinnedAt(conversation.getPinnedAt())
                                        .staffId(conversation.getStaffId())
                                        .titleGenerating(conversation.getTitleGenerating())
                                        .build())
                                .collectList()
                                .<Page<ConversationHistoryResponse>>map(content -> new PageImpl<>(content, pageable, total))
                )
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> {
                            log.error("Failed to page conversations", error);
                            return new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to page conversations");
                        }
                );
    }

    public Mono<ConversationHistoryResponse> getConversationDetail(String id, String staffId) {
        return repository.findById(id)
                .filter(conversation -> staffId.equals(conversation.getStaffId()))
                .map(ConversationHistoryResponse::from)
                .switchIfEmpty(Mono.error(new CustomBaseException(
                        HttpStatus.NOT_FOUND.value(),
                        "Conversation not found"
                )))
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> {
                            log.error("Failed to get conversation detail", error);
                            return new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get conversation detail");
                        }
                );
    }

    @Transactional
    public Mono<ConversationHistoryResponse> saveConversation(ConversationSaveRequest request) {
        return repository.findById(request.getId())
                .flatMap(existing -> {
                    BeanUtils.copyProperties(request, existing, "id", "createdAt");
                    return repository.save(existing);
                })
                .switchIfEmpty(
                        Mono.fromCallable(() -> {
                            ConversationHistory conversation = new ConversationHistory();
                            BeanUtils.copyProperties(request, conversation);
                            return conversation;
                        }).flatMap(r2dbcEntityTemplate::insert)
                )
                .map(ConversationHistoryResponse::from)
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> {
                            log.error("Failed to save conversation", error);
                            return new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to save conversation");
                        }
                );
    }

    public Mono<ConversationHistoryResponse> renameConversation(String id, String newTitle) {
        return repository.findById(id)
                .flatMap(conversation -> {
                    conversation.setTitle(newTitle);
                    return repository.save(conversation);
                })
                .map(ConversationHistoryResponse::from)
                .switchIfEmpty(Mono.error(new CustomBaseException(
                        HttpStatus.NOT_FOUND.value(),
                        "Conversation not found"
                )))
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> {
                            log.error("Failed to rename conversation", error);
                            return new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to rename conversation");
                        }
                );
    }

    @Transactional
    public Mono<Void> batchDeleteConversations(List<String> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) {
            return Mono.empty();
        }
        return repository.deleteAllById(conversationIds)
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> {
                            log.error("Failed to delete conversations", error);
                            return new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to delete conversations");
                        }
                );
    }

    @Transactional
    public Mono<Void> batchPinConversations(List<String> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) {
            return Mono.empty();
        }
        Instant now = Instant.now();
        return repository.findAllById(conversationIds)
                .map(conversation -> {
                    conversation.setIsPinned(true);
                    conversation.setPinnedAt(now);
                    return conversation;
                })
                .collectList()
                .flatMapMany(repository::saveAll)
                .then()
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> {
                            log.error("Failed to pin conversations", error);
                            return new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to pin conversations");
                        }
                );
    }

    @Transactional
    public Mono<Void> batchUnpinConversations(List<String> conversationIds) {
        if (conversationIds == null || conversationIds.isEmpty()) {
            return Mono.empty();
        }
        return repository.findAllById(conversationIds)
                .map(conversation -> {
                    conversation.setIsPinned(false);
                    conversation.setPinnedAt(null);
                    return conversation;
                })
                .collectList()
                .flatMapMany(repository::saveAll)
                .then()
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> {
                            log.error("Failed to unpin conversations", error);
                            return new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to unpin conversations");
                        }
                );
    }

}
