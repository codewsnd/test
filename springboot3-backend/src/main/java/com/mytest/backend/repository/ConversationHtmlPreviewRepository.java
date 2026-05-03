package com.mytest.backend.repository;

import com.mytest.backend.entity.ConversationHtmlPreview;
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
