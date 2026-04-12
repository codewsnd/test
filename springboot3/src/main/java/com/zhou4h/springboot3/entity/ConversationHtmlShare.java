package com.zhou4h.springboot3.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDateTime;

/**
 * HTML 分享实体
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Table("conversation_html_share")
public class ConversationHtmlShare {

    @Id
    private String id;

    @Column("preview_id")
    private String previewId;

    @Column("staff_id")
    private String staffId;

    @Column("conversation_id")
    private String conversationId;

    @Column("turn_id")
    private String turnId;

    @Column("enabled")
    private Boolean enabled;

    @Column("created_at")
    private LocalDateTime createdAt;

    @Column("updated_at")
    private LocalDateTime updatedAt;

    @Column("expires_at")
    private LocalDateTime expiresAt;
}
