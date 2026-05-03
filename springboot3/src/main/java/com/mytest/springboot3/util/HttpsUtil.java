package com.mytest.springboot3.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Slf4j
public class HttpsUtil {

    private static final HttpClient httpClient;
    private static final ObjectMapper objectMapper;

    static {
        httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        objectMapper = new ObjectMapper();
        log.info("HttpUtil static class initialized with HttpClient");
    }

    // 私有构造函数防止实例化
    private HttpsUtil() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    /**
     * 发送 GET 请求并返回指定类型的对象
     */
    public static <T> T get(String url, Map<String, String> headers, Class<T> responseType) {
        try {
            log.info("Preparing GET request to: {}", url);

            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60))
                    .GET();

            // 添加请求头
            if (headers != null) {
                headers.forEach((key, value) -> {
                    requestBuilder.header(key, value);
                    log.debug("Added header: {} = {}", key, value.length() > 50 ? value.substring(0, 50) + "..." : value);
                });
            }

            HttpRequest request = requestBuilder.build();

            log.info("Sending GET request to: {}", url);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            log.info("Response received with status: {}", response.statusCode());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.debug("Request successful, parsing response body");
                T result = objectMapper.readValue(response.body(), responseType);
                log.info("Successfully parsed response to {}", responseType.getSimpleName());
                return result;
            } else {
                log.error("Request failed with status: {}, body: {}", response.statusCode(), response.body());
                throw new RuntimeException("HTTP request failed with status: " + response.statusCode());
            }

        } catch (Exception e) {
            log.error("Error sending GET request to: {} - Error: {}", url, e.getMessage(), e);
            throw new RuntimeException("Failed to send HTTP request to: " + url + " - " + e.getMessage(), e);
        }
    }

    /**
     * 发送 GET 请求并返回 List 类型
     */
    public static <T> List<T> getList(String url, Map<String, String> headers, Class<T> itemType) {
        try {
            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60))
                    .GET();

            // 添加请求头
            if (headers != null) {
                headers.forEach(requestBuilder::header);
            }

            HttpRequest request = requestBuilder.build();

            log.debug("Sending GET request to: {}", url);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.debug("Request successful, status: {}", response.statusCode());
                TypeReference<List<T>> typeRef = new TypeReference<List<T>>() {};
                return objectMapper.readValue(response.body(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, itemType));
            } else {
                log.error("Request failed with status: {}, body: {}", response.statusCode(), response.body());
                throw new RuntimeException("HTTP request failed with status: " + response.statusCode());
            }

        } catch (Exception e) {
            log.error("Error sending GET request to: {} - Error: {}", url, e.getMessage(), e);
            throw new RuntimeException("Failed to send HTTP request to: " + url + " - " + e.getMessage(), e);
        }
    }

    /**
     * 发送 POST 请求
     */
    public static <T> T post(String url, Map<String, String> headers, Object requestBody, Class<T> responseType) {
        try {
            String jsonBody = objectMapper.writeValueAsString(requestBody);

            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody));

            // 添加默认 Content-Type
            requestBuilder.header("Content-Type", "application/json");

            // 添加请求头
            if (headers != null) {
                headers.forEach(requestBuilder::header);
            }

            HttpRequest request = requestBuilder.build();

            log.debug("Sending POST request to: {}", url);
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.debug("Request successful, status: {}", response.statusCode());
                return objectMapper.readValue(response.body(), responseType);
            } else {
                log.error("Request failed with status: {}, body: {}", response.statusCode(), response.body());
                throw new RuntimeException("HTTP request failed with status: " + response.statusCode());
            }

        } catch (Exception e) {
            log.error("Error sending POST request to: {} - Error: {}", url, e.getMessage(), e);
            throw new RuntimeException("Failed to send HTTP request to: " + url + " - " + e.getMessage(), e);
        }
    }
}
