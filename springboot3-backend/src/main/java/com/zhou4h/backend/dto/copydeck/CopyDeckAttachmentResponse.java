package com.zhou4h.backend.dto.copydeck;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 获取Confluence附件base64数据的响应
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CopyDeckAttachmentResponse {

    /**
     * 图片数据列表
     */
    private List<ImageData> images;
}
