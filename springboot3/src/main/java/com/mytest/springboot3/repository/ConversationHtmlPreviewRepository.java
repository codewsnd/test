package com.mytest.springboot3.repository;

import com.mytest.springboot3.entity.ConversationHtmlPreview;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

/**
 * HTML 预览 Repository
 */
@Repository
public interface ConversationHtmlPreviewRepository extends ReactiveCrudRepository<ConversationHtmlPreview, String> {

    /**
     * 根据 staffId, conversationId, turnId 查找预览
     */
    Mono<ConversationHtmlPreview> findByStaffIdAndConversationIdAndTurnId(String staffId, String conversationId, String turnId);

}
