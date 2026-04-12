package com.zhou4h.backend.service;

import com.zhou4h.backend.entity.AgentConfig;
import com.zhou4h.backend.tools.CopyDeckTools;
import com.zhou4h.backend.tools.PptTools;
import com.zhou4h.backend.tools.TestCaseTools;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.deepseek.DeepSeekChatOptions;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentService {

    private final CopyDeckTools copyDeckTools;
    private final TestCaseTools testCaseTools;
    private final PptTools pptTools;

    public DeepSeekChatOptions getChatOptionsByAgentConfig(AgentConfig agentConfig, boolean useTools) {
         DeepSeekChatOptions.Builder builder = DeepSeekChatOptions.builder()
                 .model(agentConfig.getModelName())
                 .temperature(agentConfig.getTemperature().doubleValue())
                 .maxTokens(agentConfig.getMaxCompletionTokens())
                 .internalToolExecutionEnabled(false);
                 // Enable internal tool execution so Spring AI automatically calls tools

         List<Object> toolsList = new ArrayList<>();

         // if(!agentConfig.getKnowledgeBases().isEmpty()) {
         //     toolsList.add();
         // }

        if("chats".equalsIgnoreCase(agentConfig.getOutputType())) {
            // toolsList.add()
        }

        for(String tool: agentConfig.getTools()) {
            switch (tool) {
                case "Web": toolsList.add(copyDeckTools);break;
                case "CopyDeck": toolsList.add(copyDeckTools);break;
                case "TestCase": toolsList.add(testCaseTools);break;
                case "Ppt": toolsList.add(pptTools);break;
            }
        }

        if(agentConfig.getTopP()!=null) {
            builder.topP(agentConfig.getTopP().doubleValue());
        }
        if(agentConfig.getFrequencyPenalty()!=null) {
            builder.frequencyPenalty(agentConfig.getFrequencyPenalty().doubleValue());
        }
        if(agentConfig.getPresencePenalty()!=null) {
            builder.presencePenalty(agentConfig.getPresencePenalty().doubleValue());
        }
        if(useTools && !toolsList.isEmpty()) {
            log.info("Registering {} tools: {}", toolsList.size(), toolsList);
            MethodToolCallbackProvider build = MethodToolCallbackProvider.builder()
                    .toolObjects(toolsList.toArray())
                    .build();
            log.info("Tool callbacks registered: {}", build.getToolCallbacks().length);
            builder.toolCallbacks(build.getToolCallbacks());
        } else {
            log.warn("Tools not enabled - useTools: {}, toolsList size: {}", useTools, toolsList.size());
        }
        // if (StringUtils.hasText(agentConfig.getOutputType()) && "template".equalsIgnoreCase(agentConfig.getOutputType())) {
        //     builder.responseFormat(new ResponseFormat(ResponseFormat.Type.JSON_OBJECT, agentConfig.getTemplateSchema()));
        // }

        return builder.build();
    }

    public OpenAiChatOptions getOpenAiChatOptions(AgentConfig agentConfig, boolean useTools) {
        OpenAiChatOptions.Builder builder = OpenAiChatOptions.builder()
                .model(agentConfig.getModelName())
                .temperature(agentConfig.getTemperature().doubleValue())
                .maxTokens(agentConfig.getMaxCompletionTokens());

        List<Object> toolsList = new ArrayList<>();

        if("chats".equalsIgnoreCase(agentConfig.getOutputType())) {
            // toolsList.add()
        }

        for(String tool: agentConfig.getTools()) {
            switch (tool) {
                case "Web": toolsList.add(copyDeckTools);break;
                case "CopyDeck": toolsList.add(copyDeckTools);break;
                case "TestCase": toolsList.add(testCaseTools);break;
                case "Ppt": toolsList.add(pptTools);break;
            }
        }

        if(agentConfig.getTopP()!=null) {
            builder.topP(agentConfig.getTopP().doubleValue());
        }
        if(agentConfig.getFrequencyPenalty()!=null) {
            builder.frequencyPenalty(agentConfig.getFrequencyPenalty().doubleValue());
        }
        if(agentConfig.getPresencePenalty()!=null) {
            builder.presencePenalty(agentConfig.getPresencePenalty().doubleValue());
        }
        if(useTools && !toolsList.isEmpty()) {
            log.info("Registering {} tools: {}", toolsList.size(), toolsList);
            MethodToolCallbackProvider build = MethodToolCallbackProvider.builder()
                    .toolObjects(toolsList.toArray())
                    .build();
            log.info("Tool callbacks registered: {}", build.getToolCallbacks().length);
            builder.toolCallbacks(build.getToolCallbacks());
        } else {
            log.warn("Tools not enabled - useTools: {}, toolsList size: {}", useTools, toolsList.size());
        }

        return builder.build();
    }

}
