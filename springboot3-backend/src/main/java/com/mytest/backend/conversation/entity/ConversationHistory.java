package com.mytest.backend.conversation.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.mytest.backend.conversation.typehandler.JsonbStringTypeHandler;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName(value = "conversation_history", autoResultMap = true)
public class ConversationHistory {

    @TableId(value = "id", type = IdType.INPUT)
    private String id;

    @TableField("title")
    private String title;

    @TableField(value = "conversation_state", typeHandler = JsonbStringTypeHandler.class)
    private String conversationState;

    @TableField("is_pinned")
    private Boolean isPinned;

    @TableField("created_at")
    private Instant createdAt;

    @TableField("updated_at")
    private Instant updatedAt;

    @TableField("pinned_at")
    private Instant pinnedAt;

    @TableField("user_id")
    private String staffId;

    @TableField("title_generating")
    private Boolean titleGenerating;

    @TableField("is_deleted")
    @TableLogic(value = "false", delval = "true")
    private Boolean isDeleted;
}
