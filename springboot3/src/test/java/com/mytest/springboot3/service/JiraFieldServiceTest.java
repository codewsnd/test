package com.mytest.springboot3.service;

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
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JiraFieldServiceTest {

    private final JiraFieldService jiraFieldService = new JiraFieldService();

    @Test
    void loadVisibleFieldCatalog_shouldReturnEmptyWhenRequestMissingRequiredFields() {
        SearchRequest emptySearchRequest = new SearchRequest();
        SearchRequest invalidPrefixSearchRequest = new SearchRequest();
        invalidPrefixSearchRequest.setApiPrefix("/");
        invalidPrefixSearchRequest.setToken("Bearer abc");

        assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(null));
        assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(emptySearchRequest));
        assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(invalidPrefixSearchRequest));
    }

    @Test
    void loadVisibleFieldCatalog_shouldNormalizeRequestAndReuseCache() throws Exception {
        AtomicInteger requestCount = new AtomicInteger();
        AtomicReference<String> requestPath = new AtomicReference<>();
        AtomicReference<String> authorizationHeader = new AtomicReference<>();

        HttpServer httpServer = startServer(exchange -> {
            requestCount.incrementAndGet();
            requestPath.set(exchange.getRequestURI().getPath());
            authorizationHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
            writeResponse(exchange, 200, """
                    [
                      {"id": "summary", "name": "Summary"},
                      {"id": "", "name": "blank"},
                      {"name": "missing-id"},
                      {"id": "customfield_1", "name": "Business Value"}
                    ]
                    """);
        });

        try {
            SearchRequest searchRequest = new SearchRequest();
            searchRequest.setApiPrefix(serverBaseUrl(httpServer) + "///");
            searchRequest.setApiVersion("/rest/api/3/");
            searchRequest.setToken(" Bearer abc ");

            Map<String, String> firstLoad = jiraFieldService.loadVisibleFieldCatalog(searchRequest);
            Map<String, String> secondLoad = jiraFieldService.loadVisibleFieldCatalog(searchRequest);

            assertEquals("/rest/api/3/field", requestPath.get());
            assertEquals("Bearer abc", authorizationHeader.get());
            assertEquals(Map.of(
                    "summary", "Summary",
                    "customfield_1", "Business Value"
            ), firstLoad);
            assertSame(firstLoad, secondLoad);
            assertEquals(1, requestCount.get());
        } finally {
            httpServer.stop(0);
        }
    }

    @Test
    void loadVisibleFieldCatalog_shouldReturnEmptyWhenResponseIsNotArray() throws Exception {
        HttpServer httpServer = startServer(exchange -> writeResponse(exchange, 200, "{\"value\": 1}"));

        try {
            SearchRequest searchRequest = new SearchRequest();
            searchRequest.setApiPrefix(serverBaseUrl(httpServer));
            searchRequest.setApiVersion("/");
            searchRequest.setToken("Bearer abc");

            assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(searchRequest));
        } finally {
            httpServer.stop(0);
        }
    }

    @Test
    void loadVisibleFieldCatalog_shouldReturnEmptyWhenResponseJsonIsInvalid() throws Exception {
        HttpServer httpServer = startServer(exchange -> writeResponse(exchange, 200, "not-json"));

        try {
            SearchRequest searchRequest = new SearchRequest();
            searchRequest.setApiPrefix(serverBaseUrl(httpServer));
            searchRequest.setToken("Bearer abc");

            assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(searchRequest));
        } finally {
            httpServer.stop(0);
        }
    }

    @Test
    void loadVisibleFieldCatalog_shouldReturnEmptyWhenServerRespondsWithShortOrLongErrorBody() throws Exception {
        HttpServer shortBodyServer = startServer(exchange -> writeResponse(exchange, 500, "short-error"));
        HttpServer longBodyServer = startServer(exchange -> writeResponse(exchange, 500, "x".repeat(450)));

        try {
            SearchRequest shortBodyRequest = new SearchRequest();
            shortBodyRequest.setApiPrefix(serverBaseUrl(shortBodyServer));
            shortBodyRequest.setToken("Bearer abc");

            SearchRequest longBodyRequest = new SearchRequest();
            longBodyRequest.setApiPrefix(serverBaseUrl(longBodyServer));
            longBodyRequest.setToken("Bearer abc");

            assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(shortBodyRequest));
            assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(longBodyRequest));
        } finally {
            shortBodyServer.stop(0);
            longBodyServer.stop(0);
        }
    }

    @Test
    void loadVisibleFieldCatalog_shouldReturnEmptyWhenRequestThrowsIOException() throws Exception {
        SearchRequest searchRequest = new SearchRequest();
        searchRequest.setApiPrefix("http://127.0.0.1:" + findFreePort());
        searchRequest.setToken("Bearer abc");

        assertEquals(Map.of(), jiraFieldService.loadVisibleFieldCatalog(searchRequest));
    }

    @Test
    void privateHelpers_shouldCoverInterruptedRequestAndUtilityBranches() throws Exception {
        Method requestFieldCatalogResponseMethod = JiraFieldService.class.getDeclaredMethod(
                "requestFieldCatalogResponse",
                String.class,
                String.class
        );
        requestFieldCatalogResponseMethod.setAccessible(true);

        HttpServer httpServer = startServer(exchange -> writeResponse(exchange, 200, "[]"));

        try {
            Thread.currentThread().interrupt();
            InvocationTargetException invocationTargetException = assertThrows(
                    InvocationTargetException.class,
                    () -> requestFieldCatalogResponseMethod.invoke(
                            jiraFieldService,
                            serverBaseUrl(httpServer) + "/rest/api/2/field",
                            "Bearer abc"
                    )
            );

            assertTrue(Thread.currentThread().isInterrupted());
            assertEquals(CustomBaseException.class, invocationTargetException.getCause().getClass());
        } finally {
            Thread.interrupted();
            httpServer.stop(0);
        }

        Method normalizeAuthorizationHeaderMethod = JiraFieldService.class.getDeclaredMethod(
                "normalizeAuthorizationHeader",
                String.class
        );
        normalizeAuthorizationHeaderMethod.setAccessible(true);
        assertEquals("", normalizeAuthorizationHeaderMethod.invoke(jiraFieldService, new Object[]{null}));
        assertEquals("token", normalizeAuthorizationHeaderMethod.invoke(jiraFieldService, " token "));

        Method previewBodyMethod = JiraFieldService.class.getDeclaredMethod("previewBody", String.class);
        previewBodyMethod.setAccessible(true);
        assertEquals("", previewBodyMethod.invoke(jiraFieldService, new Object[]{null}));
        assertEquals("body", previewBodyMethod.invoke(jiraFieldService, "body"));

        Method readTextMethod = JiraFieldService.class.getDeclaredMethod("readText", com.fasterxml.jackson.databind.JsonNode.class, String[].class);
        readTextMethod.setAccessible(true);
        assertEquals("", readTextMethod.invoke(jiraFieldService, null, new String[]{"id"}));
        assertEquals("", readTextMethod.invoke(jiraFieldService, new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode(), new String[]{"id"}));
    }

    @Test
    void privateHelpers_shouldCoverPreviewTruncationAndNon2xxCatalogResponse() throws Exception {
        Method previewBodyMethod = JiraFieldService.class.getDeclaredMethod("previewBody", String.class);
        previewBodyMethod.setAccessible(true);
        String longBody = "x".repeat(450);
        String preview = (String) previewBodyMethod.invoke(jiraFieldService, longBody);
        assertEquals(400, preview.length());

        Method parseCatalogResponseMethod = JiraFieldService.class.getDeclaredMethod("parseCatalogResponse", HttpResponse.class);
        parseCatalogResponseMethod.setAccessible(true);

        HttpResponse<String> fieldResponse = mock(HttpResponse.class);
        when(fieldResponse.statusCode()).thenReturn(500);
        when(fieldResponse.body()).thenReturn(null);

        InvocationTargetException invocationTargetException = assertThrows(
                InvocationTargetException.class,
                () -> parseCatalogResponseMethod.invoke(jiraFieldService, fieldResponse)
        );

        assertEquals(CustomBaseException.class, invocationTargetException.getCause().getClass());
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

    private void writeResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] bodyBytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bodyBytes.length);
        try (OutputStream outputStream = exchange.getResponseBody()) {
            outputStream.write(bodyBytes);
        }
    }

    private int findFreePort() throws IOException {
        try (ServerSocket serverSocket = new ServerSocket(0)) {
            return serverSocket.getLocalPort();
        }
    }

    @FunctionalInterface
    private interface ExchangeHandler {

        void handle(HttpExchange exchange) throws IOException;
    }
}
