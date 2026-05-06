package com.mytest.backend.conversation.vo;

import com.mytest.backend.conversation.entity.ConversationHistory;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class ConversationHistoryResponse {

    private String id;
    private String title;
    private Object conversationState;
    private Boolean isPinned;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant pinnedAt;
    private String staffId;
    private Boolean titleGenerating;

    public static ConversationHistoryResponse from(ConversationHistory entity, Object conversationState) {
        return ConversationHistoryResponse.builder()
                .id(entity.getId())
                .title(entity.getTitle())
                .conversationState(conversationState)
                .isPinned(entity.getIsPinned())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .pinnedAt(entity.getPinnedAt())
                .staffId(entity.getStaffId())
                .titleGenerating(entity.getTitleGenerating())
                .build();
    }
}
