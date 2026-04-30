package com.zhou4h.backend.controller;

import com.zhou4h.backend.dto.ConversationHtmlPreviewRequest;
import com.zhou4h.backend.dto.ConversationHtmlPreviewResponse;
import com.zhou4h.backend.entity.ConversationHtmlPreview;
import com.zhou4h.backend.exception.CustomException;
import com.zhou4h.backend.service.ConversationHtmlPreviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

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

    @PostMapping
    public ConversationHtmlPreviewResponse createHtmlPreview(
            @RequestBody ConversationHtmlPreviewRequest request) {
        try {
            ConversationHtmlPreview preview = conversationHtmlPreviewService.createHtmlPreview(request);
            return ConversationHtmlPreviewResponse.build(preview);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to create HTML preview", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to create HTML preview");
        }
    }

    @GetMapping("/{id}")
    public ConversationHtmlPreviewResponse getHtmlPreview(@PathVariable String id) {
        try {
            ConversationHtmlPreview preview = conversationHtmlPreviewService.getHtmlPreviewById(id);
            String htmlContent = conversationHtmlPreviewService.getHtmlContent(preview.getS3Path());
            return ConversationHtmlPreviewResponse.build(preview, htmlContent);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.warn("HTML preview error for id: {}", id, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get HTML preview");
        }
    }
}
