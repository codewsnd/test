package com.mytest.backend.tools.a2ui;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class A2uiResourceFactory {

    private final ObjectMapper objectMapper;

    public A2uiResource create(
            String text,
            String resourceUri,
            List<Map<String, Object>> messages
    ) {
        return new A2uiResource(
                text,
                resourceUri,
                toJson(messages),
                messages
        );
    }

    public String payloadJson(A2uiResource resource) {
        return toJson(A2uiProtocol.payload(resource.text(), resource.messages()));
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize A2UI payload", e);
        }
    }
}
