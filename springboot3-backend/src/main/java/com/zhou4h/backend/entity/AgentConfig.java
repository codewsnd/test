package com.zhou4h.backend.entity;

import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.util.List;

@Slf4j
@Data
@Builder
public class AgentConfig {

    private String agentName;
    private String modelName;
    private String systemPrompt;
    private BigDecimal temperature;
    private Integer maxCompletionTokens;
    private BigDecimal topP;
    private BigDecimal frequencyPenalty;
    private BigDecimal presencePenalty;
    private String outputType;
    private List<String> tools;
    private List<String> knowledgeBases;
    private String templateSchema;

    private static final BigDecimal DEFAULT_TEMPERATURE = BigDecimal.valueOf(0.7);
    // DeepSeek Reasoner 最大支持 65536 tokens
    private static final Integer DEFAULT_MAX_TOKENS = 65536;
    private static final BigDecimal DEFAULT_TOP_P = BigDecimal.valueOf(1.0);
    private static final BigDecimal DEFAULT_FREQUENCY_PENALTY = BigDecimal.valueOf(0.0);
    private static final BigDecimal DEFAULT_PRESENCE_PENALTY = BigDecimal.valueOf(0.0);

    public static AgentConfig getDefaultAgentConfigForDeepSeek(String modelName) {
        String systemPrompt = """
            Detect keywords and call tools immediately. Every request is independent - always call even if repeated. No explanations, just execute.
            """;

        return AgentConfig.builder()
                .agentName("DeepSeek Assistant")
                .modelName(modelName)
                .systemPrompt(systemPrompt)
                .temperature(DEFAULT_TEMPERATURE)
                .maxCompletionTokens(DEFAULT_MAX_TOKENS)
                .tools(List.of("CopyDeck", "TestCase"))
                .knowledgeBases(List.of())
                .build();
    }

    public static AgentConfig getDefaultAgentConfig(String modelName) {
        return AgentConfig.builder()
                .agentName(null)
                .modelName(modelName)
                .systemPrompt("")
                // .outputType("copydeck")
                .temperature(DEFAULT_TEMPERATURE)
                .maxCompletionTokens(DEFAULT_MAX_TOKENS)
                .tools(List.of())
                // .tools(List.of("CopyDeck"))
                // .tools(List.of())
                .knowledgeBases(List.of())
                .build();
    }

    public static AgentConfig getDefaultAgentConfig2(String modelName) {
        return AgentConfig.builder()
                .agentName("")
                .modelName(modelName)
                .systemPrompt("")
                // .outputType("copydeck")
                .temperature(DEFAULT_TEMPERATURE)
                .maxCompletionTokens(32768)
                // 启用 PPT 工具
                .tools(List.of())
                .knowledgeBases(List.of())
                .build();
    }
}
