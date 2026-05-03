package com.mytest.springboot3.repository;

import com.mytest.springboot3.entity.ConversationHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.data.repository.reactive.ReactiveSortingRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface ConversationHistoryRepository extends ReactiveCrudRepository<ConversationHistory, String>, ReactiveSortingRepository<ConversationHistory, String> {

    @Query("""
        SELECT
            id,
            title,
            is_pinned,
            created_at,
            updated_at,
            pinned_at,
            staff_id,
            title_generating
        FROM conversation_history
        WHERE staff_id = :staffId
        AND is_deleted = false
        AND (
            title ILIKE CONCAT('%', :search, '%')
            OR conversation_state::text ILIKE CONCAT('%', :search, '%')
            OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(conversation_state->'turns') AS turn
                WHERE turn->'userInput'->>'content' ILIKE CONCAT('%', :search, '%')
                OR turn->'aiResponse'->>'content' ILIKE CONCAT('%', :search, '%')
            )
        )
        ORDER BY is_pinned DESC NULLS LAST, pinned_at DESC NULLS LAST, updated_at DESC
        LIMIT :#{#pageable.pageSize} OFFSET :#{#pageable.offset}
        """)
    Flux<ConversationHistory> findByStaffIdAndSearch(String staffId, String search, Pageable pageable);

    @Query("""
        SELECT COUNT(*) FROM conversation_history
        WHERE staff_id = :staffId
        AND is_deleted = false
        AND (
            title ILIKE CONCAT('%', :search, '%')
            OR conversation_state::text ILIKE CONCAT('%', :search, '%')
            OR EXISTS (
                SELECT 1 FROM jsonb_array_elements(conversation_state->'turns') AS turn
                WHERE turn->'userInput'->>'content' ILIKE CONCAT('%', :search, '%')
                OR turn->'aiResponse'->>'content' ILIKE CONCAT('%', :search, '%')
            )
        )
        """)
    Mono<Long> countByStaffIdAndSearch(String staffId, String search);
}
