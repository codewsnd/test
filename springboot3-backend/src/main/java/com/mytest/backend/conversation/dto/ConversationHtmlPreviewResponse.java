package com.mytest.backend.conversation.dto;

import com.mytest.backend.conversation.entity.ConversationHtmlPreviewDO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationHtmlPreviewResponse {

    private String id;
    private String htmlContent;
    private Boolean hasXss;
    private String xssContent;
    private Boolean hasExternalReferences;
    private String externalReferencesContent;
    private Integer htmlContentLength;

    public static ConversationHtmlPreviewResponse build(ConversationHtmlPreviewDO preview) {
        return ConversationHtmlPreviewResponse.builder()
                .id(preview.getId())
                .hasXss(preview.getHasXss())
                .xssContent(preview.getXssContent())
                .hasExternalReferences(preview.getHasExternalReferences())
                .externalReferencesContent(preview.getExternalReferencesContent())
                .htmlContentLength(preview.getHtmlContentLength())
                .build();
    }

    public static ConversationHtmlPreviewResponse build(ConversationHtmlPreviewDO preview, String htmlContent) {
        ConversationHtmlPreviewResponse response = build(preview);
        response.setHtmlContent(htmlContent);
        return response;
    }
}
