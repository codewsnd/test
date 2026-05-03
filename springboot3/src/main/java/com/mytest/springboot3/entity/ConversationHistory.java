package com.mytest.springboot3.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.JsonNode;
import io.r2dbc.postgresql.codec.Json;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("conversation_history")
public class ConversationHistory {

    @Id
    private String id;

    @Column("title")
    private String title;

    @Column("conversation_state")
    private Json conversationState;

    @Column("is_pinned")
    private Boolean isPinned;

    @Column("created_at")
    private Instant createdAt;

    @Column("updated_at")
    private Instant updatedAt;

    @Column("pinned_at")
    private Instant pinnedAt;

    @Column("staff_id")
    private String staffId;

    @Column("title_generating")
    private Boolean titleGenerating;

}
