package com.mytest.backend.dto;

import lombok.Data;

import java.time.OffsetDateTime;

@Data
public class AiChatResponse {

    private String content;

    private String modelName;

    private String agentName;

    private OffsetDateTime timestamp;

    private Integer characterCount;

    public AiChatResponse() {
        this.timestamp = OffsetDateTime.now();
    }

    public AiChatResponse(String content, String modelName) {
        this();
        this.content = content;
        this.modelName = modelName;
        this.characterCount = content != null? content.length() : 0;
    }

    public AiChatResponse(String content, String modelName, String agentName) {
        this(content, modelName);
        this.agentName = agentName;
    }

}
