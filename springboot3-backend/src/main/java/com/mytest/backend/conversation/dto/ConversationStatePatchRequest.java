package com.mytest.backend.conversation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

@Data
public class ConversationStatePatchRequest {

    @NotNull(message = "Conversation state patch is required")
    private JsonNode conversationState;

    private Instant updatedAt;
}
