package com.mytest.backend.conversation.vo;

import com.fasterxml.jackson.databind.JsonNode;
import com.mytest.backend.conversation.entity.ConversationHistory;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ConversationHistoryResponse {

    private String id;
    private String title;
    private JsonNode conversationState;
    private Boolean isPinned;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant pinnedAt;
    private String staffId;
    private Boolean titleGenerating;

    public static ConversationHistoryResponse from(ConversationHistory entity) {
        return ConversationHistoryResponse.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .conversationState(entity.getConversationState())
                .isPinned(entity.getIsPinned())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .pinnedAt(entity.getPinnedAt())
                .staffId(entity.getStaffId())
                .titleGenerating(entity.getTitleGenerating())
                .build();
    }
}
