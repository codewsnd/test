package com.mytest.springboot3.dto;

import io.r2dbc.postgresql.codec.Json;
import lombok.Data;
import java.time.Instant;

@Data
public class ConversationSaveRequest {
    private String id;
    private String title;
    private String staffId;
    private Json conversationState;
    private Boolean isPinned;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant pinnedAt;
    private Boolean titleGenerating;
}
