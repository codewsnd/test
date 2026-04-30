package com.zhou4h.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "conversation_html_preview")
public class ConversationHtmlPreview {

    @Id
    private String id;

    @Column(name = "staff_id")
    private String staffId;

    @Column(name = "conversation_id")
    private String conversationId;

    @Column(name = "turn_id")
    private String turnId;

    @Column(name = "s3_path")
    private String s3Path;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "has_xss")
    private Boolean hasXss;

    @Column(name = "xss_content")
    private String xssContent;

    @Column(name = "has_external_references")
    private Boolean hasExternalReferences;

    @Column(name = "external_references_content")
    private String externalReferencesContent;

    @Column(name = "html_content_length")
    private Integer htmlContentLength;

    @Column(name = "html_content_hash")
    private String htmlContentHash;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
