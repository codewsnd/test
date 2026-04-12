package com.zhou4h.backend.dto;

import lombok.Data;

/**
 * PPT 生成请求参数
 */
@Data
public class PptGenerateRequest {
    /**
     * 字体名称（例如：Arial, Microsoft YaHei, SimSun）
     */
    private String font;

    /**
     * PPT 页数
     */
    private Integer pageCount;

    /**
     * PPT 标题
     */
    private String title;
}
