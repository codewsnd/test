package com.mytest.backend.repository;

import com.mytest.backend.entity.ConversationHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ConversationHistoryRepository extends JpaRepository<ConversationHistory, String> {

    @Query(
            value = """
                    SELECT
                        id,
                        title,
                        conversation_state,
                        is_pinned,
                        created_at,
                        updated_at,
                        pinned_at,
                        user_id,
                        title_generating,
                        is_deleted
                    FROM conversation_history
                    WHERE user_id = :staffId
                    AND COALESCE(is_deleted, false) = false
                    AND (
                        CAST(:search AS text) = ''
                        OR title ILIKE CONCAT('%', CAST(:search AS text), '%')
                        OR COALESCE(conversation_state, '') ILIKE CONCAT('%', CAST(:search AS text), '%')
                    )
                    ORDER BY is_pinned DESC NULLS LAST, pinned_at DESC NULLS LAST, updated_at DESC
                    """,
            countQuery = """
                    SELECT COUNT(*)
                    FROM conversation_history
                    WHERE user_id = :staffId
                    AND COALESCE(is_deleted, false) = false
                    AND (
                        CAST(:search AS text) = ''
                        OR title ILIKE CONCAT('%', CAST(:search AS text), '%')
                        OR COALESCE(conversation_state, '') ILIKE CONCAT('%', CAST(:search AS text), '%')
                    )
                    """,
            nativeQuery = true
    )
    Page<ConversationHistory> findByStaffIdAndSearch(
            @Param("staffId") String staffId,
            @Param("search") String search,
            Pageable pageable
    );
}
