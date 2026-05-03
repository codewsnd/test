package com.mytest.springboot3.dto;

import lombok.Data;

/**
 * HTML 分享创建请求
 * previewId 可选：
 * 1. 传 previewId：直接创建/开启分享
 * 2. 不传 previewId：后端先创建 preview，再创建/开启分享
 */
@Data
public class ConversationHtmlShareCreateRequest {

    private String previewId;

    private String staffId;

    private String conversationId;

    private String turnId;

    private String htmlContent;
}
