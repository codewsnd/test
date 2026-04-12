package com.zhou4h.springboot3.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.zhou4h.springboot3.dto.SearchRequest;
import com.zhou4h.springboot3.exception.CustomBaseException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.zhou4h.springboot3.common.JiraDataToMarkdownConstants.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class JiraDataToMarkdownService {

    private static final String ISSUE_ID_KEY_TITLE_PREFIX = "Jira Issue ID/KEY: ";
    private static final String SUMMARY_JIRA_TITLE = "Jira Summary/Title";

    private final JiraFieldService jiraFieldService;
    private final JiraCommentFieldParser jiraCommentFieldParser;
    private final JiraEspecialFieldParser jiraEspecialFieldParser;

    /**
     * 将 Jira 响应转换为 Markdown。
     * 支持处理以下两类 Jira 接口返回结果：
     * 1. POST /rest/api/{version}/search 返回的 issues 数组结构。
     * 2. GET /rest/api/{version}/issue/{key} 返回的单个 issue 对象结构。
     * 转换字段标题时，优先用响应里自带的 names；如果没带，再去查 Jira 的字段目录。
     *
     * @param searchRequest 查询请求
     * @param searchResponse Jira HTTP 响应
     * @return Markdown 文本
     */
    public String convertJiraDataToMarkdown(SearchRequest searchRequest, HttpResponse<String> searchResponse) {
        String issueId = EMPTY;
        String issueKey = EMPTY;

        try {
            JsonNode payload = parseJson(searchResponse.body());
            JsonNode logIssueNode = resolveLogIssueNode(payload);
            issueId = readText(logIssueNode, JSON_KEY_ID);
            issueKey = readText(logIssueNode, JSON_KEY_KEY);

            Map<String, String> fieldNameMap = resolveFieldNameMap(searchRequest, payload);
            List<JsonNode> issueNodes = extractIssueNodes(payload);

            if (issueNodes.isEmpty()) {
                return ISSUE_ID_KEY_TITLE_PREFIX + issueKey + DOUBLE_NEW_LINE + SEARCH_EMPTY_DOCUMENT_BODY;
            }

            StringBuilder markdown = new StringBuilder();
            for (int index = 0; index < issueNodes.size(); index++) {
                appendIssueMarkdown(markdown, issueNodes.get(index), fieldNameMap);
            }

            String markdownContent = markdown.toString().trim();
            log.info("Completed Jira to Markdown conversion, id={}, key={}", issueId, issueKey);
            return markdownContent;
        } catch (Exception exception) {
            log.error("Failed Jira to Markdown conversion, id={}, key={}", issueId, issueKey, exception);
            return "Failed Jira Key"+issueKey+" to Markdown conversion"+DOUBLE_NEW_LINE;
        }
    }

    /**
     * 追加单个 issue 的 Markdown 内容。
     *
     * @param markdown     Markdown 构建器
     * @param issueNode    issue 节点
     * @param fieldNameMap 字段名称映射
     */
    private void appendIssueMarkdown(StringBuilder markdown, JsonNode issueNode, Map<String, String> fieldNameMap) {
        String issueKey = readText(issueNode, JSON_KEY_KEY);
        if (!StringUtils.hasText(issueKey)) {
            issueKey = readText(issueNode, JSON_KEY_ID);
        }
        if (!StringUtils.hasText(issueKey)) {
            issueKey = UNKNOWN_ISSUE_IDENTIFIER;
        }

        markdown.append(FIRST_LEVEL_HEADING)
                .append(ISSUE_ID_KEY_TITLE_PREFIX)
                .append(issueKey)
                .append(DOUBLE_NEW_LINE);
        appendIssueFields(markdown, issueNode.path(JSON_KEY_FIELDS), fieldNameMap);
    }

    /**
     * 解析字段名称映射。
     * 优先使用响应体自带的 names 字段，并保留字段目录服务作为兜底。
     *
     * @param searchRequest 查询请求
     * @param payload Jira 响应体
     * @return 字段名称映射
     */
    private Map<String, String> resolveFieldNameMap(SearchRequest searchRequest, JsonNode payload) {
        Map<String, String> fieldNameMap = new LinkedHashMap<>(jiraFieldService.loadVisibleFieldCatalog(searchRequest));
        appendPayloadFieldNames(fieldNameMap, payload.path(JSON_KEY_NAMES));
        return fieldNameMap;
    }

    /**
     * 解析日志要使用的 issue 节点。
     * search 结果取第一个 issue，issue 详情接口直接使用当前节点。
     *
     * @param payload Jira 响应体
     * @return 用于日志输出的 issue 节点
     */
    private JsonNode resolveLogIssueNode(JsonNode payload) {
        JsonNode issuesNode = payload.path(JSON_KEY_ISSUES);
        if (issuesNode.isArray() && !issuesNode.isEmpty()) {
            return issuesNode.get(0);
        }
        if (isSingleIssuePayload(payload)) {
            return payload;
        }
        return payload.path(JSON_KEY_ISSUES).path(0);
    }

    /**
     * 提取要渲染的 issue 节点列表。
     * 兼容 search 接口的 issues 数组和 issue 详情接口的单个 issue 对象。
     *
     * @param payload Jira 响应体
     * @return issue 节点列表
     */
    private List<JsonNode> extractIssueNodes(JsonNode payload) {
        JsonNode issuesNode = payload.path(JSON_KEY_ISSUES);
        if (issuesNode.isArray()) {
            List<JsonNode> issueNodes = new ArrayList<>();
            issuesNode.forEach(issueNodes::add);
            return issueNodes;
        }
        if (isSingleIssuePayload(payload)) {
            return List.of(payload);
        }
        return List.of();
    }

    /**
     * 把响应体中的 names 字段写入字段名称映射。
     *
     * @param fieldNameMap 字段名称映射
     * @param namesNode 响应体中的 names 节点
     */
    private void appendPayloadFieldNames(Map<String, String> fieldNameMap, JsonNode namesNode) {
        if (!namesNode.isObject()) {
            return;
        }

        Iterator<Map.Entry<String, JsonNode>> namesIterator = namesNode.fields();
        while (namesIterator.hasNext()) {
            Map.Entry<String, JsonNode> fieldEntry = namesIterator.next();
            String fieldName = fieldEntry.getValue().asText(EMPTY);
            if (!StringUtils.hasText(fieldEntry.getKey()) || !StringUtils.hasText(fieldName)) {
                continue;
            }
            fieldNameMap.put(fieldEntry.getKey(), fieldName);
        }
    }

    /**
     * 判断是否为单个 issue 详情响应。
     *
     * @param payload Jira 响应体
     * @return 是否为单个 issue 响应
     */
    private boolean isSingleIssuePayload(JsonNode payload) {
        return payload.isObject() && payload.path(JSON_KEY_FIELDS).isObject();
    }

    /**
     * 追加 issue 中的 fields 内容。
     *
     * @param markdown     Markdown 构建器
     * @param fieldsNode   fields 节点
     * @param fieldNameMap 字段名称映射
     */
    private void appendIssueFields(StringBuilder markdown, JsonNode fieldsNode, Map<String, String> fieldNameMap) {
        if (!fieldsNode.isObject()) {
            if (jiraCommentFieldParser.isEmptyContent(fieldsNode)) {
                return;
            }
            String fieldContent = jiraCommentFieldParser.parseContent(fieldsNode);
            if (!StringUtils.hasText(fieldContent)) {
                return;
            }
            markdown.append(fieldContent).append(NEW_LINE);
            return;
        }

        Iterator<Map.Entry<String, JsonNode>> fieldIterator = fieldsNode.fields();
        while (fieldIterator.hasNext()) {
            Map.Entry<String, JsonNode> fieldEntry = fieldIterator.next();
            appendSingleField(markdown, fieldEntry.getKey(), fieldEntry.getValue(), fieldNameMap);
        }
    }

    /**
     * 追加单个字段内容。
     *
     * @param markdown     Markdown 构建器
     * @param fieldId      字段 ID
     * @param fieldValue   字段值
     * @param fieldNameMap 字段名称映射
     */
    private void appendSingleField(StringBuilder markdown, String fieldId, JsonNode fieldValue, Map<String, String> fieldNameMap) {
        if (jiraCommentFieldParser.isEmptyContent(fieldValue)) {
            return;
        }

        String fieldName = fieldNameMap.get(fieldId);
        if (!StringUtils.hasText(fieldName)) {
            fieldName = fieldId;
        }
        if (JSON_KEY_SUMMARY.equalsIgnoreCase(fieldId)) {
            fieldName = SUMMARY_JIRA_TITLE;
        }

        String fieldContent = renderFieldValue(fieldId, fieldName, fieldValue);
        if (!StringUtils.hasText(fieldContent)) {
            return;
        }

        markdown.append(SECOND_LEVEL_HEADING).append(fieldName).append(NEW_LINE);
        markdown.append(fieldContent).append(DOUBLE_NEW_LINE);
    }

    /**
     * 渲染字段值。
     * 优先尝试特殊字段解析，失败时回退到通用解析。
     *
     * @param fieldId 字段 ID
     * @param fieldName 字段名称
     * @param fieldValue 字段值
     * @return 渲染后的文本
     */
    private String renderFieldValue(String fieldId, String fieldName, JsonNode fieldValue) {
        String specialFieldContent = jiraEspecialFieldParser.parseEspecialField(fieldId, fieldName, fieldValue);
        if (StringUtils.hasText(specialFieldContent)) {
            return specialFieldContent;
        }
        return jiraCommentFieldParser.parseContent(fieldValue);
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

}
