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
import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import static com.zhou4h.springboot3.common.JiraDataToMarkdownConstants.*;

/**
 * Jira Test 类型字段解析服务。
 * 负责从 Zephyr 接口补充 Test Details 和 Test Executions 数据。
 */
@Slf4j
@Service
public class JiraZephyrFieldParser {

    private static final String TEST_ISSUE_TYPE = "test";
    private static final String TEST_DETAILS_FIELD_NAME = "Test Details";
    private static final String TEST_EXECUTIONS_FIELD_NAME = "Test Executions";
    private static final String ZAPI_BASE_PATH = "/rest/zapi/latest";
    private static final String TEST_STEP_PATH = "/teststep/";
    private static final String EXECUTIONS_BY_TEST_PATH = "/traceability/executionsByTest?testIdOrKey=";

    /**
     * 加载 Test 类型 issue 的 Zephyr 扩展字段。
     *
     * @param searchRequest 查询请求
     * @param issueNode Jira issue 节点
     * @return 额外字段名称和数据
     */
    public Map<String, JsonNode> loadTestFields(SearchRequest searchRequest, JsonNode issueNode) {
        if (searchRequest == null || issueNode == null || !isTestIssue(issueNode)) {
            return Map.of();
        }
        if (!StringUtils.hasText(searchRequest.getApiPrefix()) || !StringUtils.hasText(searchRequest.getToken())) {
            return Map.of();
        }

        String issueId = readText(issueNode, JSON_KEY_ID);
        String issueKey = readText(issueNode, JSON_KEY_KEY);
        if (!StringUtils.hasText(issueId) && !StringUtils.hasText(issueKey)) {
            return Map.of();
        }

        String apiPrefix = normalizeApiPrefix(searchRequest.getApiPrefix());
        String authorizationHeader = normalizeAuthorizationHeader(searchRequest.getToken());
        Map<String, JsonNode> testFields = new LinkedHashMap<>();

        JsonNode testDetails = requestJsonSafely(
                apiPrefix + ZAPI_BASE_PATH + TEST_STEP_PATH + issueId,
                authorizationHeader,
                TEST_DETAILS_FIELD_NAME,
                issueId
        );
        if (testDetails != null) {
            testFields.put(TEST_DETAILS_FIELD_NAME, testDetails);
        }

        String executionsIdentifier = StringUtils.hasText(issueKey) ? issueKey : issueId;
        JsonNode testExecutions = requestJsonSafely(
                apiPrefix + ZAPI_BASE_PATH + EXECUTIONS_BY_TEST_PATH + encodeQueryValue(executionsIdentifier),
                authorizationHeader,
                TEST_EXECUTIONS_FIELD_NAME,
                executionsIdentifier
        );
        if (testExecutions != null) {
            testFields.put(TEST_EXECUTIONS_FIELD_NAME, testExecutions);
        }
        return Map.copyOf(testFields);
    }

    /**
     * 判断 issue 是否为 Test 类型。
     *
     * @param issueNode Jira issue 节点
     * @return 是否为 Test 类型
     */
    private boolean isTestIssue(JsonNode issueNode) {
        String issueType = readText(issueNode, JSON_KEY_FIELDS, JSON_KEY_ISSUETYPE, JSON_KEY_NAME);
        return TEST_ISSUE_TYPE.equalsIgnoreCase(issueType);
    }

    /**
     * 安全请求 Zephyr JSON 数据，失败时只记录日志并返回空。
     *
     * @param url 请求地址
     * @param authorizationHeader 认证头
     * @param fieldName 字段名
     * @param issueIdentifier issue 标识
     * @return 解析后的 JSON 节点
     */
    private JsonNode requestJsonSafely(String url, String authorizationHeader, String fieldName, String issueIdentifier) {
        try {
            return requestJson(url, authorizationHeader);
        } catch (CustomBaseException exception) {
            log.warn("Load {} failed for Jira test issue {}", fieldName, issueIdentifier, exception);
            return null;
        }
    }

    /**
     * 请求 Zephyr 接口并解析 JSON。
     *
     * @param url 请求地址
     * @param authorizationHeader 认证头
     * @return 解析后的 JSON
     */
    private JsonNode requestJson(String url, String authorizationHeader) {
        HttpResponse<String> response = requestResponse(url, authorizationHeader);
        if (!isSuccessfulStatus(response.statusCode())) {
            throw new CustomBaseException(
                    HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "load jira test field failed: " + response.statusCode() + LABEL_SEPARATOR + previewBody(response.body())
            );
        }
        return parseJson(response.body());
    }

    /**
     * 判断 HTTP 状态码是否为成功状态。
     *
     * @param statusCode HTTP 状态码
     * @return 是否为 2xx
     */
    private boolean isSuccessfulStatus(int statusCode) {
        return statusCode >= HTTP_SUCCESS_MIN && statusCode <= HTTP_SUCCESS_MAX;
    }

    /**
     * 发起 GET 请求。
     *
     * @param url 请求地址
     * @param authorizationHeader 认证头
     * @return HTTP 响应
     */
    private HttpResponse<String> requestResponse(String url, String authorizationHeader) {
        try {
            return HttpUtil.getAsString(
                    HttpUtil.defaultClient(false, false),
                    url,
                    Map.of(
                            HEADER_AUTHORIZATION, authorizationHeader,
                            HEADER_ACCEPT, JSON_MEDIA_TYPE,
                            HEADER_CONTENT_TYPE, JSON_MEDIA_TYPE
                    )
            );
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "load jira test field failed");
        } catch (IOException exception) {
            throw new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "load jira test field failed");
        }
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
            throw new CustomBaseException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "parse json failed");
        }
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
     * 规范化认证头。
     *
     * @param token 原始 token
     * @return 规范化后的认证头
     */
    private String normalizeAuthorizationHeader(String token) {
        if (token == null) {
            return EMPTY;
        }
        return token.trim();
    }

    /**
     * 截取响应体预览。
     *
     * @param body 响应体
     * @return 预览文本
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

    /**
     * 按路径读取文本值。
     *
     * @param node 起始节点
     * @param keys 路径
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
     * 编码查询参数值。
     *
     * @param value 原始值
     * @return 编码后的值
     */
    private String encodeQueryValue(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
