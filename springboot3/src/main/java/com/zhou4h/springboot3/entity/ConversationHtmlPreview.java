package com.zhou4h.springboot3.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * HTML 预览存储实体（使用 S3 存储 HTML 内容）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("conversation_html_preview")
public class ConversationHtmlPreview {

    @Id
    private String id;

    @Column("staff_id")
    private String staffId;

    @Column("conversation_id")
    private String conversationId;

    @Column("turn_id")
    private String turnId;

    @Column("s3_path")
    private String s3Path;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("has_xss")
    private Boolean hasXss;

    @Column("xss_content")
    private String xssContent;

    @Column("has_external_references")
    private Boolean hasExternalReferences;

    @Column("external_references_content")
    private String externalReferencesContent;

    @Column("html_content_length")
    private Integer htmlContentLength;

    @Column("html_content_hash")
    private String htmlContentHash;

    @Column("updated_at")
    private LocalDateTime updatedAt;
}
