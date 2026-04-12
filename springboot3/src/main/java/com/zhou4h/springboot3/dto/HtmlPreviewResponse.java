package com.zhou4h.springboot3.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * HTML 预览响应 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HtmlPreviewResponse {
    /**
     * 临时 ID
     */
    private String tempId;

    /**
     * 预览 URL
     */
    private String previewUrl;
}
