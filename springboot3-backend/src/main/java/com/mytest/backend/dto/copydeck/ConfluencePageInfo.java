package com.mytest.backend.dto.copydeck;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConfluencePageInfo {
    private String baseUrl;
    private String spaceKey;
    private String pageId;
    private String pageTitle;
}
