package com.mytest.backend.conversation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("conversation_html_preview")
public class ConversationHtmlPreviewDO {

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    @TableField("staff_id")
    private String staffId;

    @TableField("conversation_id")
    private String conversationId;

    @TableField("turn_id")
    private String turnId;

    @TableField("s3_path")
    private String s3Path;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("has_xss")
    private Boolean hasXss;

    @TableField("xss_content")
    private String xssContent;

    @TableField("has_external_references")
    private Boolean hasExternalReferences;

    @TableField("external_references_content")
    private String externalReferencesContent;

    @TableField("html_content_length")
    private Integer htmlContentLength;

    @TableField("html_content_hash")
    private String htmlContentHash;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
