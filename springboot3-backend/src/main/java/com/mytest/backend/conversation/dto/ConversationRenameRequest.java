package com.mytest.backend.conversation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConversationRenameRequest {

    @NotBlank(message = "Title is required")
    private String title;
}
