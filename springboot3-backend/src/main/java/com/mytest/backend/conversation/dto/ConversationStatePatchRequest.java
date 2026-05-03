package com.mytest.backend.conversation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.Instant;

@Data
public class ConversationStatePatchRequest {

    @NotBlank(message = "Staff ID is required")
    private String staffId;

    @NotNull(message = "Conversation state patch is required")
    private Object conversationState;

    private Instant updatedAt;
}
