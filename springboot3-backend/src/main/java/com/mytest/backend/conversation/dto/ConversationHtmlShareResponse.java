package com.mytest.backend.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationHtmlShareResponse {

    private String id;
    private String previewId;
    private Boolean enabled;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime expiresAt;
    private Boolean expired;
    private String htmlContent;
    private Boolean hasXss;
    private Boolean hasExternalReferences;
    private Integer htmlContentLength;
}
