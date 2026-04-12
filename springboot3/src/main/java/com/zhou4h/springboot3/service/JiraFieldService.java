package com.zhou4h.springboot3.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.zhou4h.springboot3.dto.SearchRequest;
import com.zhou4h.springboot3.exception.CustomBaseException;
import com.zhou4h.springboot3.util.HttpUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static com.zhou4h.springboot3.common.JiraDataToMarkdownConstants.*;

/**
 * Jira 字段服务。
 * 负责调用 Jira field 接口获取字段 ID 与字段名称映射，并缓存在内存中。
 */
@Slf4j
@Service
public class JiraFieldService {

    private final Map<String, Map<String, String>> allFieldNameCache = new ConcurrentHashMap<>();

    /**
     * 加载 Jira 实例上的字段定义，并缓存字段 ID 到字段名称的映射。
     *
     * @param searchRequest 查询请求
     * @return 字段 ID 到字段名称的映射
     */
    public Map<String, String> loadVisibleFieldCatalog(SearchRequest searchRequest) {
        if (searchRequest == null) {
            return Map.of();
        }
        if (!StringUtils.hasText(searchRequest.getApiPrefix()) || !StringUtils.hasText(searchRequest.getToken())) {
            return Map.of();
        }

        try {
            String apiPrefix = normalizeApiPrefix(searchRequest.getApiPrefix());
            String apiVersion = normalizeApiVersion(searchRequest.getApiVersion());
            String cacheKey = apiPrefix + SLASH + apiVersion;
            return allFieldNameCache.computeIfAbsent(
                    cacheKey,
                    ignored -> requestVisibleFieldCatalog(apiPrefix, apiVersion, searchRequest.getToken())
            );
        } catch (CustomBaseException exception) {
            log.warn("Load visible Jira field catalog failed, fallback to raw field id", exception);
            return Map.of();
        }
    }

    /**
     * 调用 Jira 字段接口并构建字段名称映射。
     *
     * @param apiPrefix  Jira 地址前缀
     * @param apiVersion Jira API 版本
     * @param token      认证信息
     * @return 字段 ID 到字段名称的映射
     */
    private Map<String, String> requestVisibleFieldCatalog(String apiPrefix, String apiVersion, String token) {
        String url = apiPrefix + "/rest/api/" + apiVersion + FIELD_CATALOG_PATH;
        HttpResponse<String> fieldResponse = requestFieldCatalogResponse(url, token);
        JsonNode fieldArray = parseCatalogResponse(fieldResponse);
        Map<String, String> fieldNameMap = new LinkedHashMap<>();

        if (!fieldArray.isArray()) {
            return Map.copyOf(fieldNameMap);
        }

        for (JsonNode fieldNode : fieldArray) {
            addFieldName(fieldNameMap, fieldNode);
        }
        return Map.copyOf(fieldNameMap);
    }

    /**
     * 发起字段目录查询请求。
     *
     * @param url   请求地址
     * @param token 认证信息
     * @return HTTP 响应
     */
    private HttpResponse<String> requestFieldCatalogResponse(String url, String token) {
        try {
            return HttpUtil.getAsString(HttpUtil.defaultClient(false, false), url, Map.of(
                    HEADER_AUTHORIZATION, normalizeAuthorizationHeader(token),
                    HEADER_ACCEPT, JSON_MEDIA_TYPE,
                    HEADER_CONTENT_TYPE, JSON_MEDIA_TYPE
            ));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new CustomBaseException(
                    HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "load jira field metadata failed"
            );
        } catch (IOException exception) {
            throw new CustomBaseException(
                    HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "load jira field metadata failed"
            );
        }
    }

    /**
     * 校验字段接口响应并解析 JSON。
     *
     * @param fieldResponse 字段接口响应
     * @return 解析后的 JSON 节点
     */
    private JsonNode parseCatalogResponse(HttpResponse<String> fieldResponse) {
        if (fieldResponse.statusCode() < HTTP_SUCCESS_MIN || fieldResponse.statusCode() > HTTP_SUCCESS_MAX) {
            throw new CustomBaseException(
                    HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "load jira field metadata failed: " + fieldResponse.statusCode() + LABEL_SEPARATOR + previewBody(fieldResponse.body())
            );
        }
        return parseJson(fieldResponse.body());
    }

    /**
     * 将字段节点写入字段名称映射。
     *
     * @param fieldNameMap 字段名称映射
     * @param fieldNode    字段节点
     */
    private void addFieldName(Map<String, String> fieldNameMap, JsonNode fieldNode) {
        String fieldId = readText(fieldNode, JSON_KEY_ID);
        String fieldName = readText(fieldNode, JSON_KEY_NAME);
        if (!StringUtils.hasText(fieldId) || !StringUtils.hasText(fieldName)) {
            return;
        }
        fieldNameMap.put(fieldId, fieldName);
    }

    /**
     * 解析 JSON 字符串。
     *
     * @param body JSON 文本
     * @return JSON 节点
     */
    private JsonNode parseJson(String body) {
        try {
            return OBJECT_MAPPER.readTree(body);
        } catch (Exception exception) {
            throw new CustomBaseException(
                    HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "parse json failed"
            );
        }
    }

    /**
     * 按路径读取文本值。
     *
     * @param node 起始节点
     * @param keys 路径 key
     * @return 文本值
     */
    private String readText(JsonNode node, String... keys) {
        JsonNode currentNode = node;
        for (String key : keys) {
            if (currentNode == null || currentNode.isNull() || currentNode.isMissingNode()) {
                return EMPTY;
            }
            currentNode = currentNode.path(key);
        }
        if (currentNode == null || currentNode.isNull() || currentNode.isMissingNode()) {
            return EMPTY;
        }
        return currentNode.asText(EMPTY);
    }

    /**
     * 规范化 Jira 地址前缀。
     *
     * @param apiPrefix 原始地址前缀
     * @return 规范化后的地址前缀
     */
    private String normalizeApiPrefix(String apiPrefix) {
        String normalizedApiPrefix = apiPrefix == null ? EMPTY : TRAILING_SLASHES.matcher(apiPrefix.trim()).replaceAll(EMPTY);
        if (!StringUtils.hasText(normalizedApiPrefix)) {
            throw new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "apiPrefix cannot be blank");
        }
        return normalizedApiPrefix;
    }

    /**
     * 规范化 Jira API 版本。
     *
     * @param apiVersion 原始 API 版本
     * @return 规范化后的 API 版本
     */
    private String normalizeApiVersion(String apiVersion) {
        if (!StringUtils.hasText(apiVersion)) {
            return DEFAULT_API_VERSION;
        }

        String normalizedApiVersion = apiVersion.trim().replace('\\', '/');
        normalizedApiVersion = API_VERSION_PREFIX.matcher(normalizedApiVersion).replaceFirst(EMPTY);
        normalizedApiVersion = EDGE_SLASHES.matcher(normalizedApiVersion).replaceAll(EMPTY);
        if (!StringUtils.hasText(normalizedApiVersion)) {
            return DEFAULT_API_VERSION;
        }
        return normalizedApiVersion;
    }

    /**
     * 规范化认证头。
     *
     * @param token 原始 token
     * @return 规范化后的认证头内容
     */
    private String normalizeAuthorizationHeader(String token) {
        if (token == null) {
            return EMPTY;
        }
        return token.trim();
    }

    /**
     * 截取响应体预览文本。
     *
     * @param body 响应体
     * @return 响应体预览
     */
    private String previewBody(String body) {
        if (body == null) {
            return EMPTY;
        }
        if (body.length() <= RESPONSE_BODY_PREVIEW_LENGTH) {
            return body;
        }
        return body.substring(0, RESPONSE_BODY_PREVIEW_LENGTH);
    }
}
