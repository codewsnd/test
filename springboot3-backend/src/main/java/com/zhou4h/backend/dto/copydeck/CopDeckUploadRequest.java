package com.zhou4h.backend.dto.copydeck;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 上传完整 Storage HTML 的请求参数
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CopDeckUploadRequest {

    /**
     * 员工ID
     */
    private String staffId;

    /**
     * Confluence 页面 URL
     */
    private String confluenceUrl;

    /**
     * 完整的 Confluence Storage HTML
     */
    private String storageHtml;

    /**
     * 图片数据列表
     */
    private List<ImageData> images;
}
