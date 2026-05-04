package com.mytest.backend.conversation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConversationHtmlPreviewRequest {

    private String staffId;

    @NotBlank(message = "Conversation ID is required")
    private String conversationId;

    @NotBlank(message = "Turn ID is required")
    private String turnId;

    @NotBlank(message = "HTML content is required")
    private String htmlContent;
}
