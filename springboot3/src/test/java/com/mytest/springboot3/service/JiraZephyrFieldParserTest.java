package com.mytest.springboot3.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.NullNode;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.mytest.springboot3.dto.SearchRequest;
import com.mytest.springboot3.exception.CustomBaseException;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JiraZephyrFieldParserTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final JiraZephyrFieldParser jiraZephyrFieldParser = new JiraZephyrFieldParser();

    @Test
    void loadTestFields_shouldReturnEmptyWhenRequestMissingOrIssueIsNotTest() throws Exception {
        SearchRequest emptyRequest = new SearchRequest();
        SearchRequest missingPrefixRequest = new SearchRequest();
        missingPrefixRequest.setToken("Bearer token");
        SearchRequest missingTokenRequest = new SearchRequest();
        missingTokenRequest.setApiPrefix("http://127.0.0.1");
        JsonNode nonTestIssue = OBJECT_MAPPER.readTree("""
                {
                  "id": "10000",
                  "key": "DEV-1",
                  "fields": {
                    "issuetype": {
                      "name": "Story"
                    }
                  }
                }
                """);
        JsonNode testIssue = OBJECT_MAPPER.readTree("""
                {
                  "id": "10001",
                  "key": "DEV-TEST-1",
                  "fields": {
                    "issuetype": {
                      "name": "Test"
                    }
                  }
                }
                """);
        JsonNode testIssueWithoutIdentifiers = OBJECT_MAPPER.readTree("""
                {
                  "fields": {
                    "issuetype": {
                      "name": "Test"
                    }
                  }
                }
                """);

        assertEquals(Map.of(), jiraZephyrFieldParser.loadTestFields(emptyRequest, null));
        assertEquals(Map.of(), jiraZephyrFieldParser.loadTestFields(null, nonTestIssue));
        assertEquals(Map.of(), jiraZephyrFieldParser.loadTestFields(emptyRequest, nonTestIssue));
        assertEquals(Map.of(), jiraZephyrFieldParser.loadTestFields(missingPrefixRequest, testIssue));
        assertEquals(Map.of(), jiraZephyrFieldParser.loadTestFields(missingTokenRequest, testIssue));

        emptyRequest.setApiPrefix("http://127.0.0.1");
        emptyRequest.setToken("Bearer token");
        assertEquals(Map.of(), jiraZephyrFieldParser.loadTestFields(emptyRequest, nonTestIssue));
        assertEquals(Map.of(), jiraZephyrFieldParser.loadTestFields(emptyRequest, testIssueWithoutIdentifiers));
    }

    @Test
    void loadTestFields_shouldLoadTestDetailsAndExecutionsForTestIssue() throws Exception {
        AtomicInteger requestCount = new AtomicInteger();
        AtomicReference<String> authorizationHeader = new AtomicReference<>();
        AtomicReference<String> firstPath = new AtomicReference<>();
        AtomicReference<String> secondPath = new AtomicReference<>();
        AtomicReference<String> secondQuery = new AtomicReference<>();

        HttpServer httpServer = startServer(exchange -> {
            requestCount.incrementAndGet();
            authorizationHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            if (requestCount.get() == 1) {
                firstPath.set(exchange.getRequestURI().getPath());
                writeResponse(exchange, 200, """
                        {
                          "id": "1",
                          "step": "Open login page"
                        }
                        """);
                return;
            }

            secondPath.set(exchange.getRequestURI().getPath());
            secondQuery.set(exchange.getRequestURI().getQuery());
            writeResponse(exchange, 200, """
                    {
                      "executions": [
                        {
                          "execution": {
                            "id": "20001",
                            "status": "PASS"
                          }
                        }
                      ]
                    }
                    """);
        });

        try {
            SearchRequest searchRequest = new SearchRequest();
            searchRequest.setApiPrefix(serverBaseUrl(httpServer) + "///");
            searchRequest.setToken(" Bearer abc ");

            JsonNode issueNode = OBJECT_MAPPER.readTree("""
                    {
                      "id": "10000",
                      "key": "DEV-1",
                      "fields": {
                        "issuetype": {
                          "name": "Test"
                        }
                      }
                    }
                    """);

            Map<String, JsonNode> result = jiraZephyrFieldParser.loadTestFields(searchRequest, issueNode);

            assertEquals(2, result.size());
            assertEquals("Open login page", result.get("Test Details").path("step").asText());
            assertEquals("PASS", result.get("Test Executions").path("executions").get(0).path("execution").path("status").asText());
            assertEquals("Bearer abc", authorizationHeader.get());
            assertEquals("/rest/zapi/latest/teststep/10000", firstPath.get());
            assertEquals("/rest/zapi/latest/traceability/executionsByTest", secondPath.get());
            assertEquals("testIdOrKey=DEV-1", secondQuery.get());
        } finally {
            httpServer.stop(0);
        }
    }

    @Test
    void loadTestFields_shouldFallbackToIssueIdForExecutionsAndKeepSuccessfulResponses() throws Exception {
        AtomicReference<String> executionsQuery = new AtomicReference<>();

        HttpServer httpServer = startServer(exchange -> {
            if (exchange.getRequestURI().getPath().contains("/teststep/")) {
                writeResponse(exchange, 500, "detail-error");
                return;
            }

            executionsQuery.set(exchange.getRequestURI().getQuery());
            writeResponse(exchange, 200, """
                    {
                      "executions": [
                        {
                          "execution": {
                            "id": "30001"
                          }
                        }
                      ]
                    }
                    """);
        });

        try {
            SearchRequest searchRequest = new SearchRequest();
            searchRequest.setApiPrefix(serverBaseUrl(httpServer));
            searchRequest.setToken("Bearer abc");

            JsonNode issueNode = OBJECT_MAPPER.readTree("""
                    {
                      "id": "10000",
                      "key": "   ",
                      "fields": {
                        "issuetype": {
                          "name": "Test"
                        }
                      }
                    }
                    """);

            Map<String, JsonNode> result = jiraZephyrFieldParser.loadTestFields(searchRequest, issueNode);

            assertFalse(result.containsKey("Test Details"));
            assertEquals("30001", result.get("Test Executions").path("executions").get(0).path("execution").path("id").asText());
            assertEquals("testIdOrKey=10000", executionsQuery.get());
        } finally {
            httpServer.stop(0);
        }
    }

    @Test
    void loadTestFields_shouldUseIssueKeyWhenIssueIdIsMissingAndSkipFailedExecutions() throws Exception {
        AtomicReference<String> detailsPath = new AtomicReference<>();
        AtomicReference<String> executionsQuery = new AtomicReference<>();

        HttpServer httpServer = startServer(exchange -> {
            if (exchange.getRequestURI().getPath().endsWith("/teststep/")) {
                detailsPath.set(exchange.getRequestURI().getPath());
                writeResponse(exchange, 200, """
                        {
                          "step": "Key only detail"
                        }
                        """);
                return;
            }

            executionsQuery.set(exchange.getRequestURI().getQuery());
            writeResponse(exchange, 500, "execution-error");
        });

        try {
            SearchRequest searchRequest = new SearchRequest();
            searchRequest.setApiPrefix(serverBaseUrl(httpServer));
            searchRequest.setToken("Bearer abc");

            JsonNode issueNode = OBJECT_MAPPER.readTree("""
                    {
                      "key": "DEV-ONLY-KEY",
                      "fields": {
                        "issuetype": {
                          "name": "Test"
                        }
                      }
                    }
                    """);

            Map<String, JsonNode> result = jiraZephyrFieldParser.loadTestFields(searchRequest, issueNode);

            assertEquals("/rest/zapi/latest/teststep/", detailsPath.get());
            assertEquals("testIdOrKey=DEV-ONLY-KEY", executionsQuery.get());
            assertEquals(1, result.size());
            assertEquals("Key only detail", result.get("Test Details").path("step").asText());
            assertFalse(result.containsKey("Test Executions"));
        } finally {
            httpServer.stop(0);
        }
    }

    @Test
    void privateHelpers_shouldCoverUtilityBranches() throws Exception {
        Method isTestIssueMethod = JiraZephyrFieldParser.class.getDeclaredMethod("isTestIssue", JsonNode.class);
        isTestIssueMethod.setAccessible(true);
        Method normalizeApiPrefixMethod = JiraZephyrFieldParser.class.getDeclaredMethod("normalizeApiPrefix", String.class);
        normalizeApiPrefixMethod.setAccessible(true);
        Method normalizeAuthorizationHeaderMethod = JiraZephyrFieldParser.class.getDeclaredMethod("normalizeAuthorizationHeader", String.class);
        normalizeAuthorizationHeaderMethod.setAccessible(true);
        Method previewBodyMethod = JiraZephyrFieldParser.class.getDeclaredMethod("previewBody", String.class);
        previewBodyMethod.setAccessible(true);
        Method readTextMethod = JiraZephyrFieldParser.class.getDeclaredMethod("readText", JsonNode.class, String[].class);
        readTextMethod.setAccessible(true);
        Method encodeQueryValueMethod = JiraZephyrFieldParser.class.getDeclaredMethod("encodeQueryValue", String.class);
        encodeQueryValueMethod.setAccessible(true);

        JsonNode testIssue = OBJECT_MAPPER.readTree("""
                {
                  "fields": {
                    "issuetype": {
                      "name": "TEST"
                    }
                  }
                }
                """);
        JsonNode nonTestIssue = OBJECT_MAPPER.readTree("""
                {
                  "fields": {
                    "issuetype": {
                      "name": "Bug"
                    }
                  }
                }
                """);

        assertTrue((Boolean) isTestIssueMethod.invoke(jiraZephyrFieldParser, testIssue));
        assertFalse((Boolean) isTestIssueMethod.invoke(jiraZephyrFieldParser, nonTestIssue));
        assertEquals("http://127.0.0.1", normalizeApiPrefixMethod.invoke(jiraZephyrFieldParser, "http://127.0.0.1///"));
        assertEquals("", normalizeAuthorizationHeaderMethod.invoke(jiraZephyrFieldParser, new Object[]{null}));
        assertEquals("Bearer token", normalizeAuthorizationHeaderMethod.invoke(jiraZephyrFieldParser, " Bearer token "));
        assertEquals("", previewBodyMethod.invoke(jiraZephyrFieldParser, new Object[]{null}));
        assertEquals(400, ((String) previewBodyMethod.invoke(jiraZephyrFieldParser, "x".repeat(450))).length());
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, null, new String[]{}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, null, new String[]{"id"}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, NullNode.getInstance(), new String[]{}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, MissingNode.getInstance(), new String[]{}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, MissingNode.getInstance(), new String[]{"id"}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, OBJECT_MAPPER.readTree("{\"outer\":null}"), new String[]{"outer", "id"}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, OBJECT_MAPPER.readTree("{\"outer\":null}"), new String[]{"outer"}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, OBJECT_MAPPER.readTree("{\"outer\":{}}"), new String[]{"outer", "missing"}));
        assertEquals("", readTextMethod.invoke(jiraZephyrFieldParser, OBJECT_MAPPER.readTree("{}"), new String[]{"missing", "leaf"}));
        assertEquals("value", readTextMethod.invoke(jiraZephyrFieldParser, OBJECT_MAPPER.readTree("{\"outer\":{\"inner\":\"value\"}}"), new String[]{"outer", "inner"}));
        assertEquals("A+B%2FC", encodeQueryValueMethod.invoke(jiraZephyrFieldParser, "A B/C"));
    }

    @Test
    void privateHelpers_shouldCoverExceptionalBranches() throws Exception {
        Method requestResponseMethod = JiraZephyrFieldParser.class.getDeclaredMethod("requestResponse", String.class, String.class);
        requestResponseMethod.setAccessible(true);
        Method requestJsonSafelyMethod = JiraZephyrFieldParser.class.getDeclaredMethod(
                "requestJsonSafely",
                String.class,
                String.class,
                String.class,
                String.class
        );
        requestJsonSafelyMethod.setAccessible(true);
        Method parseJsonMethod = JiraZephyrFieldParser.class.getDeclaredMethod("parseJson", String.class);
        parseJsonMethod.setAccessible(true);
        Method normalizeApiPrefixMethod = JiraZephyrFieldParser.class.getDeclaredMethod("normalizeApiPrefix", String.class);
        normalizeApiPrefixMethod.setAccessible(true);
        Method isSuccessfulStatusMethod = JiraZephyrFieldParser.class.getDeclaredMethod("isSuccessfulStatus", int.class);
        isSuccessfulStatusMethod.setAccessible(true);

        HttpServer interruptedServer = startServer(exchange -> writeResponse(exchange, 200, "{}"));
        HttpServer status199Server = startServer(exchange -> writeResponse(exchange, 199, "processing"));

        try {
            Thread.currentThread().interrupt();
            InvocationTargetException interruptedException = assertThrows(
                    InvocationTargetException.class,
                    () -> requestResponseMethod.invoke(
                            jiraZephyrFieldParser,
                            serverBaseUrl(interruptedServer),
                            "Bearer abc"
                    )
            );
            assertEquals(CustomBaseException.class, interruptedException.getCause().getClass());
            assertTrue(Thread.currentThread().isInterrupted());
        } finally {
            Thread.interrupted();
            interruptedServer.stop(0);
        }

        InvocationTargetException ioException = assertThrows(
                InvocationTargetException.class,
                () -> requestResponseMethod.invoke(
                        jiraZephyrFieldParser,
                        "http://127.0.0.1:" + findFreePort(),
                        "Bearer abc"
                )
        );
        assertEquals(CustomBaseException.class, ioException.getCause().getClass());

        assertEquals(
                null,
                requestJsonSafelyMethod.invoke(
                        jiraZephyrFieldParser,
                        serverBaseUrl(status199Server),
                        "Bearer abc",
                        "Test Details",
                        "DEV-199"
                )
        );
        status199Server.stop(0);

        InvocationTargetException parseException = assertThrows(
                InvocationTargetException.class,
                () -> parseJsonMethod.invoke(jiraZephyrFieldParser, "not-json")
        );
        assertEquals(CustomBaseException.class, parseException.getCause().getClass());

        InvocationTargetException normalizeException = assertThrows(
                InvocationTargetException.class,
                () -> normalizeApiPrefixMethod.invoke(jiraZephyrFieldParser, "///")
        );
        assertEquals(CustomBaseException.class, normalizeException.getCause().getClass());
        InvocationTargetException normalizeNullException = assertThrows(
                InvocationTargetException.class,
                () -> normalizeApiPrefixMethod.invoke(jiraZephyrFieldParser, new Object[]{null})
        );
        assertEquals(CustomBaseException.class, normalizeNullException.getCause().getClass());

        assertEquals(false, isSuccessfulStatusMethod.invoke(jiraZephyrFieldParser, 199));
        assertEquals(true, isSuccessfulStatusMethod.invoke(jiraZephyrFieldParser, 200));
        assertEquals(true, isSuccessfulStatusMethod.invoke(jiraZephyrFieldParser, 299));
        assertEquals(false, isSuccessfulStatusMethod.invoke(jiraZephyrFieldParser, 500));
    }

    private HttpServer startServer(ExchangeHandler exchangeHandler) throws IOException {
        HttpServer httpServer = HttpServer.create(new InetSocketAddress(0), 0);
        httpServer.createContext("/", exchange -> {
            try {
                exchangeHandler.handle(exchange);
            } finally {
                exchange.close();
            }
        });
        httpServer.start();
        return httpServer;
    }

    private String serverBaseUrl(HttpServer httpServer) {
        return "http://127.0.0.1:" + httpServer.getAddress().getPort();
    }

    private int findFreePort() throws IOException {
        try (ServerSocket serverSocket = new ServerSocket(0)) {
            return serverSocket.getLocalPort();
        }
    }

    private void writeResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bodyBytes.length);
        try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(bodyBytes);
        }
    }

    @FunctionalInterface
    private interface ExchangeHandler {

        void handle(HttpExchange exchange) throws IOException;
    }
}
