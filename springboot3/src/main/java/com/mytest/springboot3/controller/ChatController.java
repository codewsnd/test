package com.mytest.springboot3.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j

public class ChatController {

    private final ChatClient chatClient;
    private final ChatModel chatModel;

    @PostMapping("/chat")
    public Mono<String> chatModel1Post(@RequestBody Map<String, String> request) {
        return Mono.fromCallable(() -> {
                    if (request == null) {
                        log.warn("Request is null");
                        throw new IllegalArgumentException("Request cannot be null");
                    }

                    String message = request.get("message");
                    if (message == null || message.trim().isEmpty()) {
                        log.warn("Message is null or empty");
                        throw new IllegalArgumentException("Message cannot be null or empty");
                    }

                    log.debug("Processing chat request with message: {}", message);
                    String response = chatModel.call(message);

                    if (response == null) {
                        log.warn("ChatModel returned null response");
                        return "";
                    }

                    String cleanedResponse = removeThinkTags(response);
                    log.debug("Chat response processed successfully");
                    return cleanedResponse;
                })
                .subscribeOn(Schedulers.boundedElastic())
                .doOnError(error -> log.error("Error processing chat request", error));
    }

    /**
     * 移除AI回复中的<think>标签及其内容
     * @param content AI回复内容
     * @return 过滤后的内容
     */
    private String removeThinkTags(String content) {
        if (content == null || content.isEmpty()) {
            return content;
        }

        // 使用正则表达式移除<think>...</think>标签及其内容
        // 使用(?s)标志使.匹配换行符，实现多行匹配
        return content.replaceAll("(?s)<think>.*?</think>", "").trim();
    }


    @PostMapping(value = "/chat-sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chatClient3(@RequestBody Map<String, String> request) {
        if (request == null) {
            log.warn("Request is null for SSE chat");
            return Flux.error(new IllegalArgumentException("Request cannot be null"));
        }

        String message = request.get("message");
        if (message == null || message.trim().isEmpty()) {
            log.warn("Message is null or empty for SSE chat");
            return Flux.error(new IllegalArgumentException("Message cannot be null or empty"));
        }

        log.debug("Processing SSE chat request with message: {}", message);
        return chatClient
                .prompt()
                .user(message)
                .stream()
                .content()
                .concatWith(Flux.just("[DONE]"))
                .doOnError(error -> log.error("Error processing SSE chat request", error));
    }




}
