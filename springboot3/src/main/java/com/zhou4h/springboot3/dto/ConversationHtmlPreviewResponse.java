package com.zhou4h.springboot3.dto;

import com.zhou4h.springboot3.entity.ConversationHtmlPreview;
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
public class ConversationHtmlPreviewResponse {
    /**
     * 预览 ID
     */
    private String id;

    /**
     * HTML 内容
     */
    private String htmlContent;

    /**
     * 是否包含 XSS
     */
    private Boolean hasXss;

    /**
     * XSS 检测明细内容
     */
    private String xssContent;

    /**
     * 是否有外部引用
     */
    private Boolean hasExternalReferences;

    /**
     * 外部引用检测明细内容
     */
    private String externalReferencesContent;

    /**
     * HTML 内容长度
     */
    private Integer htmlContentLength;

    public static ConversationHtmlPreviewResponse build(ConversationHtmlPreview preview) {
        return ConversationHtmlPreviewResponse.builder()
                .id(preview.getId())
                .hasXss(preview.getHasXss())
                .xssContent(preview.getXssContent())
                .hasExternalReferences(preview.getHasExternalReferences())
                .externalReferencesContent(preview.getExternalReferencesContent())
                .htmlContentLength(preview.getHtmlContentLength())
                .build();
    }

    public static ConversationHtmlPreviewResponse build(ConversationHtmlPreview preview, String htmlContent) {
        ConversationHtmlPreviewResponse response = build(preview);
        response.setHtmlContent(htmlContent);
        return response;
    }
}
