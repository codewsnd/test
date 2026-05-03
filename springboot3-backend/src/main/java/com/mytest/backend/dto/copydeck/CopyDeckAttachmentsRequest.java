package com.mytest.backend.dto.copydeck;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 获取Confluence附件base64数据的请求
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CopyDeckAttachmentsRequest {

    /**
     * 员工ID
     */
    private String staffId;

    /**
     * Confluence 页面 URL
     */
    private String confluenceUrl;

    /**
     * 文件名列表
     */
    private List<String> fileNames;
}
