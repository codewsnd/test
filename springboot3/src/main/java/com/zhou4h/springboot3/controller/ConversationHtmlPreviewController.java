package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.dto.ConversationHtmlPreviewRequest;
import com.zhou4h.springboot3.dto.ConversationHtmlPreviewResponse;
import com.zhou4h.springboot3.exception.CustomBaseException;
import com.zhou4h.springboot3.service.ConversationHtmlPreviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@Slf4j
@RestController
@RequestMapping("/conversation/html/preview")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {
        RequestMethod.GET,
        RequestMethod.POST,
        RequestMethod.DELETE,
        RequestMethod.PUT,
        RequestMethod.OPTIONS
})
public class ConversationHtmlPreviewController {

    private final ConversationHtmlPreviewService conversationHtmlPreviewService;

    /**
     * 创建或更新 HTML 预览
     */
    @PostMapping
    public Mono<ConversationHtmlPreviewResponse> createHtmlPreview(@Valid @RequestBody ConversationHtmlPreviewRequest request) {
        return conversationHtmlPreviewService.createHtmlPreview(request)
                .map(ConversationHtmlPreviewResponse::build)
                .doOnError(error -> log.error("Failed to create HTML preview", error))
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> new CustomBaseException(
                                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                "Failed to create HTML preview"
                        )
                );
    }

    /**
     * 获取 HTML 预览内容
     */
    @GetMapping("/{id}")
    public Mono<ConversationHtmlPreviewResponse> getHtmlPreview(@PathVariable String id) {
        return conversationHtmlPreviewService.getHtmlPreviewById(id)
                .flatMap(preview -> conversationHtmlPreviewService.getHtmlContent(preview.getS3Path())
                        .map(htmlContent -> ConversationHtmlPreviewResponse.build(preview, htmlContent)))
                .doOnError(error -> log.warn("HTML preview error for id: {}", id, error))
                .onErrorMap(
                        error -> !(error instanceof CustomBaseException),
                        error -> new CustomBaseException(
                                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                "Failed to get HTML preview"
                        )
                );
    }

}
