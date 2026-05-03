package com.mytest.springboot3.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import io.r2dbc.postgresql.codec.Json;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
public class PostgresJsonSerializer extends JsonSerializer<Json> {

    @Override
    public void serialize(Json value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
        if (gen == null) {
            log.error("JsonGenerator is null, cannot serialize");
            throw new IOException("JsonGenerator cannot be null");
        }

        if (value == null) {
            log.warn("Json value is null, writing null value");
            gen.writeNull();
            return;
        }

        try {
            String jsonString = value.asString();
            if (jsonString.trim().isEmpty()) {
                log.warn("Json string is null or empty, writing empty JSON object");
                gen.writeRawValue("{}");
            } else {
                log.debug("Successfully serializing JSON: {}", jsonString);
                gen.writeRawValue(jsonString);
            }
        } catch (Exception e) {
            log.error("Error during JSON serialization", e);
            throw new IOException("Failed to serialize JSON: " + e.getMessage(), e);
        }
    }
}
