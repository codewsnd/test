package com.mytest.backend.tools.a2ui;

import java.util.List;
import java.util.Map;

public record A2uiResource(
        String text,
        String resourceUri,
        String a2uiJson,
        List<Map<String, Object>> messages
) {

    public static final String MIME_TYPE = "application/json+a2ui";
}
