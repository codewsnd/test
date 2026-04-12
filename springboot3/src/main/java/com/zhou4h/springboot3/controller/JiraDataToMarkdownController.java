package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.dto.Jql;
import com.zhou4h.springboot3.dto.SearchRequest;
import com.zhou4h.springboot3.exception.CustomBaseException;
import com.zhou4h.springboot3.service.JiraDataToMarkdownService;
import com.zhou4h.springboot3.util.HttpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/jira/data-markdown")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class JiraDataToMarkdownController {

    private static final String EMPTY = "";
    private static final String DEFAULT_API_VERSION = "2";
    private static final String JSON_MEDIA_TYPE = "application/json";
    private static final String ERROR_PREFIX = "Error: ";
    private static final String HEADER_AUTHORIZATION = "Authorization";
    private static final String HEADER_ACCEPT = "Accept";
    private static final String HEADER_CONTENT_TYPE = "Content-Type";
    private static final String REQUEST_KEY_JQL = "jql";
    private static final String REQUEST_KEY_START_AT = "startAt";
    private static final String REQUEST_KEY_MAX_RESULTS = "maxResults";
    private static final String REQUEST_KEY_FIELDS = "fields";
    private static final String REST_API_PATH = "/rest/api/";
    private static final String REST_API_PREFIX = "rest/api/";
    private static final String API_PREFIX = "api/";
    private static final String SEARCH_PATH = "/search";
    private static final String SLASH = "/";
    private final JiraDataToMarkdownService jiraDataToMarkdownService;

    @PostMapping(
            value = {"/convert", "/search/convert"},
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.TEXT_PLAIN_VALUE
    )
    public ResponseEntity<String> convertJiraDataToMarkdown(@RequestBody(required = false) SearchRequest request) {
        validateRequest(request);

        try {
            HttpResponse<String> response = HttpUtil.post(
                    buildSearchBody(request),
                    buildJsonHeaders(request.getToken()),
                    buildSearchUrl(request)
            );
            String markdown = jiraDataToMarkdownService.convertJiraDataToMarkdown(request, response);
            return ResponseEntity.ok(markdown);
        } catch (CustomBaseException exception) {
            throw exception;
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(ERROR_PREFIX + exception.getMessage());
        } catch (Exception exception) {
            log.error("Convert Jira data to Markdown failed", exception);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ERROR_PREFIX + exception.getMessage());
        }
    }

    private void validateRequest(SearchRequest request) {
        if (request == null) {
            throw new CustomBaseException(HttpStatus.BAD_REQUEST.value(), "request body cannot be empty");
        }
        if (isBlank(request.getApiPrefix())) {
            throw new CustomBaseException(HttpStatus.BAD_REQUEST.value(), "apiPrefix cannot be empty");
        }
        if (isBlank(request.getToken())) {
            throw new CustomBaseException(HttpStatus.BAD_REQUEST.value(), "token cannot be empty");
        }
        if (request.getJql() == null || isBlank(request.getJql().getJql())) {
            throw new CustomBaseException(HttpStatus.BAD_REQUEST.value(), "jql cannot be empty");
        }
    }

    private String buildSearchUrl(SearchRequest request) {
        String apiPrefix = normalizeApiPrefix(request.getApiPrefix());
        String apiVersion = normalizeApiVersion(request.getApiVersion());
        return apiPrefix + REST_API_PATH + apiVersion + SEARCH_PATH;
    }

    private Map<String, Object> buildSearchBody(SearchRequest request) {
        Jql jql = request.getJql();
        Map<String, Object> body = new HashMap<>();
        body.put(REQUEST_KEY_JQL, jql.getJql());
        body.put(REQUEST_KEY_START_AT, Math.max(jql.getStartAt(), 0));

        if (jql.getMaxResults() > 0) {
            body.put(REQUEST_KEY_MAX_RESULTS, jql.getMaxResults());
        }

        List<String> fields = jql.getFields();
        if (fields != null && !fields.isEmpty()) {
            body.put(REQUEST_KEY_FIELDS, new ArrayList<>(fields));
        }
        return body;
    }

    private Map<String, String> buildJsonHeaders(String token) {
        return Map.of(
                HEADER_AUTHORIZATION, token,
                HEADER_ACCEPT, JSON_MEDIA_TYPE,
                HEADER_CONTENT_TYPE, JSON_MEDIA_TYPE
        );
    }

    private String normalizeApiPrefix(String apiPrefix) {
        String normalized = apiPrefix == null ? EMPTY : apiPrefix.trim();
        while (normalized.endsWith(SLASH)) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (isBlank(normalized)) {
            throw new IllegalArgumentException("apiPrefix cannot be empty");
        }
        return normalized;
    }

    private String normalizeApiVersion(String apiVersion) {
        if (isBlank(apiVersion)) {
            return DEFAULT_API_VERSION;
        }

        String normalized = apiVersion.trim().replace('\\', '/');
        if (normalized.startsWith(SLASH)) {
            normalized = normalized.substring(1);
        }
        if (normalized.startsWith(REST_API_PREFIX)) {
            normalized = normalized.substring(REST_API_PREFIX.length());
        } else if (normalized.startsWith(API_PREFIX)) {
            normalized = normalized.substring(API_PREFIX.length());
        }
        while (normalized.endsWith(SLASH)) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return isBlank(normalized) ? DEFAULT_API_VERSION : normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
