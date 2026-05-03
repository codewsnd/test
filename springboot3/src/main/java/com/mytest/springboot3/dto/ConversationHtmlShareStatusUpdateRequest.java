package com.mytest.springboot3.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * HTML 分享状态更新请求
 */
@Data
public class ConversationHtmlShareStatusUpdateRequest {

    @NotNull(message = "Enabled is required")
    private Boolean enabled;
}
