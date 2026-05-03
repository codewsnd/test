package com.mytest.springboot3.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * HTML 分享响应 DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationHtmlShareResponse {

    /**
     * 分享 ID
     */
    private String id;

    /**
     * 预览 ID
     */
    private String previewId;

    /**
     * 是否开启分享
     */
    private Boolean enabled;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;

    /**
     * 过期时间
     */
    private LocalDateTime expiresAt;

    /**
     * 是否已过期
     */
    private Boolean expired;

    /**
     * HTML 内容
     */
    private String htmlContent;

    /**
     * 是否包含 XSS
     */
    private Boolean hasXss;

    /**
     * 是否有外部引用
     */
    private Boolean hasExternalReferences;

    /**
     * HTML 内容长度
     */
    private Integer htmlContentLength;
}
