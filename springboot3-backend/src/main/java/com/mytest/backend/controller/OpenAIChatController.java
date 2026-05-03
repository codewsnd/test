package com.mytest.backend.controller;

import com.mytest.backend.common.ApiResponse;
import com.mytest.backend.dto.AiChatRequest;
import com.mytest.backend.dto.AiChatResponse;
import com.mytest.backend.service.OpenAiChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.validation.Valid;

@RestController
@RequiredArgsConstructor
@Slf4j
@CrossOrigin("*")
public class OpenAIChatController {


    private final OpenAiChatService aiChatService;

    @PostMapping(value = "/chat/completions")
    public ApiResponse chat(@Valid @RequestBody AiChatRequest request) {
        try{
            AiChatResponse aiChatResponse = aiChatService.chat(request);
            return ApiResponse.success(aiChatResponse);
        }catch (Exception e) {
            log.error("error", e);
            return ApiResponse.error(500, "Chat error");
        }
    }

    @PostMapping(value = "/chat/stream" , produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter chatStream(@Valid @RequestBody AiChatRequest request) {
        try{
            return aiChatService.chatStream(request);
        }catch (Exception e) {
            log.error("Error in chat stream", e);
            SseEmitter sseEmitter = new SseEmitter();
            sseEmitter.completeWithError(e);
            return sseEmitter;
        }
    }

}
