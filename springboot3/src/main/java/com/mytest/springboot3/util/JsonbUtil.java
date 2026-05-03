package com.mytest.springboot3.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.r2dbc.postgresql.codec.Json;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class JsonbUtil {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 将JSONB对象转换为Map
     */
    public static Map<String, Object> toMap(Json json) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json.asString(),
                    new TypeReference<>() {
                    });
        } catch (Exception e) {
            throw new RuntimeException("Error parsing JSON to Map", e);
        }
    }

    /**
     * 将Map转换为JSONB对象
     */
    public static Json fromMap(Map<String, Object> data) {
        if (data == null) return null;
        try {
            return Json.of(objectMapper.writeValueAsString(data));
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Error serializing Map to JSON", e);
        }
    }

    /**
     * 获取实体对象的JSONB字段作为Map
     */
    public static <T> Map<String, Object> getJsonbAsMap(T entity, String fieldName) {
        try {
            var field = entity.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            Json json = (Json) field.get(entity);
            return toMap(json);
        } catch (Exception e) {
            throw new RuntimeException("Error getting JSONB field as Map", e);
        }
    }

    /**
     * 设置实体对象的JSONB字段从Map
     */
    public static <T> void setJsonbFromMap(T entity, String fieldName, Map<String, Object> data) {
        try {
            var field = entity.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(entity, fromMap(data));
        } catch (Exception e) {
            throw new RuntimeException("Error setting JSONB field from Map", e);
        }
    }
}
