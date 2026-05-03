package com.mytest.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mytest.backend.common.ApiResponse;
import com.mytest.backend.dto.AiChatRequest;
import com.mytest.backend.dto.AiChatResponse;
import com.mytest.backend.entity.AgentConfig;
import com.mytest.backend.utils.IntegrationUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.*;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.content.Media;
import org.springframework.ai.deepseek.DeepSeekChatModel;
import org.springframework.ai.deepseek.DeepSeekChatOptions;
import org.springframework.ai.model.tool.ToolCallingManager;
import org.springframework.ai.model.tool.ToolExecutionResult;
import org.springframework.ai.tokenizer.JTokkitTokenCountEstimator;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.publisher.Flux;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AiChatService {

    private ExecutorService nonBlockingService = Executors.newCachedThreadPool();
    private final DeepSeekChatModel chatModel;
    private final ObjectMapper objectMapper;
    private final ToolCallingManager toolCallingManager;
    private final ToolCallbackProvider tools;
    private final AgentService agentService;
    private static final String table_format_prompt_content = loadOptimizeationPromptFromFile("/prompts/user-prompt-table-format.txt");
    private static final String table_format_copydeck_content = loadOptimizeationPromptFromFile("/prompts/user-prompt-copydeck-format.txt");

    public AiChatService(@Qualifier("deepSeekChatModel") DeepSeekChatModel chatModel,
                         ObjectMapper objectMapper,
                         ToolCallingManager toolCallingManager,
                         ToolCallbackProvider tools,
                         AgentService agentService) {
        this.chatModel = chatModel;
        this.objectMapper = objectMapper;
        this.toolCallingManager = toolCallingManager;
        this.tools = tools;
        this.agentService = agentService;
    }

    private static String loadOptimizeationPromptFromFile(String path) {
        try {
            ClassPathResource resource = new ClassPathResource(path);
            return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        } catch (Exception e) {
            return "";
        }
    }

    public AiChatResponse baseAiChat(AiChatRequest request) {
        AgentConfig agentConfig = AgentConfig.getDefaultAgentConfig(request.getModelName());
        Prompt prompt = getPrompt(request.getDocuments(),
                request.getMessages(),
                agentConfig,
                true,
                request.getRequestId());

        ChatClient chatClient = ChatClient.builder(chatModel).build();
        String resp = chatClient.prompt(prompt).call().content();
        return new AiChatResponse(resp, agentConfig.getModelName(), agentConfig.getAgentName());
    }

    public AiChatResponse chat(AiChatRequest request) {
        AgentConfig agentConfig = AgentConfig.getDefaultAgentConfig2(request.getModelName());
        log.info("Agent config tools: {}", agentConfig.getTools());

        Prompt prompt = getPrompt(request.getDocuments(), request.getMessages(), agentConfig, true, request.getRequestId());
        log.info("Prompt created with {} messages", prompt.getInstructions().size());

        // Use ChatClient with proper configuration for tool calling
        ChatClient chatClient = ChatClient.builder(chatModel).build();

        // Call with the prompt that includes tool callbacks in its options
        String resp = chatClient.prompt(prompt).call().content();
        log.info("Response received: {}", resp);

        return new AiChatResponse(resp, agentConfig.getModelName(), agentConfig.getAgentName());
    }

    private Prompt getPrompt(List<AiChatRequest.Document> documents, List<AiChatRequest.Message> messages, AgentConfig agentConfig, boolean useTool, String requestId) {
        JTokkitTokenCountEstimator jTokkitTokenCountEstimator = new JTokkitTokenCountEstimator();
        AtomicInteger tokenCount = new AtomicInteger();

        // DeepSeekChatOptions chatOptions = agentService.getChatOptionsByAgentConfig(agentConfig, useTool);
        DeepSeekChatOptions chatOptions = agentService.getChatOptionsByAgentConfig(agentConfig, useTool);

        List<Message> history = new LinkedList<>();
        history.add(new SystemMessage(agentConfig.getSystemPrompt()));
        if (StringUtils.hasText(requestId)) {

        }
        if (documents == null) {
            documents = Collections.emptyList();
        }
        Map<String, List<AiChatRequest.Document>> grouped = documents.stream()
                .collect(Collectors.groupingBy(document ->
                        switch (document.getType()) {
                            case "string", "image" -> document.getType();
                            default -> "other";
                        }));
        List<AiChatRequest.Document> string = grouped.getOrDefault("string", Collections.emptyList());
        List<AiChatRequest.Document> image = grouped.getOrDefault("image", Collections.emptyList());

        StringBuilder sb = new StringBuilder();

        string.forEach(document -> {
            // if（document.getNewSheet()) {
            // }
            sb.append("<").append(document.getName()).append(">").append(document.getContent()).append("</").append(document.getName()).append(">\n\n");
        });
        List<Media> mediaList = image.stream().flatMap(document -> Arrays.stream(document.getBase64url())).map(IntegrationUtils::connverDataUrlToMedia).toList();
        UserMessage userDocumentMessage = UserMessage.builder().media(mediaList).text(sb.toString()).build();
        history.add(userDocumentMessage);
        tokenCount.addAndGet(jTokkitTokenCountEstimator.estimate(userDocumentMessage));

        messages.forEach(message -> {
            String role = message.getRole();
            if ("user".equalsIgnoreCase(role)) {
                UserMessage userMessage = new UserMessage(message.getContent());
                history.add(userMessage);
                tokenCount.addAndGet(jTokkitTokenCountEstimator.estimate(userMessage));
            } else if ("ai".equalsIgnoreCase(role)) {
                history.add(new AssistantMessage(message.getContent()));
                tokenCount.addAndGet(jTokkitTokenCountEstimator.estimate(new AssistantMessage(message.getContent())));
            }
        });

        // output schema
        if (agentConfig.getOutputType() != null) {
            switch (agentConfig.getOutputType()) {
                case "table" -> history.add(new UserMessage(table_format_prompt_content));
                case "copydeck" -> history.add(new UserMessage(table_format_copydeck_content));
            }
        }

        return new Prompt(history, chatOptions);

    }


    public SseEmitter chatStream(AiChatRequest request) {
        log.info("request", request);

        AgentConfig agentConfig = AgentConfig.getDefaultAgentConfigForDeepSeek(request.getModelName());

        AtomicReference<AgentConfig> agentConfigRef = new AtomicReference<>(agentConfig);

        String systemPrompt = agentConfig.getSystemPrompt();
        AtomicReference<String> systemPromptRef = new AtomicReference<>(systemPrompt);

        long timeNow = System.currentTimeMillis();
        AtomicBoolean replyCompleted = new AtomicBoolean(false);
        // 30分钟 - 足够处理复杂的HTML生成任务
        SseEmitter sseEmitter = new SseEmitter(30 * 60 * 1000L);
        nonBlockingService.execute(() -> {
            try {
                Prompt userprompt = getPrompt(request.getDocuments(), request.getMessages(), agentConfigRef.get(), true, request.getRequestId());
                ChatResponse resp = chatModel.call(userprompt);
                if (resp.hasToolCalls()) {
                    resp.getResult().getOutput().getToolCalls().forEach(toolcall -> {
                        String jsonParam;
                        try {
                            jsonParam = objectMapper.writeValueAsString(toolcall.arguments());
                            String jsonData = objectMapper.writeValueAsString(Map.of("toolname", toolcall.name(), "params", jsonParam));
                            sseEmitter.send(SseEmitter.event().data(jsonData).name("tool-call"));
                        } catch (IOException e) {
                            sseEmitter.completeWithError(e);
                        }
                    });

                    ToolExecutionResult toolExecutionResult = toolCallingManager.executeToolCalls(userprompt, resp);
                    if (toolExecutionResult.conversationHistory().getLast() instanceof ToolResponseMessage message) {
                        message.getResponses().forEach(response -> {
                            String name = response.name();
                            String responseData = response.responseData();
                            String jsonData = null;
                            try {
                                // 特殊处理 createPpt 工具：直接输出工具返回的 markdown 代码块
                                if ("createPpt".equalsIgnoreCase(name)) {
                                    log.info("检测到 createPpt 工具，直接输出结果: {}", responseData);
                                    // 构造符合前端期望的消息格式
                                    Map<String, Object> output = new HashMap<>();
                                    output.put("text", responseData);
                                    output.put("messageType", "ASSISTANT");
                                    Map<String, Object> result = new HashMap<>();
                                    result.put("output", output);
                                    String messageJson = objectMapper.writeValueAsString(result);
                                    sseEmitter.send(SseEmitter.event().data(messageJson).name("message"));
                                    sseEmitter.send(SseEmitter.event().data("Stream finished").name("done"));
                                    sseEmitter.complete();
                                    replyCompleted.set(true);
                                    return;
                                } else if ("xxx".equalsIgnoreCase(name)) {

                                } else {
                                    // 其他工具：发送 tool-result，让 AI 继续处理
                                    jsonData = objectMapper.writeValueAsString(Map.of("tool-result", responseData));
                                    sseEmitter.send(SseEmitter.event().data(jsonData).name("tool-result"));
                                    log.info("工具 {} 执行完成，发送 tool-result 事件，数据长度: {}", name, responseData.length());
                                }
                            } catch (IOException e) {
                                try {
                                    jsonData = objectMapper.writeValueAsString(Map.of("error", e.getMessage()));
                                    sseEmitter.send(SseEmitter.event().data(jsonData).name("error-message"));
                                } catch (IOException ex) {
                                }
                                sseEmitter.complete();
                                replyCompleted.set(true);
                            }
                        });
                    }
                    DeepSeekChatOptions chatOptionsNoTools = agentService.getChatOptionsByAgentConfig(agentConfigRef.get(), false);
                    userprompt = new Prompt(toolExecutionResult.conversationHistory(), chatOptionsNoTools);
                    log.info("工具执行完成，重新创建 prompt，对话历史长度: {}", toolExecutionResult.conversationHistory().size());

                }
                if (replyCompleted.get()) {
                    log.info("回复已完成，跳过后续处理");
                    return;
                }
                log.info("开始流式处理 AI 响应");
                Flux<ChatResponse> stream = chatModel.stream(userprompt);
                StringBuilder responseBuilder = new StringBuilder();
                AtomicBoolean isFirstResponse = new AtomicBoolean(true);
                processStreawm(stream, isFirstResponse, responseBuilder, sseEmitter, agentConfigRef.get(), timeNow);
            } catch (Exception e) {
                log.error("处理聊天请求时发生错误", e);
                try {
                    String errorJson = objectMapper.writeValueAsString(Map.of("error", e.getMessage()));
                    sseEmitter.send(SseEmitter.event().data(errorJson).name("error-message"));
                } catch (IOException ex) {
                    log.error("发送错误消息失败", ex);
                }
                sseEmitter.completeWithError(e);
            }
        });

        return sseEmitter;
    }

    private void processStreawm(Flux<ChatResponse> stream, AtomicBoolean isFirstResponse, StringBuilder responseBuilder, SseEmitter sseEmitter, AgentConfig agentConfig, long timeNow) {
        var doneEvent = SseEmitter.event().data("Stream finished").name("done");

        stream.map(token-> {
            try{
                return objectMapper.writeValueAsString(token.getResult());
            }catch (JsonProcessingException e) {
                throw new RuntimeException(e);
            }
        })
                .filter(jsonStr-> !jsonStr.trim().isEmpty())
                .doOnNext(jsonStr-> {
                    try{
                        if(isFirstResponse.get()&&"template".equalsIgnoreCase(agentConfig.getOutputType())) {

                        }
                        sseEmitter.send(SseEmitter.event().data(jsonStr).name("message"));
                    }catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                }).doOnError(err-> {
                    sseEmitter.completeWithError(err);
                })
                .doOnComplete(()-> {
                    String newJson = responseBuilder.toString();
                    if(StringUtils.hasText(agentConfig.getOutputType()) && agentConfig.getOutputType().trim().endsWith("template")) {

                    }
                    try{
                        sseEmitter.send(SseEmitter.event().data(newJson).name("message"));
                        sseEmitter.send(doneEvent);
                        sseEmitter.complete();
                    }catch (IOException e) {
                        sseEmitter.completeWithError(e);
                    }
                }).blockLast();
    }


}
