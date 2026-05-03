package com.mytest.springboot3.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.regex.Pattern;

import static com.mytest.springboot3.common.JiraDataToMarkdownConstants.*;

/**
 * Jira 特殊字段解析服务。
 * 当前仅对 comments 字段做更有意义的 Markdown 解析。
 */
@Slf4j
@Service
public class JiraEspecialFieldParser {

    private static final String JSON_KEY_UPDATED = "updated";
    private static final String CRLF = "\r\n";
    private static final String CARRIAGE_RETURN = "\r";
    private static final Pattern NEW_LINE_SPLIT_PATTERN = Pattern.compile(Pattern.quote(NEW_LINE));

    /**
     * 解析特殊字段。
     * 如果不是特殊字段或解析失败，则返回空字符串，由上层决定是否回退。
     *
     * @param fieldId    字段 ID
     * @param fieldName  字段名称
     * @param fieldValue 字段值
     * @return 解析后的 Markdown 文本
     */
    public String parseEspecialField(String fieldId, String fieldName, JsonNode fieldValue) {
        try {
            if (isCommentField(fieldId, fieldName)) {
                return parseCommentField(fieldValue);
            }
        } catch (Exception exception) {
            log.warn("Parse special Jira field failed, fallback to generic parser", exception);
        }
        return EMPTY;
    }

    /**
     * 判断是否为评论字段。
     *
     * @param fieldId   字段 ID
     * @param fieldName 字段名称
     * @return 是否为评论字段
     */
    private boolean isCommentField(String fieldId, String fieldName) {
        String normalizedFieldId = normalizeFieldKey(fieldId);
        String normalizedFieldName = normalizeFieldKey(fieldName);
        return JSON_KEY_COMMENT.equals(normalizedFieldId)
                || JSON_KEY_COMMENT.equals(normalizedFieldName)
                || JSON_KEY_COMMENTS.equals(normalizedFieldId)
                || JSON_KEY_COMMENTS.equals(normalizedFieldName);
    }

    /**
     * 解析评论字段。
     *
     * @param fieldValue 字段值
     * @return Markdown 文本
     */
    private String parseCommentField(JsonNode fieldValue) {
        JsonNode commentsNode = fieldValue.path(JSON_KEY_COMMENTS);
        if (!commentsNode.isArray() || commentsNode.isEmpty()) {
            return EMPTY;
        }

        StringBuilder markdown = new StringBuilder();
        int commentIndex = 1;
        for (JsonNode commentNode : commentsNode) {
            String commentMarkdown = buildSingleCommentMarkdown(commentNode, commentIndex);
            if (!StringUtils.hasText(commentMarkdown)) {
                continue;
            }
            if (markdown.length() > 0) {
                markdown.append(NEW_LINE);
            }
            markdown.append(commentMarkdown);
            commentIndex++;
        }
        return markdown.toString().stripTrailing();
    }

    /**
     * 构建单条评论的 Markdown。
     *
     * @param commentNode  评论节点
     * @param commentIndex 评论序号
     * @return Markdown 文本
     */
    private String buildSingleCommentMarkdown(JsonNode commentNode, int commentIndex) {
        String author = firstNonBlank(
                commentNode.path(JSON_KEY_AUTHOR).path(JSON_KEY_DISPLAY_NAME).asText(EMPTY),
                commentNode.path(JSON_KEY_AUTHOR).path(JSON_KEY_NAME).asText(EMPTY),
                commentNode.path(JSON_KEY_AUTHOR).path(JSON_KEY_KEY).asText(EMPTY),
                commentNode.path(JSON_KEY_AUTHOR).path(JSON_KEY_ID).asText(EMPTY)
        );
        String created = commentNode.path(JSON_KEY_CREATED).asText(EMPTY);
        String updated = commentNode.path(JSON_KEY_UPDATED).asText(EMPTY);
        String body = commentNode.path(JSON_KEY_BODY).asText(EMPTY);

        if (!StringUtils.hasText(author) && !StringUtils.hasText(created) && !StringUtils.hasText(body)) {
            return EMPTY;
        }

        StringBuilder markdown = new StringBuilder();
        markdown.append(LIST_ITEM_PREFIX).append(SECTION_LABEL_COMMENT_PREFIX).append(commentIndex);
        if (StringUtils.hasText(author)) {
            markdown.append(PIPE_SEPARATOR).append(author);
        }
        if (StringUtils.hasText(created)) {
            markdown.append(PIPE_SEPARATOR).append(created);
        }
        markdown.append(NEW_LINE);

        if (StringUtils.hasText(body)) {
            appendIndentedBlock(markdown, body, 2);
        }
        if (StringUtils.hasText(updated) && !updated.equals(created)) {
            markdown.append(indent(2))
                    .append(JSON_KEY_UPDATED)
                    .append(LABEL_SEPARATOR)
                    .append(updated)
                    .append(NEW_LINE);
        }
        return markdown.toString().stripTrailing();
    }

    /**
     * 返回第一个非空文本。
     *
     * @param values 候选文本
     * @return 第一个非空文本
     */
    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return EMPTY;
    }

    /**
     * 追加缩进块文本。
     *
     * @param markdown    Markdown 构建器
     * @param content     文本内容
     * @param indentSize  缩进空格数
     */
    private void appendIndentedBlock(StringBuilder markdown, String content, int indentSize) {
        String normalizedContent = content.replace(CRLF, NEW_LINE).replace(CARRIAGE_RETURN, NEW_LINE);
        String[] lines = NEW_LINE_SPLIT_PATTERN.split(normalizedContent, -1);
        for (String line : lines) {
            if (!StringUtils.hasText(line)) {
                continue;
            }
            markdown.append(indent(indentSize)).append(line).append(NEW_LINE);
        }
    }

    /**
     * 规范化字段标识。
     *
     * @param fieldKey 字段标识
     * @return 规范化后的标识
     */
    private String normalizeFieldKey(String fieldKey) {
        if (!StringUtils.hasText(fieldKey)) {
            return EMPTY;
        }
        return NORMALIZE_KEY.matcher(fieldKey.toLowerCase()).replaceAll(EMPTY);
    }

    /**
     * 生成缩进字符串。
     *
     * @param indentSize 缩进空格数
     * @return 缩进字符串
     */
    private String indent(int indentSize) {
        return SINGLE_SPACE.repeat(Math.max(indentSize, 0));
    }

}
