package com.mytest.springboot3.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * HTML 预览请求 DTO
 */
@Data
public class ConversationHtmlPreviewRequest {

    @NotBlank(message = "Staff ID is required")
    private String staffId;

    @NotBlank(message = "Conversation ID is required")
    private String conversationId;

    @NotBlank(message = "Turn ID is required")
    private String turnId;

    @NotBlank(message = "HTML content is required")
    private String htmlContent;
}
