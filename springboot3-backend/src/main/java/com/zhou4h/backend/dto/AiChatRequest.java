package com.zhou4h.backend.dto;

import lombok.Data;

import java.util.List;

@Data
public class AiChatRequest {

    private String conversationId;

    private String requestId;

    private String agentId;

    private String modelName;

    private List<Document> documents;

    private List<Message> messages;

    private String userJwt;

    @Data
    public static class Document {
        private String content;
        private String[] base64url;
        private String type;
        private String extension;
        private String id;
        private String name;
        // private SheetData newSheet;
    }

    @Data
    public static class Message {
        private String role;
        private String content;
    }

}
