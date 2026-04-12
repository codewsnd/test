package com.zhou4h.springboot3.service;

import com.fasterxml.uuid.Generators;
import com.zhou4h.springboot3.dto.ConversationHtmlShareCreateRequest;
import com.zhou4h.springboot3.dto.ConversationHtmlPreviewRequest;
import com.zhou4h.springboot3.entity.ConversationHtmlPreview;
import com.zhou4h.springboot3.entity.ConversationHtmlShare;
import com.zhou4h.springboot3.repository.ConversationHtmlPreviewRepository;
import com.zhou4h.springboot3.repository.ConversationHtmlShareRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * HTML 分享服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHtmlShareService {

    private static final int DEFAULT_EXPIRE_DAYS = 7;

    private final ConversationHtmlShareRepository conversationHtmlShareRepository;
    private final ConversationHtmlPreviewRepository conversationHtmlPreviewRepository;
    private final ConversationHtmlPreviewService conversationHtmlPreviewService;
    private final R2dbcEntityTemplate r2dbcEntityTemplate;

    /**
     * 创建分享，或将已有分享重新开启
     */
    public Mono<ConversationHtmlShare> createOrEnableShare(ConversationHtmlShareCreateRequest request) {
        return resolvePreviewId(request)
                .flatMap(previewId -> conversationHtmlPreviewRepository.findById(previewId)
                        .switchIfEmpty(Mono.error(new RuntimeException("HTML preview not found")))
                        .flatMap(preview -> conversationHtmlShareRepository.findByPreviewId(previewId)
                        .flatMap(existing -> {
                            LocalDateTime now = LocalDateTime.now();
                            existing.setEnabled(true);
                            existing.setUpdatedAt(now);
                            existing.setExpiresAt(now.plusDays(DEFAULT_EXPIRE_DAYS));
                            return conversationHtmlShareRepository.save(existing);
                        })
                        .switchIfEmpty(Mono.defer(() -> {
                            LocalDateTime now = LocalDateTime.now();
                            UUID uuid7 = Generators.timeBasedEpochGenerator().generate();

                            ConversationHtmlShare share = ConversationHtmlShare.builder()
                                    .id(uuid7.toString())
                                    .previewId(preview.getId())
                                    .staffId(preview.getStaffId())
                                    .conversationId(preview.getConversationId())
                                    .turnId(preview.getTurnId())
                                    .enabled(true)
                                    .createdAt(now)
                                    .updatedAt(now)
                                    .expiresAt(now.plusDays(DEFAULT_EXPIRE_DAYS))
                                    .build();

                            return r2dbcEntityTemplate.insert(share);
                        }))))
                .doOnSuccess(share -> log.info("Created/enabled HTML share, id: {}, previewId: {}", share.getId(), share.getPreviewId()))
                .doOnError(error -> log.error("Failed to create/enable HTML share", error));
    }

    /**
     * 更新分享开关
     */
    public Mono<ConversationHtmlShare> updateShareStatus(String id, Boolean enabled) {
        return conversationHtmlShareRepository.findById(id)
                .switchIfEmpty(Mono.error(new RuntimeException("HTML share not found")))
                .flatMap(share -> {
                    LocalDateTime now = LocalDateTime.now();
                    share.setEnabled(enabled);
                    share.setUpdatedAt(now);
                    if (Boolean.TRUE.equals(enabled)) {
                        share.setExpiresAt(now.plusDays(DEFAULT_EXPIRE_DAYS));
                    }
                    return conversationHtmlShareRepository.save(share);
                })
                .doOnSuccess(share -> log.info("Updated HTML share status, id: {}, enabled: {}", id, enabled))
                .doOnError(error -> log.error("Failed to update HTML share status, id: {}", id, error));
    }

    /**
     * 根据分享 ID 获取分享信息
     */
    public Mono<ConversationHtmlShare> getHtmlShareById(String id) {
        return conversationHtmlShareRepository.findById(id)
                .switchIfEmpty(Mono.error(new RuntimeException("HTML share not found")))
                .flatMap(this::markExpiredIfNeeded);
    }

    public Mono<ConversationHtmlShare> getHtmlShareByPreviewId(String previewId) {
        return conversationHtmlShareRepository.findByPreviewId(previewId)
                .flatMap(this::markExpiredIfNeeded);
    }

    public boolean isExpired(ConversationHtmlShare share) {
        if (share.getExpiresAt() == null) {
            return true;
        }
        return LocalDateTime.now().isAfter(share.getExpiresAt());
    }

    private Mono<ConversationHtmlShare> markExpiredIfNeeded(ConversationHtmlShare share) {
        if (!isExpired(share) || !Boolean.TRUE.equals(share.getEnabled())) {
            return Mono.just(share);
        }
        share.setEnabled(false);
        share.setUpdatedAt(LocalDateTime.now());
        return conversationHtmlShareRepository.save(share);
    }

    private Mono<String> resolvePreviewId(ConversationHtmlShareCreateRequest request) {
        if (StringUtils.hasText(request.getPreviewId())) {
            return Mono.just(request.getPreviewId());
        }

        if (!StringUtils.hasText(request.getStaffId())
                || !StringUtils.hasText(request.getConversationId())
                || !StringUtils.hasText(request.getTurnId())
                || !StringUtils.hasText(request.getHtmlContent())) {
            return Mono.error(new RuntimeException("previewId is required, or provide staffId/conversationId/turnId/htmlContent"));
        }

        ConversationHtmlPreviewRequest previewRequest = new ConversationHtmlPreviewRequest();
        previewRequest.setStaffId(request.getStaffId());
        previewRequest.setConversationId(request.getConversationId());
        previewRequest.setTurnId(request.getTurnId());
        previewRequest.setHtmlContent(request.getHtmlContent());

        return conversationHtmlPreviewService.createHtmlPreview(previewRequest)
                .map(ConversationHtmlPreview::getId);
    }
}
