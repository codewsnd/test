package com.zhou4h.springboot3.service;

import com.zhou4h.springboot3.dto.ConversationHtmlShareCreateRequest;
import com.zhou4h.springboot3.dto.ConversationHtmlShareResponse;
import com.zhou4h.springboot3.entity.ConversationHtmlPreview;
import com.zhou4h.springboot3.entity.ConversationHtmlShare;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * HTML Share 业务编排服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHtmlShareBizService {

    private final ConversationHtmlShareService conversationHtmlShareService;
    private final ConversationHtmlPreviewService conversationHtmlPreviewService;

    /**
     * 创建分享或重新开启分享
     */
    public Mono<ConversationHtmlShareResponse> createHtmlShare(ConversationHtmlShareCreateRequest request) {
        return conversationHtmlShareService.createOrEnableShare(request)
                .map(this::buildShareMetaResponse)
                .onErrorResume(error -> {
                    log.error("Failed to create HTML share", error);
                    return Mono.empty();
                });
    }

    /**
     * 更新分享状态（开启/关闭）
     */
    public Mono<ConversationHtmlShareResponse> updateHtmlShareStatus(String id, Boolean enabled) {
        return conversationHtmlShareService.updateShareStatus(id, enabled)
                .map(this::buildShareMetaResponse)
                .onErrorResume(error -> {
                    log.error("Failed to update HTML share status, id: {}", id, error);
                    return Mono.empty();
                });
    }

    /**
     * 获取分享内容（关闭分享或过期时不返回 HTML）
     */
    public Mono<ConversationHtmlShareResponse> getHtmlShare(String id) {
        return conversationHtmlShareService.getHtmlShareById(id)
                .flatMap(share -> {
                    boolean expired = conversationHtmlShareService.isExpired(share);
                    if (!Boolean.TRUE.equals(share.getEnabled()) || expired) {
                        return Mono.just(buildShareMetaResponse(share, expired));
                    }

                    return conversationHtmlPreviewService.getHtmlPreviewById(share.getPreviewId())
                            .flatMap(preview -> buildShareResponseWithPreview(share, preview, expired));
                })
                .onErrorResume(error -> {
                    log.warn("HTML share error for id: {}", id, error);
                    return Mono.empty();
                });
    }

    /**
     * 根据 previewId 获取分享状态
     */
    public Mono<ConversationHtmlShareResponse> getHtmlShareByPreviewId(String previewId) {
        return conversationHtmlShareService.getHtmlShareByPreviewId(previewId)
                .map(this::buildShareMetaResponse)
                .defaultIfEmpty(ConversationHtmlShareResponse.builder()
                        .previewId(previewId)
                        .enabled(false)
                        .expired(false)
                        .build())
                .onErrorResume(error -> {
                    log.warn("HTML share status error for previewId: {}", previewId, error);
                    return Mono.empty();
                });
    }

    private Mono<ConversationHtmlShareResponse> buildShareResponseWithPreview(
            ConversationHtmlShare share,
            ConversationHtmlPreview preview,
            boolean expired
    ) {
        if (Boolean.TRUE.equals(preview.getHasXss()) || Boolean.TRUE.equals(preview.getHasExternalReferences())) {
            return Mono.just(ConversationHtmlShareResponse.builder()
                    .id(share.getId())
                    .previewId(share.getPreviewId())
                    .enabled(share.getEnabled())
                    .createdAt(share.getCreatedAt())
                    .updatedAt(share.getUpdatedAt())
                    .expiresAt(share.getExpiresAt())
                    .expired(expired)
                    .hasXss(preview.getHasXss())
                    .hasExternalReferences(preview.getHasExternalReferences())
                    .htmlContentLength(preview.getHtmlContentLength())
                    .build());
        }

        return conversationHtmlPreviewService.getHtmlContent(preview.getS3Path())
                .map(htmlContent -> ConversationHtmlShareResponse.builder()
                        .id(share.getId())
                        .previewId(share.getPreviewId())
                        .enabled(share.getEnabled())
                        .createdAt(share.getCreatedAt())
                        .updatedAt(share.getUpdatedAt())
                        .expiresAt(share.getExpiresAt())
                        .expired(expired)
                        .htmlContent(htmlContent)
                        .hasXss(preview.getHasXss())
                        .hasExternalReferences(preview.getHasExternalReferences())
                        .htmlContentLength(preview.getHtmlContentLength())
                        .build());
    }

    private ConversationHtmlShareResponse buildShareMetaResponse(ConversationHtmlShare share) {
        return buildShareMetaResponse(share, conversationHtmlShareService.isExpired(share));
    }

    private ConversationHtmlShareResponse buildShareMetaResponse(ConversationHtmlShare share, boolean expired) {
        return ConversationHtmlShareResponse.builder()
                .id(share.getId())
                .previewId(share.getPreviewId())
                .enabled(share.getEnabled())
                .createdAt(share.getCreatedAt())
                .updatedAt(share.getUpdatedAt())
                .expiresAt(share.getExpiresAt())
                .expired(expired)
                .build();
    }
}

