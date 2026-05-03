package com.mytest.backend.agent.vo;

import com.mytest.backend.agent.entity.ChatAgentInfoDO;
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
public class AgentResponse {

    private Long id;
    private String name;
    private String type;
    private String icon;
    private String modelName;
    private String systemPrompt;
    private Long callCount;
    private BigDecimal temperature;
    private Integer maxTokens;
    private Instant createTime;
    private Instant updateTime;
    private BigDecimal topP;
    private BigDecimal frequencyPenalty;
    private BigDecimal presencePenalty;
    private String outputType;
    private String createUser;
    private String tools;
    private String tags;
    private String templateSchemas;
    private Boolean isDeleted;

    public static AgentResponse from(ChatAgentInfoDO entity) {
        return AgentResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .type(entity.getType())
                .icon(entity.getIcon())
                .modelName(entity.getModelName())
                .systemPrompt(entity.getSystemPrompt())
                .callCount(entity.getCallCount())
                .temperature(entity.getTemperature())
                .maxTokens(entity.getMaxTokens())
                .createTime(entity.getCreateTime())
                .updateTime(entity.getUpdateTime())
                .topP(entity.getTopP())
                .frequencyPenalty(entity.getFrequencyPenalty())
                .presencePenalty(entity.getPresencePenalty())
                .outputType(entity.getOutputType())
                .createUser(entity.getCreateUser())
                .tools(entity.getTools())
                .tags(entity.getTags())
                .templateSchemas(entity.getTemplateSchemas())
                .isDeleted(entity.getIsDeleted())
                .build();
    }
}
