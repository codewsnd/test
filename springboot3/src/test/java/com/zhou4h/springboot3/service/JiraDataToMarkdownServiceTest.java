package com.zhou4h.springboot3.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import com.zhou4h.springboot3.dto.SearchRequest;
import com.zhou4h.springboot3.exception.CustomBaseException;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.net.http.HttpResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JiraDataToMarkdownServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final JiraFieldService jiraFieldService = mock(JiraFieldService.class);
    private final JiraCommentFieldParser jiraCommentFieldParser = mock(JiraCommentFieldParser.class);
    private final JiraEspecialFieldParser jiraEspecialFieldParser = mock(JiraEspecialFieldParser.class);
    private final JiraZephyrFieldParser jiraZephyrFieldParser = mock(JiraZephyrFieldParser.class);
    private final JiraDataToMarkdownService jiraDataToMarkdownService = new JiraDataToMarkdownService(
            jiraFieldService,
            jiraCommentFieldParser,
            jiraEspecialFieldParser,
            jiraZephyrFieldParser
    );

    @Test
    void convertJiraDataToMarkdown_shouldReturnEmptyDocumentWhenIssuesMissing() {
        SearchRequest searchRequest = new SearchRequest();
        HttpResponse<String> response = mock(HttpResponse.class);

        when(jiraFieldService.loadVisibleFieldCatalog(searchRequest)).thenReturn(Map.of());
        when(response.body()).thenReturn("{\"issues\":[]}");

        assertEquals("Jira Issue ID/KEY: \n\nNo issues found.", jiraDataToMarkdownService.convertJiraDataToMarkdown(searchRequest, response));
    }

    @Test
    void convertJiraDataToMarkdown_shouldRenderIssuesWithSpecialAndGenericFields() {
        SearchRequest searchRequest = new SearchRequest();
        HttpResponse<String> response = mock(HttpResponse.class);

        when(jiraFieldService.loadVisibleFieldCatalog(searchRequest)).thenReturn(Map.of(
                "summary", "Summary",
                "comment", "Comments",
                "customfield_1", "Business Value"
        ));
        when(response.body()).thenReturn("""
                {
                  "issues": [
                    {
                      "key": "DEV-1",
                      "fields": {
                        "summary": "Login fails",
                        "comment": {
                          "comments": [
                            {
                              "body": "first line"
                            }
                          ]
                        },
                        "customfield_1": {
                          "generic": "High"
                        },
                        "blankField": {
                          "blank": "yes"
                        },
                        "emptyField": "   "
                      }
                    },
                    {
                      "id": "10002",
                      "fields": {
                        "unmapped": "Raw Value"
                      }
                    },
                    {
                      "fields": {}
                    }
                  ]
                }
                """);

        when(jiraCommentFieldParser.isEmptyContent(any())).thenAnswer(invocation -> {
            JsonNode jiraContent = invocation.getArgument(0);
            if (jiraContent == null || jiraContent.isMissingNode() || jiraContent.isNull()) {
                return true;
            }
            if (jiraContent.isTextual()) {
                return jiraContent.asText().isBlank();
            }
            return false;
        });
        when(jiraCommentFieldParser.parseContent(any())).thenAnswer(invocation -> {
            JsonNode jiraContent = invocation.getArgument(0);
            if (jiraContent == null) {
                return "";
            }
            if (jiraContent.isTextual()) {
                return jiraContent.asText();
            }
            if (jiraContent.has("generic")) {
                return jiraContent.path("generic").asText();
            }
            return "generic";
        });
        when(jiraCommentFieldParser.parseContent(argThat(jiraContent -> jiraContent != null && jiraContent.has("blank"))))
                .thenReturn("");
        when(jiraEspecialFieldParser.parseEspecialField(anyString(), anyString(), any())).thenReturn("");
        when(jiraEspecialFieldParser.parseEspecialField(
                argThat("comment"::equals),
                argThat("Comments"::equals),
                any()
        )).thenReturn("special-comment");

        String markdown = jiraDataToMarkdownService.convertJiraDataToMarkdown(searchRequest, response);

        assertTrue(markdown.contains("# Jira Issue ID/KEY: DEV-1"));
        assertTrue(markdown.contains("## Jira Summary/Title\nLogin fails"));
        assertTrue(markdown.contains("## Comments\nspecial-comment"));
        assertTrue(markdown.contains("## Business Value\nHigh"));
        assertTrue(markdown.contains("# Jira Issue ID/KEY: 10002"));
        assertTrue(markdown.contains("## unmapped\nRaw Value"));
        assertTrue(markdown.contains("# Jira Issue ID/KEY: Unknown"));
        assertFalse(markdown.contains("blankField"));
        assertFalse(markdown.contains("emptyField"));
    }

    @Test
    void convertJiraDataToMarkdown_shouldUseNamesFromSearchPayload() {
        SearchRequest searchRequest = new SearchRequest();
        HttpResponse<String> response = mock(HttpResponse.class);

        when(jiraFieldService.loadVisibleFieldCatalog(searchRequest)).thenReturn(Map.of());
        when(response.body()).thenReturn("""
                {
                  "expand": "schema,names",
                  "names": {
                    "customfield_10010": "Story Points"
                  },
                  "issues": [
                    {
                      "key": "DEV-2",
                      "fields": {
                        "customfield_10010": "8"
                      }
                    }
                  ]
                }
                """);
        when(jiraCommentFieldParser.isEmptyContent(any())).thenReturn(false);
        when(jiraCommentFieldParser.parseContent(any())).thenAnswer(invocation -> invocation.getArgument(0, JsonNode.class).asText());
        when(jiraEspecialFieldParser.parseEspecialField(anyString(), anyString(), any())).thenReturn("");

        String markdown = jiraDataToMarkdownService.convertJiraDataToMarkdown(searchRequest, response);

        assertTrue(markdown.contains("# Jira Issue ID/KEY: DEV-2"));
        assertTrue(markdown.contains("## Story Points\n8"));
    }

    @Test
    void convertJiraDataToMarkdown_shouldRenderSingleIssuePayload() {
        SearchRequest searchRequest = new SearchRequest();
        HttpResponse<String> response = mock(HttpResponse.class);

        when(jiraFieldService.loadVisibleFieldCatalog(searchRequest)).thenReturn(Map.of());
        when(response.body()).thenReturn("""
                {
                  "expand": "renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations",
                  "id": "10000",
                  "key": "DEV-1",
                  "names": {
                    "customfield_20000": "Acceptance Notes"
                  },
                  "fields": {
                    "customfield_20000": "Ready for QA"
                  }
                }
                """);
        when(jiraCommentFieldParser.isEmptyContent(any())).thenReturn(false);
        when(jiraCommentFieldParser.parseContent(any())).thenAnswer(invocation -> invocation.getArgument(0, JsonNode.class).asText());
        when(jiraEspecialFieldParser.parseEspecialField(anyString(), anyString(), any())).thenReturn("");

        String markdown = jiraDataToMarkdownService.convertJiraDataToMarkdown(searchRequest, response);

        assertFalse(markdown.contains("No issues found."));
        assertTrue(markdown.contains("# Jira Issue ID/KEY: DEV-1"));
        assertTrue(markdown.contains("## Acceptance Notes\nReady for QA"));
    }

    @Test
    void convertJiraDataToMarkdown_shouldAppendZephyrFieldsForTestIssue() throws Exception {
        SearchRequest searchRequest = new SearchRequest();
        HttpResponse<String> response = mock(HttpResponse.class);
        JsonNode testDetails = OBJECT_MAPPER.readTree("""
                {
                  "step": "Open login page"
                }
                """);
        JsonNode testExecutions = OBJECT_MAPPER.readTree("""
                {
                  "executions": [
                    {
                      "execution": {
                        "status": "PASS"
                      }
                    }
                  ]
                }
                """);

        when(jiraFieldService.loadVisibleFieldCatalog(searchRequest)).thenReturn(Map.of(
                "summary", "Summary"
        ));
        when(response.body()).thenReturn("""
                {
                  "issues": [
                    {
                      "id": "10000",
                      "key": "DEV-TEST-1",
                      "fields": {
                        "summary": "Test issue",
                        "issuetype": {
                          "name": "Test"
                        }
                      }
                    }
                  ]
                }
                """);
        when(jiraCommentFieldParser.isEmptyContent(any())).thenAnswer(invocation -> {
            JsonNode jiraContent = invocation.getArgument(0);
            if (jiraContent == null || jiraContent.isMissingNode() || jiraContent.isNull()) {
                return true;
            }
            if (jiraContent.isTextual()) {
                return jiraContent.asText().isBlank();
            }
            return false;
        });
        when(jiraCommentFieldParser.parseContent(any())).thenAnswer(invocation -> {
            JsonNode jiraContent = invocation.getArgument(0);
            if (jiraContent == null) {
                return "";
            }
            if (jiraContent.isTextual()) {
                return jiraContent.asText();
            }
            if (jiraContent.has("step")) {
                return jiraContent.path("step").asText();
            }
            if (jiraContent.path("executions").isArray() && !jiraContent.path("executions").isEmpty()) {
                return jiraContent.path("executions").get(0).path("execution").path("status").asText();
            }
            if (jiraContent.path("name").isTextual()) {
                return jiraContent.path("name").asText();
            }
            return "generic";
        });
        when(jiraEspecialFieldParser.parseEspecialField(anyString(), anyString(), any())).thenReturn("");
        when(jiraZephyrFieldParser.loadTestFields(any(), any())).thenReturn(Map.of(
                "Test Details", testDetails,
                "Test Executions", testExecutions
        ));

        String markdown = jiraDataToMarkdownService.convertJiraDataToMarkdown(searchRequest, response);

        assertTrue(markdown.contains("# Jira Issue ID/KEY: DEV-TEST-1"));
        assertTrue(markdown.contains("## Jira Summary/Title\nTest issue"));
        assertTrue(markdown.contains("## Test Details\nOpen login page"));
        assertTrue(markdown.contains("## Test Executions\nPASS"));
    }

    @Test
    void convertJiraDataToMarkdown_shouldReturnFailureMessageWhenResponseBodyIsInvalidJson() {
        SearchRequest searchRequest = new SearchRequest();
        HttpResponse<String> response = mock(HttpResponse.class);

        when(jiraFieldService.loadVisibleFieldCatalog(searchRequest)).thenReturn(Map.of());
        when(response.body()).thenReturn("not-json");

        assertEquals("Failed Jira Key to Markdown conversion\n\n", jiraDataToMarkdownService.convertJiraDataToMarkdown(searchRequest, response));
    }

    @Test
    void convertJiraDataToMarkdown_shouldReturnFailureMessageWithJiraKeyWhenConversionFails() {
        SearchRequest searchRequest = new SearchRequest();
        HttpResponse<String> response = mock(HttpResponse.class);

        when(jiraFieldService.loadVisibleFieldCatalog(searchRequest)).thenThrow(new RuntimeException("boom"));
        when(response.body()).thenReturn("""
                {
                  "id": "10000",
                  "key": "DEV-1",
                  "fields": {
                    "summary": "Login fails"
                  }
                }
                """);

        assertEquals("Failed Jira KeyDEV-1 to Markdown conversion\n\n", jiraDataToMarkdownService.convertJiraDataToMarkdown(searchRequest, response));
    }

    @Test
    void privateHelpers_shouldCoverUnknownIssueAndNonObjectFieldPaths() throws Exception {
        when(jiraCommentFieldParser.isEmptyContent(any())).thenAnswer(invocation -> {
            JsonNode jiraContent = invocation.getArgument(0);
            return jiraContent == null || jiraContent.isMissingNode();
        });
        when(jiraCommentFieldParser.parseContent(any())).thenReturn("root-content");

        Method appendIssueFieldsMethod = JiraDataToMarkdownService.class.getDeclaredMethod(
                "appendIssueFields",
                StringBuilder.class,
                JsonNode.class,
                Map.class
        );
        appendIssueFieldsMethod.setAccessible(true);

        StringBuilder emptyBuilder = new StringBuilder();
        appendIssueFieldsMethod.invoke(jiraDataToMarkdownService, emptyBuilder, MissingNode.getInstance(), Map.of());
        assertEquals("", emptyBuilder.toString());

        StringBuilder contentBuilder = new StringBuilder();
        appendIssueFieldsMethod.invoke(jiraDataToMarkdownService, contentBuilder, TextNode.valueOf("root"), Map.of());
        assertEquals("root-content\n", contentBuilder.toString());

        when(jiraCommentFieldParser.isEmptyContent(TextNode.valueOf("blank-root"))).thenReturn(false);
        when(jiraCommentFieldParser.parseContent(TextNode.valueOf("blank-root"))).thenReturn("");
        StringBuilder blankBuilder = new StringBuilder();
        appendIssueFieldsMethod.invoke(jiraDataToMarkdownService, blankBuilder, TextNode.valueOf("blank-root"), Map.of());
        assertEquals("", blankBuilder.toString());

        Method appendIssueMarkdownMethod = JiraDataToMarkdownService.class.getDeclaredMethod(
                "appendIssueMarkdown",
                StringBuilder.class,
                SearchRequest.class,
                JsonNode.class,
                Map.class
        );
        appendIssueMarkdownMethod.setAccessible(true);

        StringBuilder issueBuilder = new StringBuilder();
        ObjectNode issueNode = OBJECT_MAPPER.createObjectNode();
        appendIssueMarkdownMethod.invoke(jiraDataToMarkdownService, issueBuilder, null, issueNode, Map.of());
        assertTrue(issueBuilder.toString().startsWith("# Jira Issue ID/KEY: Unknown"));

        Method readTextMethod = JiraDataToMarkdownService.class.getDeclaredMethod("readText", JsonNode.class, String[].class);
        readTextMethod.setAccessible(true);

        assertEquals("", readTextMethod.invoke(jiraDataToMarkdownService, null, new String[]{"key"}));
        assertEquals("", readTextMethod.invoke(jiraDataToMarkdownService, OBJECT_MAPPER.createObjectNode(), new String[]{"missing"}));
    }

    @Test
    void privateHelpers_shouldResolveLogIssueNodeForSearchAndSingleIssuePayload() throws Exception {
        Method resolveLogIssueNodeMethod = JiraDataToMarkdownService.class.getDeclaredMethod("resolveLogIssueNode", JsonNode.class);
        resolveLogIssueNodeMethod.setAccessible(true);

        JsonNode searchPayload = OBJECT_MAPPER.readTree("""
                {
                  "issues": [
                    {
                      "id": "10000",
                      "key": "DEV-1"
                    },
                    {
                      "id": "10001",
                      "key": "DEV-2"
                    }
                  ]
                }
                """);
        JsonNode singleIssuePayload = OBJECT_MAPPER.readTree("""
                {
                  "id": "20000",
                  "key": "DEV-3",
                  "fields": {}
                }
                """);
        JsonNode emptyPayload = OBJECT_MAPPER.readTree("""
                {
                  "issues": []
                }
                """);

        JsonNode searchIssueNode = (JsonNode) resolveLogIssueNodeMethod.invoke(jiraDataToMarkdownService, searchPayload);
        JsonNode singleIssueNode = (JsonNode) resolveLogIssueNodeMethod.invoke(jiraDataToMarkdownService, singleIssuePayload);
        JsonNode emptyIssueNode = (JsonNode) resolveLogIssueNodeMethod.invoke(jiraDataToMarkdownService, emptyPayload);

        assertEquals("10000", searchIssueNode.path("id").asText());
        assertEquals("DEV-1", searchIssueNode.path("key").asText());
        assertEquals("20000", singleIssueNode.path("id").asText());
        assertEquals("DEV-3", singleIssueNode.path("key").asText());
        assertTrue(emptyIssueNode.isMissingNode());
    }

    @Test
    void privateHelpers_shouldHandleUnsupportedPayloadAndInvalidFieldNames() throws Exception {
        Method extractIssueNodesMethod = JiraDataToMarkdownService.class.getDeclaredMethod("extractIssueNodes", JsonNode.class);
        extractIssueNodesMethod.setAccessible(true);
        Method isSingleIssuePayloadMethod = JiraDataToMarkdownService.class.getDeclaredMethod("isSingleIssuePayload", JsonNode.class);
        isSingleIssuePayloadMethod.setAccessible(true);
        Method appendPayloadFieldNamesMethod = JiraDataToMarkdownService.class.getDeclaredMethod(
                "appendPayloadFieldNames",
                Map.class,
                JsonNode.class
        );
        appendPayloadFieldNamesMethod.setAccessible(true);

        JsonNode unsupportedPayload = OBJECT_MAPPER.readTree("[]");
        List<?> unsupportedIssueNodes = (List<?>) extractIssueNodesMethod.invoke(jiraDataToMarkdownService, unsupportedPayload);
        assertTrue(unsupportedIssueNodes.isEmpty());
        assertFalse((Boolean) isSingleIssuePayloadMethod.invoke(jiraDataToMarkdownService, unsupportedPayload));
        assertFalse((Boolean) isSingleIssuePayloadMethod.invoke(
                jiraDataToMarkdownService,
                OBJECT_MAPPER.readTree("{\"fields\":null}")
        ));

        Map<String, String> fieldNameMap = new LinkedHashMap<>();
        JsonNode namesNode = OBJECT_MAPPER.readTree("""
                {
                  "": "Blank key",
                  "customfield_1": "",
                  "customfield_2": "Valid Name"
                }
                """);
        appendPayloadFieldNamesMethod.invoke(jiraDataToMarkdownService, fieldNameMap, namesNode);

        assertEquals(Map.of("customfield_2", "Valid Name"), fieldNameMap);
    }

    @Test
    void privateHelpers_shouldReturnEmptyWhenReadTextHitsNullOrMissingNodeMidPath() throws Exception {
        Method readTextMethod = JiraDataToMarkdownService.class.getDeclaredMethod("readText", JsonNode.class, String[].class);
        readTextMethod.setAccessible(true);

        JsonNode nullNodePayload = OBJECT_MAPPER.readTree("""
                {
                  "outer": null
                }
                """);
        JsonNode missingNodePayload = OBJECT_MAPPER.readTree("""
                {
                  "outer": {}
                }
                """);
        JsonNode successPayload = OBJECT_MAPPER.readTree("""
                {
                  "outer": {
                    "inner": "value"
                  }
                }
                """);

        assertEquals("", readTextMethod.invoke(jiraDataToMarkdownService, null, new String[]{}));
        assertEquals("", readTextMethod.invoke(jiraDataToMarkdownService, nullNodePayload, new String[]{"outer", "inner"}));
        assertEquals("", readTextMethod.invoke(jiraDataToMarkdownService, nullNodePayload, new String[]{"outer"}));
        assertEquals("", readTextMethod.invoke(jiraDataToMarkdownService, missingNodePayload, new String[]{"outer", "missing", "leaf"}));
        assertEquals("value", readTextMethod.invoke(jiraDataToMarkdownService, successPayload, new String[]{"outer", "inner"}));
    }

    private int countOccurrences(String content, String marker) {
        int count = 0;
        int index = 0;
        while ((index = content.indexOf(marker, index)) >= 0) {
            count++;
            index = index + marker.length();
        }
        return count;
    }
}
