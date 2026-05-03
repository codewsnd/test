package com.mytest.backend.conversation.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ConversationHtmlShareStatusUpdateRequest {

    @NotNull(message = "Enabled is required")
    private Boolean enabled;
}
