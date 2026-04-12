package com.zhou4h.springboot3.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.zhou4h.springboot3.config.PostgresJsonDeserializer;
import io.r2dbc.postgresql.codec.Json;
import lombok.Data;
import java.time.Instant;
import java.util.Map;

@Data
public class ConversationSaveRequest {
    private String id;
    private String title;
    private String staffId;
    // @JsonDeserialize(using = PostgresJsonDeserializer.class)
    private Json conversationState;
    private Boolean isPinned;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant pinnedAt;
    private Boolean titleGenerating;
}
