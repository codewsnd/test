package com.mytest.backend.tools.a2ui;

import io.modelcontextprotocol.spec.McpSchema;

import java.util.Map;
import java.util.function.Function;

public record A2uiToolDefinition(
        String name,
        String description,
        McpSchema.JsonSchema inputSchema,
        Function<Map<String, Object>, A2uiResource> handler
) {
}
