package com.mytest.backend.conversation.controller;

import com.mytest.backend.conversation.dto.ConversationHtmlShareCreateRequest;
import com.mytest.backend.conversation.dto.ConversationHtmlShareResponse;
import com.mytest.backend.conversation.dto.ConversationHtmlShareStatusUpdateRequest;
import com.mytest.backend.conversation.service.ConversationHtmlShareBizService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/conversation/html/preview/share")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {
        RequestMethod.GET,
        RequestMethod.POST,
        RequestMethod.DELETE,
        RequestMethod.PUT,
        RequestMethod.OPTIONS
})
public class ConversationHtmlShareController {

    private final ConversationHtmlShareBizService conversationHtmlShareBizService;

    @PostMapping
    public ConversationHtmlShareResponse createHtmlShare(
            @Valid @RequestBody ConversationHtmlShareCreateRequest request) {
        return conversationHtmlShareBizService.createHtmlShare(request);
    }

    @PutMapping("/{id}/status")
    public ConversationHtmlShareResponse updateHtmlShareStatus(
            @PathVariable String id,
            @Valid @RequestBody ConversationHtmlShareStatusUpdateRequest request) {
        return conversationHtmlShareBizService.updateHtmlShareStatus(id, request.getEnabled());
    }

    @GetMapping("/{id}")
    public ConversationHtmlShareResponse getHtmlShare(@PathVariable String id) {
        return conversationHtmlShareBizService.getHtmlShare(id);
    }

    @GetMapping("/preview/{previewId}")
    public ConversationHtmlShareResponse getHtmlShareByPreviewId(@PathVariable String previewId) {
        return conversationHtmlShareBizService.getHtmlShareByPreviewId(previewId);
    }
}
