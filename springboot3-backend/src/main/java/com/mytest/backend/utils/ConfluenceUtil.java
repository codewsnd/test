package com.mytest.backend.utils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mytest.backend.dto.ConfluencePageContent;
import com.mytest.backend.dto.copydeck.ConfluencePageInfo;
import com.mytest.backend.dto.copydeck.ImageData;
import com.mytest.backend.exception.CustomException;
import com.mytest.backend.service.CopyDeckService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
public class ConfluenceUtil {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    // JSON field names
    private static final String FIELD_NUMBER = "number";
    private static final String FIELD_VERSION = "version";
    private static final String FIELD_STORAGE = "storage";
    private static final String FIELD_TITLE = "title";
    private static final String FIELD_VALUE = "value";

    // HTTP headers and values
    private static final String HEADER_AUTHORIZATION = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    // API endpoints
    private static final String API_CONTENT_PATH = "/rest/api/content/";

    /**
     * 获取Confluence页面内容
     */
    public static ConfluencePageContent getPageContent(String confluenceUrl, String token) {
        try {
            ConfluencePageInfo pageInfo = CopyDeckService.parsePageUrl(confluenceUrl);
            String apiUrl = String.format("%s%s%s?expand=body.view,body.storage,version",
                    pageInfo.getBaseUrl(), API_CONTENT_PATH, pageInfo.getPageId());

            Map<String, String> headers = new HashMap<>();
            headers.put(HEADER_AUTHORIZATION, BEARER_PREFIX + token);

            HttpResponse<String> response = HttpUtil.getAsString(apiUrl, headers);

            if (response.statusCode() != 200) {
                throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "Failed to get page content: HTTP " + response.statusCode());
            }

            return parsePageContentFromJson(response.body());

        } catch (Exception e) {
            log.error("调用Confluence API错误: {}", e.getMessage(), e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "Failed to call Confluence API: " + e.getMessage());
        }
    }

    /**
     * 从JSON响应解析页面内容
     */
    private static ConfluencePageContent parsePageContentFromJson(String jsonBody) throws Exception {
        JsonNode jsonNode = objectMapper.readTree(jsonBody);

        ConfluencePageContent pageContent = new ConfluencePageContent();
        pageContent.setId(jsonNode.get("id").asText());
        pageContent.setTitle(jsonNode.get(FIELD_TITLE).asText());

        if (jsonNode.has("body")) {
            JsonNode bodyNode = jsonNode.get("body");
            ConfluencePageContent.Body body = new ConfluencePageContent.Body();

            if (bodyNode.has(FIELD_STORAGE)) {
                ConfluencePageContent.Body.Storage storage = new ConfluencePageContent.Body.Storage();
                storage.setValue(bodyNode.get(FIELD_STORAGE).get(FIELD_VALUE).asText());
                storage.setRepresentation(bodyNode.get(FIELD_STORAGE).get("representation").asText());
                body.setStorage(storage);
            }

            if (bodyNode.has("view")) {
                ConfluencePageContent.Body.View view = new ConfluencePageContent.Body.View();
                view.setValue(bodyNode.get("view").get(FIELD_VALUE).asText());
                body.setView(view);
            }

            pageContent.setBody(body);
        }

        if (jsonNode.has(FIELD_VERSION)) {
            JsonNode versionNode = jsonNode.get(FIELD_VERSION);
            ConfluencePageContent.Version version = new ConfluencePageContent.Version();
            if (versionNode.has(FIELD_NUMBER)) {
                version.setNumber(versionNode.get(FIELD_NUMBER).asInt());
            }
            pageContent.setVersion(version);
        }

        return pageContent;
    }


    /**
     * 使用修改后的storage内容更新页面
     */
    public static void updatePageContentWithStorage(ConfluencePageContent pageContent, String newStorageValue,
                                                    String token, String baseUrl) {
        try {
            // 构建更新请求
            Map<String, Object> updateRequest = new HashMap<>();
            updateRequest.put("id", pageContent.getId());
            updateRequest.put("type", "page");
            updateRequest.put(FIELD_TITLE, pageContent.getTitle());

            // 版本号需要递增
            Map<String, Object> version = new HashMap<>();
            version.put(FIELD_NUMBER, pageContent.getVersion().getNumber() + 1);
            updateRequest.put(FIELD_VERSION, version);

            // 设置body内容
            Map<String, Object> body = new HashMap<>();
            Map<String, Object> storage = new HashMap<>();
            storage.put(FIELD_VALUE, newStorageValue);
            storage.put("representation", FIELD_STORAGE);
            body.put(FIELD_STORAGE, storage);
            updateRequest.put("body", body);

            // 构建API URL
            String pageId = pageContent.getId();
            String apiUrl = baseUrl + API_CONTENT_PATH + pageId;

            // 准备请求头
            Map<String, String> headers = new HashMap<>();
            headers.put(HEADER_AUTHORIZATION, BEARER_PREFIX + token);

            log.debug("更新页面内容，新storage长度: {}", newStorageValue.length());

            // 发送PUT请求
            HttpResponse<String> response = HttpUtil.put(updateRequest, headers, apiUrl);

            if (response.statusCode() != 200) {
                throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "Failed to update page: HTTP " + response.statusCode() + " - " + response.body());
            }

            log.info("页面内容更新成功");
        } catch (Exception e) {
            log.error("更新页面内容失败: {}", e.getMessage(), e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "Failed to update page content: " + e.getMessage());
        }
    }


    /**
     * 上传图片到Confluence并返回文件名到附件文件名的映射
     */
    public static Map<String, String> uploadImagesToConfluence(
            List<ImageData> images,
            String pageId,
            String token,
            String baseUrl) {

        Map<String, String> fileNameMap = new HashMap<>();

        if (images == null || images.isEmpty()) {
            return fileNameMap;
        }

        // 准备请求头
        Map<String, String> headers = new HashMap<>();
        headers.put(HEADER_AUTHORIZATION, BEARER_PREFIX + token);

        // 获取页面上已有的所有附件
        Map<String, AttachmentInfo> existingAttachments = getExistingAttachments(pageId, token, baseUrl);
        log.info("页面已有 {} 个附件", existingAttachments.size());

        // 对于每个图片，检查是否已存在并上传
        for (ImageData image : images) {
            uploadSingleImage(image, pageId, baseUrl, headers, existingAttachments, fileNameMap);
        }

        return fileNameMap;
    }

    /**
     * 上传单个图片到Confluence
     */
    private static void uploadSingleImage(ImageData image,
                                          String pageId,
                                          String baseUrl,
                                          Map<String, String> headers,
                                          Map<String, AttachmentInfo> existingAttachments,
                                          Map<String, String> fileNameMap) {
        try {
            String fileName = image.getFileName();
            String base64Data = image.getBase64();

            log.debug("处理图片: {}, base64长度: {}", fileName,
                    base64Data != null ? base64Data.length() : 0);

            // 检查图片是否已存在
            if (existingAttachments.containsKey(fileName)) {
                log.info("图片已存在，跳过上传: {}", fileName);
                fileNameMap.put(fileName, fileName);
                return;
            }

            // 检查base64数据是否为空
            if (base64Data == null || base64Data.trim().isEmpty()) {
                log.warn("图片 {} 的base64数据为空，跳过上传", fileName);
                return;
            }

            // 解析并上传图片
            uploadImageToConfluence(fileName, base64Data, pageId, baseUrl, headers, fileNameMap);

        } catch (Exception e) {
            log.error("上传图片失败: {} - {}", image.getFileName(), e.getMessage(), e);
        }
    }

    /**
     * 执行图片上传到Confluence
     */
    private static void uploadImageToConfluence(String fileName,
                                                String base64Data,
                                                String pageId,
                                                String baseUrl,
                                                Map<String, String> headers,
                                                Map<String, String> fileNameMap) throws IOException, InterruptedException {
        // 解析base64数据
        byte[] imageBytes = decodeBase64Image(base64Data);

        // 上传新图片到Confluence
        String attachmentUrl = baseUrl + API_CONTENT_PATH + pageId + "/child/attachment";

        Map<String, String> uploadHeaders = new HashMap<>(headers);
        uploadHeaders.put("X-Atlassian-Token", "no-check");

        Map<String, byte[]> fileParts = new HashMap<>();
        fileParts.put(fileName, imageBytes);

        Map<String, String> formParts = new HashMap<>();
        formParts.put("comment", "Uploaded by CopyDeck");

        HttpResponse<String> response = HttpUtil.postMultipart(attachmentUrl, uploadHeaders, fileParts, formParts);

        if (response.statusCode() == 200 || response.statusCode() == 201) {
            log.info("图片上传成功: {}", fileName);
            fileNameMap.put(fileName, fileName);
        } else {
            log.error("图片上传失败: {} - HTTP {}, Response: {}", fileName, response.statusCode(), response.body());
        }
    }


    /**
     * 获取页面上已有的所有附件
     * API: GET {API_CONTENT_PATH}{id}/child/attachment
     */
    public static Map<String, AttachmentInfo> getExistingAttachments(String pageId, String token, String baseUrl) {
        Map<String, AttachmentInfo> attachments = new HashMap<>();

        try {
            // 构建API URL，获取所有附件
            String url = baseUrl + API_CONTENT_PATH + pageId + "/child/attachment?limit=999";

            Map<String, String> headers = new HashMap<>();
            headers.put(HEADER_AUTHORIZATION, BEARER_PREFIX + token);

            HttpResponse<String> response = HttpUtil.getAsString(url, headers);

            if (response.statusCode() == 200) {
                JsonNode jsonNode = objectMapper.readTree(response.body());
                JsonNode results = jsonNode.get("results");

                if (results != null && results.isArray()) {
                    for (JsonNode attachment : results) {
                        String id = attachment.get("id").asText();
                        String title = attachment.get(FIELD_TITLE).asText();
                        String version = attachment.has(FIELD_VERSION) ?
                                attachment.get(FIELD_VERSION).get(FIELD_NUMBER).asText() : "1";

                        AttachmentInfo info = new AttachmentInfo(id, title, version);
                        attachments.put(title, info);
                    }
                }

                log.debug("成功获取 {} 个已有附件", attachments.size());
            } else {
                log.warn("获取附件列表失败: HTTP {}", response.statusCode());
            }

        } catch (Exception e) {
            log.error("获取页面附件列表失败: {}", e.getMessage(), e);
        }

        return attachments;
    }

    /**
     * 附件信息
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AttachmentInfo {
        private String id;
        private String title;
        private String version;
    }

    /**
     * 解码base64图片数据
     */
    private static byte[] decodeBase64Image(String base64Data) {
        // 移除data URI前缀 (如 "data:image/png;base64,")
        if (base64Data.startsWith("data:")) {
            int commaIndex = base64Data.indexOf(',');
            if (commaIndex != -1) {
                base64Data = base64Data.substring(commaIndex + 1);
            }
        }

        return Base64.getDecoder().decode(base64Data);
    }

    /**
     * 下载图片并转换为ImageData对象
     */
    public static ImageData downloadImageAsBase64(String imageUrl, Map<String, String> headers) {
        try {
            // 对URL进行编码以处理特殊字符(如韩文、表情符号等)
            String encodedUrl = encodeUrl(imageUrl);
            log.info("下载图片 - 原始URL: {}", imageUrl);
            log.info("下载图片 - 编码后URL: {}", encodedUrl);

            HttpResponse<byte[]> response = HttpUtil.getAsBytes(encodedUrl, headers);

            log.info("下载图片 - HTTP状态码: {}", response.statusCode());

            if (response.statusCode() == 200) {
                byte[] imageBytes = response.body();
                if (imageBytes != null && imageBytes.length > 0) {
                    String contentType = response.headers()
                            .firstValue("content-type")
                            .orElse("image/png");

                    String base64Data = Base64.getEncoder().encodeToString(imageBytes);
                    String base64String = "data:" + contentType + ";base64," + base64Data;

                    // 从 URL 中提取文件名
                    String fileName = extractFileNameFromUrl(imageUrl);

                    log.info("下载图片成功 - 文件名: {}, 大小: {} bytes", fileName, imageBytes.length);
                    return new ImageData(fileName, base64String);
                } else {
                    log.warn("下载图片失败 - 响应体为空");
                }
            } else {
                log.warn("下载图片失败 - HTTP状态码: {}", response.statusCode());
            }
        } catch (Exception e) {
            log.error("下载图片失败 - URL: {}, 错误: {}", imageUrl, e.getMessage(), e);
        }

        return null;
    }


    /**
     * 对URL进行编码，处理路径中的特殊字符
     * 保持协议、主机和端口不变，只编码路径和文件名部分
     * 注意：避免重复编码已经编码过的URL
     */
    private static String encodeUrl(String url) {
        try {
            java.util.regex.Pattern urlPattern = java.util.regex.Pattern.compile(
                    "^(https?://)?([^/:?#]+)(:[0-9]+)?([^?#]*)(\\?.*)?$"
            );
            java.util.regex.Matcher matcher = urlPattern.matcher(url);

            if (!matcher.matches()) {
                log.warn("URL格式不匹配，使用原始URL: {}", url);
                return url;
            }

            String protocol = matcher.group(1);
            String host = matcher.group(2);
            String portPart = matcher.group(3);
            String path = matcher.group(4);
            String query = matcher.group(5);

            String encodedPath = encodeUrlPath(path);
            return buildEncodedUrl(protocol, host, portPart, encodedPath, query);

        } catch (Exception e) {
            log.warn("URL编码失败，使用原始URL: {}", e.getMessage());
            return url;
        }
    }

    /**
     * 编码URL路径部分
     */
    private static String encodeUrlPath(String path) {
        if (path == null || path.isEmpty()) {
            return path;
        }

        String[] pathParts = path.split("/");
        StringBuilder encodedPathBuilder = new StringBuilder();

        for (String part : pathParts) {
            if (part.isEmpty()) {
                continue;
            }

            String encodedPart = encodePathPart(part);
            encodedPathBuilder.append("/").append(encodedPart);
        }

        String encodedPath = encodedPathBuilder.toString();
        return encodedPath.isEmpty() && path.startsWith("/") ? "/" : encodedPath;
    }

    /**
     * 编码单个路径部分
     */
    private static String encodePathPart(String part) {
        boolean isAlreadyEncoded = part.matches(".*%[0-9A-Fa-f]{2}.*");

        if (isAlreadyEncoded) {
            log.debug("路径部分已编码，跳过: {}", part);
            return part;
        }

        String encodedPart = URLEncoder.encode(part, StandardCharsets.UTF_8).replace("+", "%20");
        log.debug("路径部分编码: {} -> {}", part, encodedPart);
        return encodedPart;
    }

    /**
     * 构建编码后的完整URL
     */
    private static String buildEncodedUrl(String protocol, String host, String portPart,
                                          String encodedPath, String query) {
        StringBuilder result = new StringBuilder();

        result.append(protocol != null ? protocol : "http://");
        result.append(host);

        if (portPart != null) {
            result.append(portPart);
        }
        if (encodedPath != null && !encodedPath.isEmpty()) {
            result.append(encodedPath);
        }
        if (query != null) {
            result.append(query);
        }

        String finalUrl = result.toString();
        log.debug("URL编码完成 - 结果: {}", finalUrl);
        return finalUrl;
    }

    /**
     * 从URL中提取文件名
     */
    private static String extractFileNameFromUrl(String url) {
        if (url == null || url.isEmpty()) {
            return "image.png";
        }

        try {
            // 提取URL路径部分的最后一个斜杠后的内容
            String[] parts = url.split("/");
            String lastPart = parts[parts.length - 1];

            // 如果包含查询参数，去掉它们
            if (lastPart.contains("?")) {
                lastPart = lastPart.substring(0, lastPart.indexOf("?"));
            }

            // 如果提取成功且不为空，返回文件名
            if (!lastPart.isEmpty()) {
                return lastPart;
            }
        } catch (Exception e) {
            log.debug("提取文件名失败，使用默认值: {}", e.getMessage());
        }

        return "image.png";
    }

}
