package com.zhou4h.backend.repository;

import com.zhou4h.backend.entity.ConversationHtmlPreview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConversationHtmlPreviewRepository extends JpaRepository<ConversationHtmlPreview, String> {

    Optional<ConversationHtmlPreview> findByStaffIdAndConversationIdAndTurnId(
            String staffId,
            String conversationId,
            String turnId
    );
}
