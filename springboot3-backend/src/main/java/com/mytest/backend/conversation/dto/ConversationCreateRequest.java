package com.mytest.backend.conversation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.Instant;

@Data
public class ConversationCreateRequest {

    @NotBlank(message = "Conversation id is required")
    private String id;

    @NotBlank(message = "Title is required")
    private String title;

    private Object conversationState;
    private Boolean isPinned;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant pinnedAt;
    private Boolean titleGenerating;
}
