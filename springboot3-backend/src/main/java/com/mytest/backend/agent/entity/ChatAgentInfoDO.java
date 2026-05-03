package com.mytest.backend.agent.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("chat_agents_info")
public class ChatAgentInfoDO {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("name")
    private String name;

    @TableField("type")
    private String type;

    @TableField("icon")
    private String icon;

    @TableField("model_name")
    private String modelName;

    @TableField("system_prompt")
    private String systemPrompt;

    @TableField("call_count")
    private Long callCount;

    @TableField("temperature")
    private BigDecimal temperature;

    @TableField("max_tokens")
    private Integer maxTokens;

    @TableField("create_time")
    private Instant createTime;

    @TableField("update_time")
    private Instant updateTime;

    @TableField("top_p")
    private BigDecimal topP;

    @TableField("frequency_penalty")
    private BigDecimal frequencyPenalty;

    @TableField("presence_penalty")
    private BigDecimal presencePenalty;

    @TableField("output_type")
    private String outputType;

    @TableField("create_user")
    private String createUser;

    @TableField("tools")
    private String tools;

    @TableField("tags")
    private String tags;

    @TableField("template_schemas")
    private String templateSchemas;

    @TableField("is_deleted")
    @TableLogic(value = "false", delval = "true")
    private Boolean isDeleted;
}
