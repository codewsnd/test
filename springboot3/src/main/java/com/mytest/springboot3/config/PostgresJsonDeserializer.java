package com.mytest.springboot3.config;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import io.r2dbc.postgresql.codec.Json;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
public class PostgresJsonDeserializer extends JsonDeserializer<Json> {

    @Override
    public Json deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        if (p == null) {
            log.warn("JsonParser is null, returning empty JSON object");
            return Json.of("{}");
        }

        try {
            JsonNode jsonNode = p.readValueAsTree();
            if (jsonNode == null) {
                log.warn("JsonNode is null, returning empty JSON object");
                return Json.of("{}");
            }

            String jsonString = jsonNode.toString();
            if (jsonString == null || jsonString.trim().isEmpty()) {
                log.warn("JSON string is null or empty, returning empty JSON object");
                return Json.of("{}");
            }

            return Json.of(jsonString);

        } catch (JsonProcessingException e) {
            log.error("JSON processing error during deserialization", e);
            throw new IOException("Failed to process JSON: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error during JSON deserialization", e);
            throw new IOException("Unexpected error during JSON deserialization: " + e.getMessage(), e);
        }
    }
}
