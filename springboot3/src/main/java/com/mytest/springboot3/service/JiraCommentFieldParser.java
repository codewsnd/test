package com.mytest.springboot3.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Iterator;
import java.util.Map;

import static com.mytest.springboot3.common.JiraDataToMarkdownConstants.*;

/**
 * Jira 字段基础内容解析服务。
 * 负责把 Jira 原始字段内容转换成更适合 Markdown 展示的文本。
 * 如果转换失败，则回退到原始内容。
 */
@Slf4j
@Service
public class JiraCommentFieldParser {

    private static final String NULL_TEXT = "null";
    private static final String FIELD_KEY_AVATAR_URLS = "avatarUrls";
    private static final String FIELD_KEY_ICON_URL = "iconUrl";
    private static final String SINGLE_COLON = ":";
    private static final String DASH_MARKER = "-";
    private static final String CARRIAGE_RETURN = "\r";

    /**
     * 不需要解析的内容
     */
    private static final String[] SKIPPED_FIELD_KEYS = {
            FIELD_KEY_AVATAR_URLS, JSON_KEY_SELF, FIELD_KEY_ICON_URL
    };

    /**
     * 判断 Jira 字段内容是否为空。
     *
     * @param jiraContent Jira 字段内容
     * @return 是否为空
     */
    public boolean isEmptyContent(JsonNode jiraContent) {
        if (jiraContent == null || jiraContent.isMissingNode() || jiraContent.isNull()) {
            return true;
        }
        if (jiraContent.isTextual()) {
            return !StringUtils.hasText(jiraContent.asText(EMPTY));
        }
        if (jiraContent.isArray()) {
            return isEmptyArrayContent(jiraContent);
        }
        if (jiraContent.isObject()) {
            return isEmptyObjectContent(jiraContent);
        }
        return false;
    }

    /**
     * 解析 Jira 字段内容。
     *
     * @param jiraContent Jira 字段内容
     * @return 解析后的 Markdown 文本
     */
    public String parseContent(JsonNode jiraContent) {
        if (jiraContent == null || jiraContent.isMissingNode()) {
            return NULL_TEXT;
        }
        if (jiraContent.isNull()) {
            return NULL_TEXT;
        }

        try {
            StringBuilder markdown = new StringBuilder();
            appendNode(markdown, jiraContent, 0);
            String parsedContent = markdown.toString().stripTrailing();
            if (StringUtils.hasText(parsedContent)) {
                return parsedContent;
            }
        } catch (Exception exception) {
            log.warn("Parse Jira content failed, fallback to raw content", exception);
        }
        return renderOriginalContent(jiraContent);
    }

    /**
     * 判断数组内容是否为空。
     *
     * @param jiraContent 数组内容
     * @return 是否为空
     */
    private boolean isEmptyArrayContent(JsonNode jiraContent) {
        if (jiraContent.isEmpty()) {
            return true;
        }

        for (JsonNode item : jiraContent) {
            if (!isEmptyContent(item)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 判断对象内容是否为空。
     *
     * @param jiraContent 对象内容
     * @return 是否为空
     */
    private boolean isEmptyObjectContent(JsonNode jiraContent) {
        Iterator<Map.Entry<String, JsonNode>> fieldIterator = jiraContent.fields();
        while (fieldIterator.hasNext()) {
            Map.Entry<String, JsonNode> fieldEntry = fieldIterator.next();
            if (!isEmptyContent(fieldEntry.getValue())) {
                return false;
            }
        }
        return true;
    }

    /**
     * 递归追加节点内容。
     *
     * @param markdown    Markdown 构建器
     * @param jiraContent Jira 节点内容
     * @param indentSize  缩进空格数
     */
    private void appendNode(StringBuilder markdown, JsonNode jiraContent, int indentSize) {
        if (isSimpleValue(jiraContent)) {
            appendSimpleLine(markdown, renderSimpleValue(jiraContent), indentSize);
            return;
        }
        if (jiraContent.isObject()) {
            appendObject(markdown, jiraContent, indentSize);
            return;
        }
        if (jiraContent.isArray()) {
            appendArray(markdown, jiraContent, indentSize);
            return;
        }
        appendSimpleLine(markdown, renderOriginalContent(jiraContent), indentSize);
    }

    /**
     * 追加对象内容。
     *
     * @param markdown    Markdown 构建器
     * @param jiraContent 对象内容
     * @param indentSize  缩进空格数
     */
    private void appendObject(StringBuilder markdown, JsonNode jiraContent, int indentSize) {
        Iterator<Map.Entry<String, JsonNode>> fieldIterator = jiraContent.fields();
        while (fieldIterator.hasNext()) {
            Map.Entry<String, JsonNode> fieldEntry = fieldIterator.next();
            appendObjectField(markdown, fieldEntry, indentSize);
        }
    }

    /**
     * 追加对象字段内容。
     *
     * @param markdown   Markdown 构建器
     * @param fieldEntry 字段条目
     * @param indentSize 缩进空格数
     */
    private void appendObjectField(StringBuilder markdown, Map.Entry<String, JsonNode> fieldEntry, int indentSize) {
        if (shouldSkipField(fieldEntry.getKey())) {
            return;
        }

        JsonNode fieldValue = fieldEntry.getValue();
        if (isEmptyContent(fieldValue)) {
            return;
        }
        if (shouldRenderInline(fieldValue)) {
            markdown.append(indent(indentSize))
                    .append(fieldEntry.getKey())
                    .append(LABEL_SEPARATOR)
                    .append(renderSimpleValue(fieldValue))
                    .append(NEW_LINE);
            return;
        }

        markdown.append(indent(indentSize))
                .append(fieldEntry.getKey())
                .append(SINGLE_COLON)
                .append(NEW_LINE);
        appendNestedValue(markdown, fieldValue, indentSize + 2);
    }

    /**
     * 判断字段是否需要跳过输出。
     *
     * @param fieldKey 字段名
     * @return 是否跳过
     */
    private boolean shouldSkipField(String fieldKey) {
        for (String skippedFieldKey : SKIPPED_FIELD_KEYS) {
            if (skippedFieldKey.equalsIgnoreCase(fieldKey)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 追加数组内容。
     *
     * @param markdown    Markdown 构建器
     * @param jiraContent 数组内容
     * @param indentSize  缩进空格数
     */
    private void appendArray(StringBuilder markdown, JsonNode jiraContent, int indentSize) {
        for (JsonNode item : jiraContent) {
            appendArrayItem(markdown, item, indentSize);
        }
    }

    /**
     * 追加数组项内容。
     *
     * @param markdown   Markdown 构建器
     * @param item       数组项
     * @param indentSize 缩进空格数
     */
    private void appendArrayItem(StringBuilder markdown, JsonNode item, int indentSize) {
        if (isEmptyContent(item)) {
            return;
        }
        if (shouldRenderInline(item)) {
            markdown.append(indent(indentSize))
                    .append(LIST_ITEM_PREFIX)
                    .append(renderSimpleValue(item))
                    .append(NEW_LINE);
            return;
        }
        if (item.isObject()) {
            appendObjectArrayItem(markdown, item, indentSize);
            return;
        }

        markdown.append(indent(indentSize))
                .append(DASH_MARKER)
                .append(NEW_LINE);
        appendNestedValue(markdown, item, indentSize + 2);
    }

    /**
     * 追加对象类型的数组项。
     *
     * @param markdown    Markdown 构建器
     * @param jiraContent 对象数组项
     * @param indentSize  缩进空格数
     */
    private void appendObjectArrayItem(StringBuilder markdown, JsonNode jiraContent, int indentSize) {
        Iterator<Map.Entry<String, JsonNode>> fieldIterator = jiraContent.fields();
        boolean firstFieldWritten = false;
        while (fieldIterator.hasNext()) {
            Map.Entry<String, JsonNode> fieldEntry = fieldIterator.next();
            JsonNode fieldValue = fieldEntry.getValue();
            if (isEmptyContent(fieldValue)) {
                continue;
            }
            if (!firstFieldWritten) {
                appendFirstArrayObjectField(markdown, fieldEntry, indentSize);
                firstFieldWritten = true;
            } else {
                appendObjectField(markdown, fieldEntry, indentSize + 2);
            }
        }
    }

    /**
     * 追加对象数组项的首个字段。
     *
     * @param markdown   Markdown 构建器
     * @param fieldEntry 字段条目
     * @param indentSize 缩进空格数
     */
    private void appendFirstArrayObjectField(StringBuilder markdown, Map.Entry<String, JsonNode> fieldEntry, int indentSize) {
        JsonNode fieldValue = fieldEntry.getValue();
        if (shouldRenderInline(fieldValue)) {
            markdown.append(indent(indentSize))
                    .append(LIST_ITEM_PREFIX)
                    .append(fieldEntry.getKey())
                    .append(LABEL_SEPARATOR)
                    .append(renderSimpleValue(fieldValue))
                    .append(NEW_LINE);
            return;
        }

        markdown.append(indent(indentSize))
                .append(LIST_ITEM_PREFIX)
                .append(fieldEntry.getKey())
                .append(SINGLE_COLON)
                .append(NEW_LINE);
        appendNestedValue(markdown, fieldValue, indentSize + 2);
    }

    /**
     * 追加嵌套值内容。
     *
     * @param markdown   Markdown 构建器
     * @param fieldValue 字段值
     * @param indentSize 缩进空格数
     */
    private void appendNestedValue(StringBuilder markdown, JsonNode fieldValue, int indentSize) {
        if (fieldValue.isObject()) {
            appendObject(markdown, fieldValue, indentSize);
            return;
        }
        if (fieldValue.isArray()) {
            appendArray(markdown, fieldValue, indentSize);
            return;
        }
        appendSimpleLine(markdown, renderOriginalContent(fieldValue), indentSize);
    }

    /**
     * 追加简单文本行。
     *
     * @param markdown    Markdown 构建器
     * @param content     文本内容
     * @param indentSize  缩进空格数
     */
    private void appendSimpleLine(StringBuilder markdown, String content, int indentSize) {
        markdown.append(indent(indentSize))
                .append(content)
                .append(NEW_LINE);
    }

    /**
     * 判断是否应按单行内联方式输出。
     *
     * @param jiraContent Jira 内容
     * @return 是否按单行方式输出
     */
    private boolean shouldRenderInline(JsonNode jiraContent) {
        if (!isSimpleValue(jiraContent)) {
            return false;
        }
        if (!jiraContent.isTextual()) {
            return true;
        }
        String content = jiraContent.asText(EMPTY);
        return !content.contains(NEW_LINE) && !content.contains(CARRIAGE_RETURN);
    }

    /**
     * 判断是否为简单值。
     *
     * @param jiraContent Jira 内容
     * @return 是否为简单值
     */
    private boolean isSimpleValue(JsonNode jiraContent) {
        return jiraContent.isTextual() || jiraContent.isNumber() || jiraContent.isBoolean();
    }

    /**
     * 渲染简单值。
     *
     * @param jiraContent Jira 内容
     * @return 渲染后的简单值
     */
    private String renderSimpleValue(JsonNode jiraContent) {
        return jiraContent.asText(EMPTY);
    }

    /**
     * 回退为原始内容。
     *
     * @param jiraContent Jira 内容
     * @return 原始内容文本
     */
    private String renderOriginalContent(JsonNode jiraContent) {
        if (jiraContent.isTextual() || jiraContent.isNumber() || jiraContent.isBoolean()) {
            return jiraContent.asText(EMPTY);
        }
        try {
            return OBJECT_MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(jiraContent);
        } catch (Exception exception) {
            return jiraContent.toString();
        }
    }

    /**
     * 生成指定数量的空格缩进。
     *
     * @param indentSize 缩进空格数
     * @return 缩进字符串
     */
    private String indent(int indentSize) {
        return SINGLE_SPACE.repeat(Math.max(indentSize, 0));
    }

}
