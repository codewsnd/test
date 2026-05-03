package com.mytest.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "conversation_history")
public class ConversationHistory {

    @Id
    private String id;

    @Column(name = "title")
    private String title;

    @Column(name = "conversation_state", columnDefinition = "TEXT")
    private String conversationState;

    @Column(name = "is_pinned")
    private Boolean isPinned;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "pinned_at")
    private Instant pinnedAt;

    @Column(name = "user_id")
    private String staffId;

    @Column(name = "title_generating")
    private Boolean titleGenerating;

    @Column(name = "is_deleted")
    private Boolean isDeleted;

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (isPinned == null) {
            isPinned = false;
        }
        if (isDeleted == null) {
            isDeleted = false;
        }
    }
}
