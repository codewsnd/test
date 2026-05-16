package com.mytest.backend.tools.a2ui;

import io.modelcontextprotocol.spec.McpSchema;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class A2uiToolSchema {

    private final Map<String, Object> properties = new LinkedHashMap<>();
    private final List<String> required = new ArrayList<>();

    private A2uiToolSchema() {
    }

    public static A2uiToolSchema object() {
        return new A2uiToolSchema();
    }

    public A2uiToolSchema optionalString(String name, String description) {
        properties.put(name, stringSchema(description));
        return this;
    }

    public A2uiToolSchema requiredString(String name, String description) {
        properties.put(name, stringSchema(description));
        required.add(name);
        return this;
    }

    public McpSchema.JsonSchema build() {
        return new McpSchema.JsonSchema(
                "object",
                new LinkedHashMap<>(properties),
                List.copyOf(required),
                false,
                null,
                null
        );
    }

    private static Map<String, Object> stringSchema(String description) {
        return Map.of(
                "type", "string",
                "description", description
        );
    }
}
