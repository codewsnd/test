package com.zhou4h.backend.controller;

import com.zhou4h.backend.common.ApiResponse;
import com.zhou4h.backend.dto.AiChatRequest;
import com.zhou4h.backend.dto.AiChatResponse;
import com.zhou4h.backend.service.AiChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.validation.Valid;

@RestController
@RequiredArgsConstructor
@Slf4j
@CrossOrigin("*")
@RequestMapping("/deepseek")
public class DeepSeekChatController {


    private final AiChatService aiChatService;

    @PostMapping(value = "/chat/completions")
    public ApiResponse chat(@Valid @RequestBody AiChatRequest request) {
        try{
            AiChatResponse aiChatResponse = aiChatService.chat(request);
            // AiChatResponse AiChatResponse = new AiChatResponse();
            // AiChatResponse.setContent("[\"Welcome toEmail AddressDashboard\",\"Sign In\",\"设定\"]");
            // AiChatResponse.setModelName("deepseek-reasoner");
            // AiChatResponse.setAgentName("deepseek-reasoner");
            // AiChatResponse.setTimestamp(java.time.OffsetDateTime.now());
            // AiChatResponse.setCharacterCount(0);
            // return ApiResponse.success(AiChatResponse, "Chat ok");
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
