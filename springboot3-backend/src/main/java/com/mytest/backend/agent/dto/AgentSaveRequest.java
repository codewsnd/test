package com.mytest.backend.agent.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AgentSaveRequest {

    @NotBlank
    @Size(max = 100)
    private String name;

    private String type;

    private String icon;

    private String modelName;

    private String systemPrompt;

    @PositiveOrZero
    private Long callCount;

    @DecimalMin(value = "0.0", inclusive = true)
    private BigDecimal temperature;

    @PositiveOrZero
    private Integer maxTokens;

    @DecimalMin(value = "0.0", inclusive = true)
    private BigDecimal topP;

    private BigDecimal frequencyPenalty;

    private BigDecimal presencePenalty;

    private String outputType;

    private String createUser;

    private String tools;

    private String tags;

    private String templateSchemas;
}
