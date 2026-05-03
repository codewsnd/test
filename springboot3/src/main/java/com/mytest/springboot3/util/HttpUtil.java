package com.mytest.springboot3.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * HTTP工具类
 * 基于Java 11+ HttpClient实现
 */
@Slf4j
public class HttpUtil {

    private static final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 返回默认HttpClient。
     * 保留参数仅用于兼容已有调用，不改变当前默认客户端行为。
     */
    public static HttpClient defaultClient(boolean ignoreSslValidation, boolean followRedirects) {
        return httpClient;
    }

    /**
     * 发送GET请求
     *
     * @param url 请求URL
     * @param headers 请求头
     * @return HTTP响应
     * @throws IOException 网络异常
     * @throws InterruptedException 中断异常
     */
    public static HttpResponse<String> getAsString(String url, Map<String, String> headers)
            throws IOException, InterruptedException {
        return getAsString(httpClient, url, headers);
    }

    /**
     * 使用指定客户端发送GET请求并返回字符串响应
     *
     * @param client HTTP客户端，为null时回退到默认客户端
     * @param url 请求URL
     * @param headers 请求头
     * @return HTTP响应
     * @throws IOException 网络异常
     * @throws InterruptedException 中断异常
     */
    public static HttpResponse<String> getAsString(HttpClient client, String url, Map<String, String> headers)
            throws IOException, InterruptedException {

        log.debug("发送GET请求: {}", url);

        var requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(30));

        // 添加请求头
        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                requestBuilder.header(entry.getKey(), entry.getValue());
            }
        }

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = (client == null ? httpClient : client)
                .send(request, HttpResponse.BodyHandlers.ofString());

        log.debug("GET请求完成: {} -> {}", url, response.statusCode());
        return response;
    }

    /**
     * 发送GET请求并返回字节数组（用于图片等二进制数据）
     *
     * @param url 请求URL
     * @param headers 请求头
     * @return HTTP响应（字节数组）
     * @throws IOException 网络异常
     * @throws InterruptedException 中断异常
     */
    public static HttpResponse<byte[]> getAsBytes(String url, Map<String, String> headers)
            throws IOException, InterruptedException {

        log.debug("发送GET请求(字节): {}", url);

        var requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(30));

        // 添加请求头
        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                requestBuilder.header(entry.getKey(), entry.getValue());
            }
        }

        HttpRequest request = requestBuilder.build();
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

        log.debug("GET请求(字节)完成: {} -> {}, 数据大小: {} bytes", url, response.statusCode(),
                 response.body() != null ? response.body().length : 0);
        return response;
    }

    /**
     * 发送POST请求
     *
     * @param body 请求体对象
     * @param headers 请求头
     * @param url 请求URL
     * @return HTTP响应
     * @throws IOException 网络异常或JSON序列化异常
     * @throws InterruptedException 中断异常
     */
    public static HttpResponse<String> post(Object body, Map<String, String> headers, String url)
            throws IOException, InterruptedException {

        log.debug("发送POST请求: {}", url);

        String requestBody = convertToJson(body);

        var requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json");

        // 添加请求头
        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                requestBuilder.header(entry.getKey(), entry.getValue());
            }
        }

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        log.debug("POST请求完成: {} -> {}", url, response.statusCode());
        return response;
    }

    /**
     * 发送PUT请求
     *
     * @param body 请求体对象
     * @param headers 请求头
     * @param url 请求URL
     * @return HTTP响应
     * @throws IOException 网络异常或JSON序列化异常
     * @throws InterruptedException 中断异常
     */
    public static HttpResponse<String> put(Object body, Map<String, String> headers, String url)
            throws IOException, InterruptedException {

        log.debug("发送PUT请求: {}", url);

        String requestBody = convertToJson(body);

        var requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .PUT(HttpRequest.BodyPublishers.ofString(requestBody))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json");

        // 添加请求头
        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                requestBuilder.header(entry.getKey(), entry.getValue());
            }
        }

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        log.debug("PUT请求完成: {} -> {}", url, response.statusCode());
        return response;
    }

    /**
     * 发送DELETE请求
     *
     * @param url 请求URL
     * @param headers 请求头
     * @return HTTP响应
     * @throws IOException 网络异常
     * @throws InterruptedException 中断异常
     */
    public static HttpResponse<String> delete(String url, Map<String, String> headers)
            throws IOException, InterruptedException {

        log.debug("发送DELETE请求: {}", url);

        var requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .DELETE()
                .timeout(Duration.ofSeconds(30));

        // 添加请求头
        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                requestBuilder.header(entry.getKey(), entry.getValue());
            }
        }

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        log.debug("DELETE请求完成: {} -> {}", url, response.statusCode());
        return response;
    }



    /**
     * 发送Multipart POST请求（用于文件上传）
     * 根据Confluence REST API规范实现
     *
     * @param url 请求URL
     * @param headers 请求头
     * @param fileParts 文件部分（Map<文件名, 文件内容>）
     * @param formParts 表单部分（Map<字段名, 字段值>）
     * @return HTTP响应
     * @throws IOException 网络异常
     * @throws InterruptedException 中断异常
     */
    public static HttpResponse<String> postMultipart(String url, Map<String, String> headers,
                                                       Map<String, byte[]> fileParts,
                                                       Map<String, String> formParts)
            throws IOException, InterruptedException {

        log.debug("发送Multipart POST请求: {}", url);

        String boundary = UUID.randomUUID().toString();
        byte[] multipartBody = buildMultipartBody(boundary, fileParts, formParts);

        var requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary);

        // 添加其他请求头（跳过Content-Type，因为已经设置为multipart/form-data）
        if (headers != null) {
            for (Map.Entry<String, String> entry : headers.entrySet()) {
                // 不覆盖Content-Type和Content-Length
                if (!entry.getKey().equalsIgnoreCase("Content-Type") &&
                    !entry.getKey().equalsIgnoreCase("Content-Length")) {
                    requestBuilder.header(entry.getKey(), entry.getValue());
                }
            }
        }

        HttpRequest request = requestBuilder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        log.debug("Multipart POST请求完成: {} -> {}", url, response.statusCode());
        return response;
    }

    /**
     * 构建multipart请求体
     *
     * @param boundary 边界标识符
     * @param fileParts 文件部分
     * @param formParts 表单部分
     * @return 完整的multipart请求体字节数组
     */
    private static byte[] buildMultipartBody(String boundary, Map<String, byte[]> fileParts,
                                             Map<String, String> formParts) throws IOException {

        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // 添加表单字段
        if (formParts != null) {
            for (Map.Entry<String, String> entry : formParts.entrySet()) {
                baos.write(("--" + boundary).getBytes(StandardCharsets.UTF_8));
                baos.write("\r\n".getBytes(StandardCharsets.UTF_8));
                baos.write(("Content-Disposition: form-data; name=\"" + entry.getKey() + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                baos.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                baos.write("\r\n".getBytes(StandardCharsets.UTF_8));
            }
        }

        // 添加文件部分
        if (fileParts != null) {
            for (Map.Entry<String, byte[]> entry : fileParts.entrySet()) {
                // 边界
                baos.write(("--" + boundary).getBytes(StandardCharsets.UTF_8));
                baos.write("\r\n".getBytes(StandardCharsets.UTF_8));

                // Content-Disposition 和 Content-Type
                baos.write(("Content-Disposition: form-data; name=\"file\"; filename=\"" + entry.getKey() + "\"\r\n").getBytes(StandardCharsets.UTF_8));
                baos.write("Content-Type: application/octet-stream\r\n".getBytes(StandardCharsets.UTF_8));
                baos.write("\r\n".getBytes(StandardCharsets.UTF_8));

                // 文件数据
                baos.write(entry.getValue());

                baos.write("\r\n".getBytes(StandardCharsets.UTF_8));
            }
        }

        // 添加结束边界
        baos.write(("--" + boundary + "--").getBytes(StandardCharsets.UTF_8));
        baos.write("\r\n".getBytes(StandardCharsets.UTF_8));

        return baos.toByteArray();
    }

    /**
     * 将对象转换为JSON字符串
     */
    private static String convertToJson(Object body) throws IOException {
        if (body == null) {
            return "";
        }

        if (body instanceof String) {
            return (String) body;
        }

        try {
            return objectMapper.writeValueAsString(body);
        } catch (JsonProcessingException e) {
            log.error("JSON序列化失败: {}", e.getMessage());
            throw new IOException("JSON序列化失败: " + e.getMessage(), e);
        }
    }

}
