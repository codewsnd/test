package com.mytest.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
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
public class OpenAiChatService {

    private ExecutorService nonBlockingService = Executors.newCachedThreadPool();
    private final OpenAiChatModel chatModel;
    private final ObjectMapper objectMapper;
    private final ToolCallingManager toolCallingManager;
    private final ToolCallbackProvider tools;
    private final AgentService agentService;
    private static final String table_format_prompt_content = loadOptimizeationPromptFromFile("/prompts/user-prompt-table-format.txt");
    private static final String table_format_copydeck_content = loadOptimizeationPromptFromFile("/prompts/user-prompt-copydeck-format.txt");

    public OpenAiChatService(@Qualifier("openAiChatModel") OpenAiChatModel chatModel,
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

    public AiChatResponse chat(AiChatRequest request) {
        AgentConfig agentConfig = AgentConfig.getDefaultAgentConfig2(request.getModelName());
        log.info("Agent config tools: {}", agentConfig.getTools());

        Prompt prompt = getPrompt(request.getDocuments(), request.getMessages(), agentConfig, true, request.getRequestId());
        log.info("Prompt created with {} messages", prompt.getInstructions().size());

        // Use ChatClient with proper configuration for tool calling
        ChatClient chatClient = ChatClient.builder(chatModel).build();

        // Call with the prompt that includes tool callbacks in its options
        String resp = chatClient.prompt(prompt).call().content();
        return new AiChatResponse(resp, agentConfig.getModelName(), agentConfig.getAgentName());
    }

    private Prompt getPrompt(List<AiChatRequest.Document> documents, List<AiChatRequest.Message> messages, AgentConfig agentConfig, boolean useTool, String requestId) {
        JTokkitTokenCountEstimator jTokkitTokenCountEstimator = new JTokkitTokenCountEstimator();
        AtomicInteger tokenCount = new AtomicInteger();

        OpenAiChatOptions chatOptions = agentService.getOpenAiChatOptions(agentConfig, useTool);

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

        AgentConfig agentConfig = AgentConfig.getDefaultAgentConfig(request.getModelName());

        AtomicReference<AgentConfig> agentConfigRef = new AtomicReference<>(agentConfig);

        String systemPrompt = agentConfig.getSystemPrompt();
        AtomicReference<String> systemPromptRef = new AtomicReference<>(systemPrompt);

        long timeNow = System.currentTimeMillis();
        AtomicBoolean replyCompleted = new AtomicBoolean(false);
        // 3分钟
        SseEmitter sseEmitter = new SseEmitter(3 * 60 * 1000L);
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
                            String jsonData = null;
                            try {
                                if ("xxx".equalsIgnoreCase(name)) {

                                } else {
                                    jsonData = objectMapper.writeValueAsString(Map.of("tool-result", response.responseData()));
                                    sseEmitter.send(SseEmitter.event().data(jsonData).name("tool-result"));
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
                    OpenAiChatOptions chatOptionsNoTools = agentService.getOpenAiChatOptions(agentConfigRef.get(), false);
                    userprompt = new Prompt(toolExecutionResult.conversationHistory(), chatOptionsNoTools);

                }
                if (replyCompleted.get()) {
                    return;
                }
                Flux<ChatResponse> stream = chatModel.stream(userprompt);
                StringBuilder responseBuilder = new StringBuilder();
                AtomicBoolean isFirstResponse = new AtomicBoolean(true);
                processStream(stream, isFirstResponse, responseBuilder, sseEmitter, agentConfigRef.get(), timeNow);
            } catch (Exception e) {

            }
        });

        return sseEmitter;
    }

    private void processStream(Flux<ChatResponse> stream, AtomicBoolean isFirstResponse, StringBuilder responseBuilder, SseEmitter sseEmitter, AgentConfig agentConfig, long timeNow) {
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
