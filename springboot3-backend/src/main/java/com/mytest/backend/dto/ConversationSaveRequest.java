package com.mytest.backend.dto;

import lombok.Data;

import java.time.Instant;

@Data
public class ConversationSaveRequest {

    private String id;
    private String title;
    private String staffId;
    private Object conversationState;
    private Boolean isPinned;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant pinnedAt;
    private Boolean titleGenerating;
}
