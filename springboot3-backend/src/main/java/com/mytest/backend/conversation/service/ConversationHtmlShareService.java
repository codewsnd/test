package com.mytest.backend.conversation.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.uuid.Generators;
import com.mytest.backend.conversation.dto.ConversationHtmlPreviewRequest;
import com.mytest.backend.conversation.dto.ConversationHtmlShareCreateRequest;
import com.mytest.backend.conversation.entity.ConversationHtmlPreviewDO;
import com.mytest.backend.conversation.entity.ConversationHtmlShareDO;
import com.mytest.backend.conversation.mapper.ConversationHtmlShareMapper;
import com.mytest.backend.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHtmlShareService {

    private static final int DEFAULT_EXPIRE_DAYS = 7;

    private final ConversationHtmlShareMapper conversationHtmlShareMapper;
    private final ConversationHtmlPreviewService conversationHtmlPreviewService;

    @Transactional
    public ConversationHtmlShareDO createOrEnableShare(ConversationHtmlShareCreateRequest request) {
        try {
            String previewId = resolvePreviewId(request);
            ConversationHtmlPreviewDO preview = conversationHtmlPreviewService.getHtmlPreviewById(previewId);
            ConversationHtmlShareDO existingShare = findByPreviewId(previewId);
            LocalDateTime now = LocalDateTime.now();

            if (existingShare != null) {
                existingShare.setEnabled(Boolean.TRUE);
                existingShare.setUpdatedAt(now);
                existingShare.setExpiresAt(now.plusDays(DEFAULT_EXPIRE_DAYS));
                conversationHtmlShareMapper.updateById(existingShare);
                log.info("Created/enabled HTML share, id: {}, previewId: {}", existingShare.getId(), previewId);
                return existingShare;
            }

            UUID uuid7 = Generators.timeBasedEpochGenerator().generate();
            ConversationHtmlShareDO share = ConversationHtmlShareDO.builder()
                    .id(uuid7.toString())
                    .previewId(preview.getId())
                    .staffId(preview.getStaffId())
                    .conversationId(preview.getConversationId())
                    .turnId(preview.getTurnId())
                    .enabled(Boolean.TRUE)
                    .createdAt(now)
                    .updatedAt(now)
                    .expiresAt(now.plusDays(DEFAULT_EXPIRE_DAYS))
                    .build();

            conversationHtmlShareMapper.insert(share);
            log.info("Created/enabled HTML share, id: {}, previewId: {}", share.getId(), previewId);
            return share;
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to create/enable HTML share", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to create HTML share");
        }
    }

    @Transactional
    public ConversationHtmlShareDO updateShareStatus(String id, Boolean enabled) {
        try {
            ConversationHtmlShareDO share = conversationHtmlShareMapper.selectById(id);
            if (share == null) {
                throw new CustomException(HttpStatus.NOT_FOUND.value(), "HTML share not found");
            }

            LocalDateTime now = LocalDateTime.now();
            share.setEnabled(enabled);
            share.setUpdatedAt(now);
            if (Boolean.TRUE.equals(enabled)) {
                share.setExpiresAt(now.plusDays(DEFAULT_EXPIRE_DAYS));
            }
            conversationHtmlShareMapper.updateById(share);
            log.info("Updated HTML share status, id: {}, enabled: {}", id, enabled);
            return share;
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to update HTML share status, id: {}", id, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to update HTML share status");
        }
    }

    public ConversationHtmlShareDO getHtmlShareById(String id) {
        try {
            ConversationHtmlShareDO share = conversationHtmlShareMapper.selectById(id);
            if (share == null) {
                throw new CustomException(HttpStatus.NOT_FOUND.value(), "HTML share not found");
            }
            return markExpiredIfNeeded(share);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to get HTML share, id: {}", id, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get HTML share");
        }
    }

    public ConversationHtmlShareDO getHtmlShareByPreviewId(String previewId) {
        try {
            ConversationHtmlShareDO share = findByPreviewId(previewId);
            if (share == null) {
                return null;
            }
            return markExpiredIfNeeded(share);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to get HTML share by preview id: {}", previewId, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get HTML share");
        }
    }

    public boolean isExpired(ConversationHtmlShareDO share) {
        return share.getExpiresAt() == null || LocalDateTime.now().isAfter(share.getExpiresAt());
    }

    private ConversationHtmlShareDO markExpiredIfNeeded(ConversationHtmlShareDO share) {
        if (!isExpired(share) || !Boolean.TRUE.equals(share.getEnabled())) {
            return share;
        }
        share.setEnabled(Boolean.FALSE);
        share.setUpdatedAt(LocalDateTime.now());
        conversationHtmlShareMapper.updateById(share);
        return share;
    }

    private ConversationHtmlShareDO findByPreviewId(String previewId) {
        List<ConversationHtmlShareDO> shares = conversationHtmlShareMapper.selectList(
                Wrappers.<ConversationHtmlShareDO>lambdaQuery()
                        .eq(ConversationHtmlShareDO::getPreviewId, previewId)
                        .last("LIMIT 1")
        );
        return shares.isEmpty() ? null : shares.get(0);
    }

    private String resolvePreviewId(ConversationHtmlShareCreateRequest request) {
        if (StringUtils.hasText(request.getPreviewId())) {
            return request.getPreviewId();
        }

        if (!StringUtils.hasText(request.getStaffId())
                || !StringUtils.hasText(request.getConversationId())
                || !StringUtils.hasText(request.getTurnId())
                || !StringUtils.hasText(request.getHtmlContent())) {
            throw new CustomException(
                    HttpStatus.BAD_REQUEST.value(),
                    "previewId is required, or provide staffId/conversationId/turnId/htmlContent"
            );
        }

        ConversationHtmlPreviewRequest previewRequest = new ConversationHtmlPreviewRequest();
        previewRequest.setStaffId(request.getStaffId());
        previewRequest.setConversationId(request.getConversationId());
        previewRequest.setTurnId(request.getTurnId());
        previewRequest.setHtmlContent(request.getHtmlContent());
        return conversationHtmlPreviewService.createHtmlPreview(previewRequest).getId();
    }
}
