package com.mytest.backend.conversation.service;

import com.mytest.backend.conversation.dto.ConversationHtmlShareCreateRequest;
import com.mytest.backend.conversation.dto.ConversationHtmlShareResponse;
import com.mytest.backend.conversation.entity.ConversationHtmlPreviewDO;
import com.mytest.backend.conversation.entity.ConversationHtmlShareDO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ConversationHtmlShareBizService {

    private final ConversationHtmlShareService conversationHtmlShareService;
    private final ConversationHtmlPreviewService conversationHtmlPreviewService;

    public ConversationHtmlShareResponse createHtmlShare(ConversationHtmlShareCreateRequest request) {
        return buildShareMetaResponse(conversationHtmlShareService.createOrEnableShare(request));
    }

    public ConversationHtmlShareResponse updateHtmlShareStatus(String id, Boolean enabled) {
        return buildShareMetaResponse(conversationHtmlShareService.updateShareStatus(id, enabled));
    }

    public ConversationHtmlShareResponse getHtmlShare(String id) {
        ConversationHtmlShareDO share = conversationHtmlShareService.getHtmlShareById(id);
        boolean expired = conversationHtmlShareService.isExpired(share);
        if (!Boolean.TRUE.equals(share.getEnabled()) || expired) {
            return buildShareMetaResponse(share, expired);
        }

        ConversationHtmlPreviewDO preview = conversationHtmlPreviewService.getHtmlPreviewById(share.getPreviewId());
        return buildShareResponseWithPreview(share, preview, expired);
    }

    public ConversationHtmlShareResponse getHtmlShareByPreviewId(String previewId) {
        ConversationHtmlShareDO share = conversationHtmlShareService.getHtmlShareByPreviewId(previewId);
        if (share == null) {
            return ConversationHtmlShareResponse.builder()
                    .previewId(previewId)
                    .enabled(Boolean.FALSE)
                    .expired(Boolean.FALSE)
                    .build();
        }
        return buildShareMetaResponse(share);
    }

    private ConversationHtmlShareResponse buildShareResponseWithPreview(
            ConversationHtmlShareDO share,
            ConversationHtmlPreviewDO preview,
            boolean expired
    ) {
        if (Boolean.TRUE.equals(preview.getHasXss()) || Boolean.TRUE.equals(preview.getHasExternalReferences())) {
            return ConversationHtmlShareResponse.builder()
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
                    .build();
        }

        String htmlContent = conversationHtmlPreviewService.getHtmlContent(preview.getS3Path());
        return ConversationHtmlShareResponse.builder()
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
                .build();
    }

    private ConversationHtmlShareResponse buildShareMetaResponse(ConversationHtmlShareDO share) {
        return buildShareMetaResponse(share, conversationHtmlShareService.isExpired(share));
    }

    private ConversationHtmlShareResponse buildShareMetaResponse(ConversationHtmlShareDO share, boolean expired) {
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
