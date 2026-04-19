package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.dto.Jql;
import com.zhou4h.springboot3.dto.SearchRequest;
import com.zhou4h.springboot3.exception.CustomBaseException;
import com.zhou4h.springboot3.service.JiraDataToMarkdownService;
import com.zhou4h.springboot3.util.HttpUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JiraDataToMarkdownControllerTest {

    @Mock
    private JiraDataToMarkdownService jiraDataToMarkdownService;

    private JiraDataToMarkdownController controller;

    @BeforeEach
    void setUp() {
        controller = new JiraDataToMarkdownController(jiraDataToMarkdownService);
    }

    @Test
    void convertJiraDataToMarkdown_shouldReturnMarkdownAndBuildHttpRequest() {
        SearchRequest request = request(" https://jira.example.com/// ", "/rest/api/3/", "Bearer token", "project = DEMO");
        request.getJql().setStartAt(-3);
        request.getJql().setMaxResults(50);
        request.getJql().setFields(List.of("summary", "status"));

        @SuppressWarnings("unchecked")
        HttpResponse<String> response = mock(HttpResponse.class);
        AtomicReference<Map<String, Object>> capturedBody = new AtomicReference<>();
        AtomicReference<Map<String, String>> capturedHeaders = new AtomicReference<>();
        AtomicReference<String> capturedUrl = new AtomicReference<>();

        when(jiraDataToMarkdownService.convertJiraDataToMarkdown(request, response)).thenReturn("markdown");

        try (MockedStatic<HttpUtil> httpUtil = mockStatic(HttpUtil.class)) {
            httpUtil.when(() -> HttpUtil.post(any(), any(), anyString())).thenAnswer(invocation -> {
                capturedBody.set(invocation.getArgument(0));
                capturedHeaders.set(invocation.getArgument(1));
                capturedUrl.set(invocation.getArgument(2));
                return response;
            });

            ResponseEntity<String> result = controller.convertJiraDataToMarkdown(request);

            assertEquals(200, result.getStatusCode().value());
            assertEquals("markdown", result.getBody());
        }

        assertEquals("https://jira.example.com/rest/api/3/search", capturedUrl.get());
        assertEquals(Map.of(
                "Authorization", "Bearer token",
                "Accept", "application/json",
                "Content-Type", "application/json"
        ), capturedHeaders.get());
        assertEquals("project = DEMO", capturedBody.get().get("jql"));
        assertEquals(0, capturedBody.get().get("startAt"));
        assertEquals(50, capturedBody.get().get("maxResults"));
        assertEquals(List.of("summary", "status"), capturedBody.get().get("fields"));
        verify(jiraDataToMarkdownService).convertJiraDataToMarkdown(request, response);
    }

    @Test
    void convertJiraDataToMarkdown_shouldCoverValidationAndCatchBranches() {
        CustomBaseException nullRequest = assertThrows(CustomBaseException.class, () -> controller.convertJiraDataToMarkdown(null));
        assertEquals(400, nullRequest.getErrCode());
        assertEquals("request body cannot be empty", nullRequest.getErrMsg());

        CustomBaseException blankPrefix = assertThrows(
                CustomBaseException.class,
                () -> controller.convertJiraDataToMarkdown(request("  ", "2", "Bearer token", "project = DEMO"))
        );
        assertEquals("apiPrefix cannot be empty", blankPrefix.getErrMsg());

        CustomBaseException blankToken = assertThrows(
                CustomBaseException.class,
                () -> controller.convertJiraDataToMarkdown(request("https://jira.example.com", "2", "  ", "project = DEMO"))
        );
        assertEquals("token cannot be empty", blankToken.getErrMsg());

        SearchRequest nullJqlRequest = request("https://jira.example.com", "2", "Bearer token", "project = DEMO");
        nullJqlRequest.setJql(null);
        CustomBaseException nullJql = assertThrows(CustomBaseException.class, () -> controller.convertJiraDataToMarkdown(nullJqlRequest));
        assertEquals("jql cannot be empty", nullJql.getErrMsg());

        SearchRequest blankJqlRequest = request("https://jira.example.com", "2", "Bearer token", "   ");
        CustomBaseException blankJql = assertThrows(CustomBaseException.class, () -> controller.convertJiraDataToMarkdown(blankJqlRequest));
        assertEquals("jql cannot be empty", blankJql.getErrMsg());

        SearchRequest illegalArgumentRequest = request("///", "2", "Bearer token", "project = DEMO");
        ResponseEntity<String> illegalArgumentResponse = controller.convertJiraDataToMarkdown(illegalArgumentRequest);
        assertEquals(400, illegalArgumentResponse.getStatusCode().value());
        assertEquals("Error: apiPrefix cannot be empty", illegalArgumentResponse.getBody());

        SearchRequest serviceBadRequest = request("https://jira.example.com", null, "Bearer token", "project = DEMO");
        @SuppressWarnings("unchecked")
        HttpResponse<String> serviceResponse = mock(HttpResponse.class);
        try (MockedStatic<HttpUtil> httpUtil = mockStatic(HttpUtil.class)) {
            httpUtil.when(() -> HttpUtil.post(any(), any(), anyString())).thenReturn(serviceResponse);
            when(jiraDataToMarkdownService.convertJiraDataToMarkdown(serviceBadRequest, serviceResponse))
                    .thenThrow(new IllegalArgumentException("invalid search payload"));

            ResponseEntity<String> badRequestResponse = controller.convertJiraDataToMarkdown(serviceBadRequest);
            assertEquals(400, badRequestResponse.getStatusCode().value());
            assertEquals("Error: invalid search payload", badRequestResponse.getBody());
        }

        SearchRequest customExceptionRequest = request("https://jira.example.com", "2", "Bearer token", "project = DEMO");
        try (MockedStatic<HttpUtil> httpUtil = mockStatic(HttpUtil.class)) {
            httpUtil.when(() -> HttpUtil.post(any(), any(), anyString()))
                    .thenThrow(new CustomBaseException(409, "jira down"));

            CustomBaseException customException = assertThrows(
                    CustomBaseException.class,
                    () -> controller.convertJiraDataToMarkdown(customExceptionRequest)
            );
            assertEquals(409, customException.getErrCode());
            assertEquals("jira down", customException.getErrMsg());
        }

        SearchRequest genericExceptionRequest = request("https://jira.example.com", "2", "Bearer token", "project = DEMO");
        try (MockedStatic<HttpUtil> httpUtil = mockStatic(HttpUtil.class)) {
            httpUtil.when(() -> HttpUtil.post(any(), any(), anyString()))
                    .thenThrow(new RuntimeException("network down"));

            ResponseEntity<String> serverErrorResponse = controller.convertJiraDataToMarkdown(genericExceptionRequest);
            assertEquals(500, serverErrorResponse.getStatusCode().value());
            assertEquals("Error: network down", serverErrorResponse.getBody());
        }
    }

    @Test
    void privateHelpers_shouldCoverNormalizationAndBodyBranches() throws Exception {
        SearchRequest urlRequest = request(" https://jira.example.com/// ", "\\rest\\api\\6\\", "Bearer token", "project = DEMO");
        assertEquals("https://jira.example.com/rest/api/6/search", invoke("buildSearchUrl", urlRequest));

        SearchRequest bodyRequest = request("https://jira.example.com", "2", "Bearer token", "project = DEMO");
        bodyRequest.getJql().setStartAt(-4);
        bodyRequest.getJql().setMaxResults(0);
        bodyRequest.getJql().setFields(List.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> minimalBody = (Map<String, Object>) invoke("buildSearchBody", bodyRequest);
        assertEquals("project = DEMO", minimalBody.get("jql"));
        assertEquals(0, minimalBody.get("startAt"));
        assertFalse(minimalBody.containsKey("maxResults"));
        assertFalse(minimalBody.containsKey("fields"));

        bodyRequest.getJql().setMaxResults(7);
        bodyRequest.getJql().setFields(List.of("summary"));
        @SuppressWarnings("unchecked")
        Map<String, Object> fullBody = (Map<String, Object>) invoke("buildSearchBody", bodyRequest);
        assertEquals(7, fullBody.get("maxResults"));
        assertEquals(List.of("summary"), fullBody.get("fields"));

        @SuppressWarnings("unchecked")
        Map<String, String> jsonHeaders = (Map<String, String>) invoke("buildJsonHeaders", "Bearer abc");
        assertEquals("Bearer abc", jsonHeaders.get("Authorization"));
        assertEquals("application/json", jsonHeaders.get("Accept"));
        assertEquals("application/json", jsonHeaders.get("Content-Type"));

        assertEquals("https://jira.example.com", invoke("normalizeApiPrefix", " https://jira.example.com/// "));
        InvocationTargetException invalidPrefix = assertThrows(
                InvocationTargetException.class,
                () -> method("normalizeApiPrefix", String.class).invoke(controller, "///")
        );
        assertInstanceOf(IllegalArgumentException.class, invalidPrefix.getCause());
        assertEquals("apiPrefix cannot be empty", invalidPrefix.getCause().getMessage());

        assertEquals("2", invoke("normalizeApiVersion", (Object) null));
        assertEquals("2", invoke("normalizeApiVersion", "   "));
        assertEquals("3", invoke("normalizeApiVersion", "/rest/api/3/"));
        assertEquals("4", invoke("normalizeApiVersion", "api/4/"));
        assertEquals("2", invoke("normalizeApiVersion", "/"));

        assertEquals(true, invoke("isBlank", (Object) null));
        assertEquals(true, invoke("isBlank", "   "));
        assertEquals(false, invoke("isBlank", "jira"));
    }

    private SearchRequest request(String apiPrefix, String apiVersion, String token, String jqlText) {
        SearchRequest request = new SearchRequest();
        request.setApiPrefix(apiPrefix);
        request.setApiVersion(apiVersion);
        request.setToken(token);

        Jql jql = new Jql();
        jql.setJql(jqlText);
        jql.setStartAt(1);
        jql.setMaxResults(10);
        jql.setFields(List.of("summary"));
        request.setJql(jql);
        return request;
    }

    private Object invoke(String methodName, Object... args) throws Exception {
        Class<?>[] parameterTypes = new Class<?>[args.length];
        for (int i = 0; i < args.length; i++) {
            parameterTypes[i] = String.class;
            if (args[i] instanceof SearchRequest) {
                parameterTypes[i] = SearchRequest.class;
            }
        }
        return method(methodName, parameterTypes).invoke(controller, args);
    }

    private Method method(String name, Class<?>... parameterTypes) throws NoSuchMethodException {
        Method method = JiraDataToMarkdownController.class.getDeclaredMethod(name, parameterTypes);
        method.setAccessible(true);
        return method;
    }
}
