package com.mytest.backend.conversation.dto;

import lombok.Data;

@Data
public class ConversationHtmlShareCreateRequest {

    private String previewId;
    private String staffId;
    private String conversationId;
    private String turnId;
    private String htmlContent;
}
