package com.zhou4h.springboot3.vo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.zhou4h.springboot3.config.PostgresJsonDeserializer;
import com.zhou4h.springboot3.config.PostgresJsonSerializer;
import com.zhou4h.springboot3.entity.ConversationHistory;
import com.zhou4h.springboot3.util.JsonbUtil;
import io.r2dbc.postgresql.codec.Json;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
public class ConversationHistoryResponse {

    private String id;
    private String title;
    private Json conversationState;
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
