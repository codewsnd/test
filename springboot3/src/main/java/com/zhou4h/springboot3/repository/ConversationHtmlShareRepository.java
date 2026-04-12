package com.zhou4h.springboot3.repository;

import com.zhou4h.springboot3.entity.ConversationHtmlShare;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

/**
 * HTML 分享 Repository
 */
@Repository
public interface ConversationHtmlShareRepository extends ReactiveCrudRepository<ConversationHtmlShare, String> {

    /**
     * 根据 previewId 查找分享记录
     */
    Mono<ConversationHtmlShare> findByPreviewId(String previewId);
}
