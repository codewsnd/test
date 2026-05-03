package com.mytest.springboot3.controller;

import com.mytest.springboot3.dto.ConversationHtmlShareCreateRequest;
import com.mytest.springboot3.dto.ConversationHtmlShareResponse;
import com.mytest.springboot3.dto.ConversationHtmlShareStatusUpdateRequest;
import com.mytest.springboot3.service.ConversationHtmlShareBizService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

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

    /**
     * 创建分享或重新开启分享
     */
    @PostMapping
    public Mono<ConversationHtmlShareResponse> createHtmlShare(
            @Valid @RequestBody ConversationHtmlShareCreateRequest request
    ) {
        return conversationHtmlShareBizService.createHtmlShare(request);
    }

    /**
     * 更新分享状态（开启/关闭）
     */
    @PutMapping("/{id}/status")
    public Mono<ConversationHtmlShareResponse> updateHtmlShareStatus(
            @PathVariable String id,
            @Valid @RequestBody ConversationHtmlShareStatusUpdateRequest request
    ) {
        return conversationHtmlShareBizService.updateHtmlShareStatus(id, request.getEnabled());
    }

    /**
     * 获取分享内容（关闭分享时不返回 HTML）
     */
    @GetMapping("/{id}")
    public Mono<ConversationHtmlShareResponse> getHtmlShare(@PathVariable String id) {
        return conversationHtmlShareBizService.getHtmlShare(id);
    }

    /**
     * 根据预览 ID 获取分享状态（用于前端渲染分享开关和过期时间）
     */
    @GetMapping("/preview/{previewId}")
    public Mono<ConversationHtmlShareResponse> getHtmlShareByPreviewId(@PathVariable String previewId) {
        return conversationHtmlShareBizService.getHtmlShareByPreviewId(previewId);
    }
}

