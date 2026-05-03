package com.mytest.backend.conversation.controller;

import com.mytest.backend.conversation.dto.ConversationHtmlPreviewRequest;
import com.mytest.backend.conversation.dto.ConversationHtmlPreviewResponse;
import com.mytest.backend.conversation.entity.ConversationHtmlPreviewDO;
import com.mytest.backend.conversation.service.ConversationHtmlPreviewService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/conversation/html/preview")
@RequiredArgsConstructor
@Validated
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
    public ConversationHtmlPreviewResponse createHtmlPreview(@Valid @RequestBody ConversationHtmlPreviewRequest request) {
        ConversationHtmlPreviewDO preview = conversationHtmlPreviewService.createHtmlPreview(request);
        return ConversationHtmlPreviewResponse.build(preview);
    }

    @GetMapping("/{id}")
    public ConversationHtmlPreviewResponse getHtmlPreview(@PathVariable @NotBlank String id) {
        ConversationHtmlPreviewDO preview = conversationHtmlPreviewService.getHtmlPreviewById(id);
        String htmlContent = conversationHtmlPreviewService.getHtmlContent(preview.getS3Path());
        return ConversationHtmlPreviewResponse.build(preview, htmlContent);
    }
}
