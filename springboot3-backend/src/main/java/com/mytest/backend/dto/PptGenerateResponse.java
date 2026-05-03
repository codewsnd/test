package com.mytest.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * PPT 生成响应
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PptGenerateResponse {
    /**
     * 是否成功
     */
    private Boolean success;

    /**
     * 消息
     */
    private String message;

    /**
     * Base64 编码的 PPT 文件内容
     */
    private String pptBase64;

    /**
     * 文件名
     */
    private String fileName;

    public static PptGenerateResponse success(String pptBase64, String fileName) {
        return new PptGenerateResponse(true, "PPT 生成成功", pptBase64, fileName);
    }

    public static PptGenerateResponse error(String message) {
        return new PptGenerateResponse(false, message, null, null);
    }
}
