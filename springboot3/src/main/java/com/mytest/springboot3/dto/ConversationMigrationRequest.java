package com.mytest.springboot3.dto;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.mytest.springboot3.config.PostgresJsonDeserializer;
import io.r2dbc.postgresql.codec.Json;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ConversationMigrationRequest {
    private List<IndexedDbConversation> conversations;

    @Data
    public static class IndexedDbConversation {
        private String id;
        private String title;
        private Json conversationState;
        private Boolean isPinned;
        private Long createdAt;
        private Long updatedAt;
        private Long pinnedAt;
        private String userId;
        private String staffId;
        private Boolean titleGenerating;
    }
}
