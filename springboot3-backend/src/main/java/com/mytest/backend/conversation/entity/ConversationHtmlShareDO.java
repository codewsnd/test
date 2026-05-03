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
@TableName("conversation_html_share")
public class ConversationHtmlShareDO {

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    @TableField("preview_id")
    private String previewId;

    @TableField("staff_id")
    private String staffId;

    @TableField("conversation_id")
    private String conversationId;

    @TableField("turn_id")
    private String turnId;

    @TableField("enabled")
    private Boolean enabled;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;

    @TableField("expires_at")
    private LocalDateTime expiresAt;
}
