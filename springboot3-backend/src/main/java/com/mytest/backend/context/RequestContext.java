package com.mytest.backend.context;

import com.mytest.backend.dto.AiChatRequest;
import lombok.extern.slf4j.Slf4j;

/**
 * 请求上下文，用于在工具方法中访问当前请求的数据
 */
@Slf4j
public class RequestContext {

    private static final ThreadLocal<AiChatRequest> CURRENT_REQUEST = new ThreadLocal<>();

    /**
     * 设置当前请求
     */
    public static void setRequest(AiChatRequest request) {
        CURRENT_REQUEST.set(request);
        log.debug("Request context set for thread: {}", Thread.currentThread().getName());
    }

    /**
     * 获取当前请求
     */
    public static AiChatRequest getRequest() {
        return CURRENT_REQUEST.get();
    }

    /**
     * 清理当前请求上下文
     */
    public static void clear() {
        CURRENT_REQUEST.remove();
        log.debug("Request context cleared for thread: {}", Thread.currentThread().getName());
    }

    /**
     * 获取用户上传的图片base64数据（第一张图片）
     */
    public static String getUserImageBase64() {
        AiChatRequest request = getRequest();
        if (request == null || request.getDocuments() == null) {
            return null;
        }

        return request.getDocuments().stream()
                .filter(doc -> "image".equals(doc.getType()))
                .filter(doc -> doc.getBase64url() != null && doc.getBase64url().length > 0)
                .map(doc -> doc.getBase64url()[0])
                .findFirst()
                .orElse(null);
    }

    /**
     * 获取用户的文本消息
     */
    public static String getUserTextMessage() {
        AiChatRequest request = getRequest();
        if (request == null || request.getMessages() == null) {
            return null;
        }

        return request.getMessages().stream()
                .filter(msg -> "user".equalsIgnoreCase(msg.getRole()))
                .reduce((first, second) -> second) // 获取最后一条user消息
                .map(AiChatRequest.Message::getContent)
                .orElse(null);
    }
}
