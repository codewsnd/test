package com.mytest.backend.tools.a2ui;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class A2uiProtocol {

    private static final String VERSION = "v0.9";

    private A2uiProtocol() {
    }

    @SafeVarargs
    public static Map<String, Object> payload(String text, Map<String, Object>... messages) {
        return payload(text, List.of(messages));
    }

    public static Map<String, Object> payload(String text, List<Map<String, Object>> messages) {
        return obj(
                "kind", "a2ui",
                "version", VERSION,
                "text", text,
                "messages", messages
        );
    }

    public static Map<String, Object> createSurface(String surfaceId, String catalogId) {
        return message(
                "createSurface",
                obj(
                        "surfaceId", surfaceId,
                        "catalogId", catalogId
                )
        );
    }

    public static Map<String, Object> updateComponents(
            String surfaceId,
            List<Map<String, Object>> components
    ) {
        return message(
                "updateComponents",
                obj(
                        "surfaceId", surfaceId,
                        "components", components
                )
        );
    }

    public static Map<String, Object> updateDataModel(
            String surfaceId,
            String path,
            Map<String, Object> value
    ) {
        return message(
                "updateDataModel",
                obj(
                        "surfaceId", surfaceId,
                        "path", path,
                        "value", value
                )
        );
    }

    public static List<Map<String, Object>> surface(
            String surfaceId,
            String catalogId,
            List<Map<String, Object>> components,
            Map<String, Object> dataModel
    ) {
        return list(
                createSurface(surfaceId, catalogId),
                updateComponents(surfaceId, components),
                updateDataModel(surfaceId, "/", dataModel)
        );
    }

    public static Map<String, Object> component(String id, String component, Object... props) {
        Map<String, Object> payload = obj(
                "id", id,
                "component", component
        );
        payload.putAll(obj(props));
        return payload;
    }

    public static Map<String, Object> bind(String path) {
        return obj("path", path);
    }

    public static Map<String, Object> repeatedChildren(String componentId, String path) {
        return obj(
                "componentId", componentId,
                "path", path
        );
    }

    public static Map<String, Object> action(String name, Map<String, Object> context) {
        return obj(
                "event", obj(
                        "name", name,
                        "context", context
                )
        );
    }

    public static Map<String, Object> obj(Object... entries) {
        if (entries.length % 2 != 0) {
            throw new IllegalArgumentException("A2UI object entries must be key/value pairs.");
        }

        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < entries.length; i += 2) {
            Object key = entries[i];
            if (!(key instanceof String)) {
                throw new IllegalArgumentException("A2UI object keys must be strings.");
            }
            String stringKey = (String) key;
            result.put(stringKey, entries[i + 1]);
        }
        return result;
    }

    @SafeVarargs
    public static List<Map<String, Object>> list(Map<String, Object>... values) {
        return Arrays.asList(values);
    }

    private static Map<String, Object> message(String eventName, Map<String, Object> payload) {
        return obj(
                "version", VERSION,
                eventName, payload
        );
    }
}
