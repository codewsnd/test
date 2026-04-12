package com.zhou4h.backend.utils;

import com.zhou4h.backend.dto.ConfluencePageContent;
import com.zhou4h.backend.dto.copydeck.ConfluencePageInfo;
import com.zhou4h.backend.dto.copydeck.ImageData;
import com.zhou4h.backend.exception.CustomException;
import com.zhou4h.backend.service.CopyDeckService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpHeaders;
import java.net.http.HttpResponse;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConfluenceUtilTest {

    private static final String TEST_BASE_URL = "https://confluence.example.com";
    private static final String TEST_PAGE_ID = "12345";
    private static final String TEST_TOKEN = "test-token";
    private static final String TEST_CONFLUENCE_URL = TEST_BASE_URL + "/spaces/TEST/pages/" + TEST_PAGE_ID;

    @Test
    void testGetPageContent_Success() {
        String jsonResponse = """
                {
                    "id": "12345",
                    "title": "Test Page",
                    "body": {
                        "storage": {
                            "value": "<p>Test content</p>",
                            "representation": "storage"
                        },
                        "view": {
                            "value": "<p>View content</p>",
                            "representation": "view"
                        }
                    },
                    "version": {
                        "number": 1
                    }
                }
                """;

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class);
             MockedStatic<CopyDeckService> mockedService = mockStatic(CopyDeckService.class)) {

            // Mock HttpResponse
            HttpResponse<String> mockResponse = createMockStringResponse(200, jsonResponse);

            // Mock static methods
            ConfluencePageInfo pageInfo = new ConfluencePageInfo(TEST_BASE_URL, null, TEST_PAGE_ID, null);
            mockedService.when(() -> CopyDeckService.parsePageUrl(anyString())).thenReturn(pageInfo);

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            // Execute
            ConfluencePageContent result = ConfluenceUtil.getPageContent(TEST_CONFLUENCE_URL, TEST_TOKEN);

            // Verify
            assertNotNull(result);
            assertEquals("12345", result.getId());
            assertEquals("Test Page", result.getTitle());
            assertEquals("<p>Test content</p>", result.getBody().getStorage().getValue());
            assertEquals(1, result.getVersion().getNumber());
        }
    }

    @Test
    void testGetPageContent_HttpError() {
        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class);
             MockedStatic<CopyDeckService> mockedService = mockStatic(CopyDeckService.class)) {

            // When HTTP error (404), body() is NOT called (exception is thrown immediately)
            HttpResponse<String> mockResponse = mock(HttpResponse.class);
            when(mockResponse.statusCode()).thenReturn(404);
            // Don't stub body() - it won't be called when status != 200

            ConfluencePageInfo pageInfo = new ConfluencePageInfo(TEST_BASE_URL, null, TEST_PAGE_ID, null);
            mockedService.when(() -> CopyDeckService.parsePageUrl(anyString())).thenReturn(pageInfo);

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            CustomException exception = assertThrows(CustomException.class, () -> {
                ConfluenceUtil.getPageContent(TEST_CONFLUENCE_URL, TEST_TOKEN);
            });

            assertTrue(exception.getMessage().contains("Failed to get page content"));
        }
    }

    @Test
    void testGetPageContent_ParseException() {
        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class);
             MockedStatic<CopyDeckService> mockedService = mockStatic(CopyDeckService.class)) {

            ConfluencePageInfo pageInfo = new ConfluencePageInfo(TEST_BASE_URL, null, TEST_PAGE_ID, null);
            mockedService.when(() -> CopyDeckService.parsePageUrl(anyString())).thenReturn(pageInfo);

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap()))
                        .thenThrow(new RuntimeException("Network error"));
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            CustomException exception = assertThrows(CustomException.class, () -> {
                ConfluenceUtil.getPageContent(TEST_CONFLUENCE_URL, TEST_TOKEN);
            });

            assertTrue(exception.getMessage().contains("Failed to call Confluence API"));
        }
    }

    @Test
    void testUpdatePageContentWithStorage_Success() {
        ConfluencePageContent pageContent = createMockPageContent();

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            // When update succeeds (HTTP 200), body() is NOT called
            HttpResponse<String> mockResponse = mock(HttpResponse.class);
            when(mockResponse.statusCode()).thenReturn(200);
            // Don't stub body() - it won't be called on success

            try {
                mockedHttpUtil.when(() -> HttpUtil.put(any(Map.class), anyMap(), anyString()))
                        .thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            assertDoesNotThrow(() -> {
                ConfluenceUtil.updatePageContentWithStorage(pageContent, "<p>New content</p>",
                        TEST_TOKEN, TEST_BASE_URL);
            });
        }
    }

    @Test
    void testUpdatePageContentWithStorage_HttpError() {
        ConfluencePageContent pageContent = createMockPageContent();

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            HttpResponse<String> mockResponse = createMockStringResponse(500, "Server Error");

            try {
                mockedHttpUtil.when(() -> HttpUtil.put(any(Map.class), anyMap(), anyString()))
                        .thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            CustomException exception = assertThrows(CustomException.class, () -> {
                ConfluenceUtil.updatePageContentWithStorage(pageContent, "<p>New content</p>",
                        TEST_TOKEN, TEST_BASE_URL);
            });

            assertTrue(exception.getMessage().contains("Failed to update page"));
        }
    }

    @Test
    void testUpdatePageContentWithStorage_Exception() {
        ConfluencePageContent pageContent = createMockPageContent();

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            try {
                mockedHttpUtil.when(() -> HttpUtil.put(any(Map.class), anyMap(), anyString()))
                        .thenThrow(new RuntimeException("Network error"));
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            CustomException exception = assertThrows(CustomException.class, () -> {
                ConfluenceUtil.updatePageContentWithStorage(pageContent, "<p>New content</p>",
                        TEST_TOKEN, TEST_BASE_URL);
            });

            assertTrue(exception.getMessage().contains("Failed to update page content"));
        }
    }

    @Test
    void testUploadImagesToConfluence_NullImages() {
        Map<String, String> result = ConfluenceUtil.uploadImagesToConfluence(null, TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void testUploadImagesToConfluence_EmptyImages() {
        List<ImageData> images = new ArrayList<>();

        Map<String, String> result = ConfluenceUtil.uploadImagesToConfluence(images, TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    @Test
    void testUploadImagesToConfluence_WithExistingImage() {
        List<ImageData> images = new ArrayList<>();
        images.add(new ImageData("existing.png", "base64data"));

        String attachmentsJson = """
                {
                    "results": [
                        {
                            "id": "att1",
                            "title": "existing.png",
                            "version": {
                                "number": "1"
                            }
                        }
                    ]
                }
                """;

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            HttpResponse<String> mockResponse = createMockStringResponse(200, attachmentsJson);

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, String> result = ConfluenceUtil.uploadImagesToConfluence(images, TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            assertNotNull(result);
            assertEquals(1, result.size());
            assertEquals("existing.png", result.get("existing.png"));
        }
    }

    @Test
    void testUploadImagesToConfluence_WithNewImage() {
        List<ImageData> images = new ArrayList<>();
        images.add(new ImageData("new.png", "aGVsbG8="));

        String attachmentsJson = "{\"results\": []}";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            // Create GET response for fetching existing attachments
            HttpResponse<String> getResponse = mock(HttpResponse.class);
            when(getResponse.statusCode()).thenReturn(200);
            when(getResponse.body()).thenReturn(attachmentsJson);

            // Create POST response for uploading image
            // When statusCode is 201 (success), body() is NOT called
            HttpResponse<String> postResponse = mock(HttpResponse.class);
            when(postResponse.statusCode()).thenReturn(201);
            // Don't stub body() - it won't be called when upload succeeds

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(getResponse);
                mockedHttpUtil.when(() -> HttpUtil.postMultipart(anyString(), anyMap(), anyMap(), anyMap()))
                        .thenReturn(postResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, String> result = ConfluenceUtil.uploadImagesToConfluence(images, TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            assertNotNull(result);
            assertEquals(1, result.size());
            assertTrue(result.containsKey("new.png"));
        }
    }

    @Test
    void testUploadImagesToConfluence_WithNewImageFailure() {
        List<ImageData> images = new ArrayList<>();
        images.add(new ImageData("new.png", "aGVsbG8="));

        String attachmentsJson = "{\"results\": []}";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            // Create GET response for fetching existing attachments
            HttpResponse<String> getResponse = mock(HttpResponse.class);
            when(getResponse.statusCode()).thenReturn(200);
            when(getResponse.body()).thenReturn(attachmentsJson);

            // Create POST response for failed upload
            // When statusCode is NOT 200/201, body() WILL be called for error logging
            HttpResponse<String> postResponse = mock(HttpResponse.class);
            when(postResponse.statusCode()).thenReturn(500);
            when(postResponse.body()).thenReturn("Server Error");

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(getResponse);
                mockedHttpUtil.when(() -> HttpUtil.postMultipart(anyString(), anyMap(), anyMap(), anyMap()))
                        .thenReturn(postResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, String> result = ConfluenceUtil.uploadImagesToConfluence(images, TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            // Upload failed, so result should be empty
            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    @Test
    void testUploadImagesToConfluence_WithEmptyBase64() {
        List<ImageData> images = new ArrayList<>();
        images.add(new ImageData("empty.png", ""));

        String attachmentsJson = "{\"results\": []}";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            HttpResponse<String> mockResponse = createMockStringResponse(200, attachmentsJson);

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, String> result = ConfluenceUtil.uploadImagesToConfluence(images, TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    @Test
    void testGetExistingAttachments_Success() {
        String attachmentsJson = """
                {
                    "results": [
                        {
                            "id": "att1",
                            "title": "image1.png",
                            "version": {
                                "number": "1"
                            }
                        },
                        {
                            "id": "att2",
                            "title": "image2.png",
                            "version": {
                                "number": "2"
                            }
                        }
                    ]
                }
                """;

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            HttpResponse<String> mockResponse = createMockStringResponse(200, attachmentsJson);

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, ConfluenceUtil.AttachmentInfo> result = ConfluenceUtil.getExistingAttachments(
                    TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            assertNotNull(result);
            assertEquals(2, result.size());
            assertTrue(result.containsKey("image1.png"));
            assertTrue(result.containsKey("image2.png"));
            assertEquals("att1", result.get("image1.png").getId());
            assertEquals("1", result.get("image1.png").getVersion());
        }
    }

    @Test
    void testGetExistingAttachments_NoVersion() {
        String attachmentsJson = """
                {
                    "results": [
                        {
                            "id": "att1",
                            "title": "image1.png"
                        }
                    ]
                }
                """;

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            HttpResponse<String> mockResponse = createMockStringResponse(200, attachmentsJson);

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, ConfluenceUtil.AttachmentInfo> result = ConfluenceUtil.getExistingAttachments(
                    TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            assertNotNull(result);
            assertEquals(1, result.size());
            assertEquals("1", result.get("image1.png").getVersion());
        }
    }

    @Test
    void testGetExistingAttachments_HttpError() {
        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            // Create a mock response that only stubs what will be used
            HttpResponse<String> mockResponse = mock(HttpResponse.class);
            when(mockResponse.statusCode()).thenReturn(500);
            // Don't stub body() since it won't be called when status != 200

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, ConfluenceUtil.AttachmentInfo> result = ConfluenceUtil.getExistingAttachments(
                    TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    @Test
    void testGetExistingAttachments_Exception() {
        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsString(anyString(), anyMap()))
                        .thenThrow(new RuntimeException("Network error"));
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            Map<String, ConfluenceUtil.AttachmentInfo> result = ConfluenceUtil.getExistingAttachments(
                    TEST_PAGE_ID, TEST_TOKEN, TEST_BASE_URL);

            assertNotNull(result);
            assertTrue(result.isEmpty());
        }
    }

    @Test
    void testDownloadImageAsBase64_Success() {
        byte[] imageData = "test image data".getBytes();
        String imageUrl = TEST_BASE_URL + "/download/attachments/" + TEST_PAGE_ID + "/image.png";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            HttpResponse<byte[]> mockResponse = createMockBytesResponse(200, imageData, "image/png");

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsBytes(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            ImageData result = ConfluenceUtil.downloadImageAsBase64(imageUrl, new HashMap<>());

            assertNotNull(result);
            assertEquals("image.png", result.getFileName());
            assertTrue(result.getBase64().startsWith("data:image/png;base64,"));
        }
    }

    @Test
    void testDownloadImageAsBase64_WithSpecialCharacters() {
        byte[] imageData = "test image data".getBytes();
        String imageUrl = TEST_BASE_URL + "/download/attachments/" + TEST_PAGE_ID + "/图片 test.png";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            HttpResponse<byte[]> mockResponse = createMockBytesResponse(200, imageData, "image/png");

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsBytes(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            ImageData result = ConfluenceUtil.downloadImageAsBase64(imageUrl, new HashMap<>());

            assertNotNull(result);
            assertNotNull(result.getFileName());
        }
    }

    @Test
    void testDownloadImageAsBase64_HttpError() {
        String imageUrl = TEST_BASE_URL + "/download/attachments/" + TEST_PAGE_ID + "/image.png";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            // When HTTP error (404), body() and headers() are NOT called
            HttpResponse<byte[]> mockResponse = mock(HttpResponse.class);
            when(mockResponse.statusCode()).thenReturn(404);
            // Don't stub body() or headers() - they won't be called when status != 200

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsBytes(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            ImageData result = ConfluenceUtil.downloadImageAsBase64(imageUrl, new HashMap<>());

            assertNull(result);
        }
    }

    @Test
    void testDownloadImageAsBase64_EmptyResponse() {
        String imageUrl = TEST_BASE_URL + "/download/attachments/" + TEST_PAGE_ID + "/image.png";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            // When body is empty (length 0), headers() is NOT called
            HttpResponse<byte[]> mockResponse = mock(HttpResponse.class);
            when(mockResponse.statusCode()).thenReturn(200);
            when(mockResponse.body()).thenReturn(new byte[0]);
            // Don't stub headers() - it won't be called when body is empty

            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsBytes(anyString(), anyMap())).thenReturn(mockResponse);
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            ImageData result = ConfluenceUtil.downloadImageAsBase64(imageUrl, new HashMap<>());

            assertNull(result);
        }
    }

    @Test
    void testDownloadImageAsBase64_Exception() {
        String imageUrl = TEST_BASE_URL + "/download/attachments/" + TEST_PAGE_ID + "/image.png";

        try (MockedStatic<HttpUtil> mockedHttpUtil = mockStatic(HttpUtil.class)) {
            try {
                mockedHttpUtil.when(() -> HttpUtil.getAsBytes(anyString(), anyMap()))
                        .thenThrow(new RuntimeException("Network error"));
            } catch (Exception e) {
                // Handle checked exceptions from HttpUtil
            }

            ImageData result = ConfluenceUtil.downloadImageAsBase64(imageUrl, new HashMap<>());

            assertNull(result);
        }
    }

    // Helper methods
    private ConfluencePageContent createMockPageContent() {
        ConfluencePageContent pageContent = new ConfluencePageContent();
        pageContent.setId("12345");
        pageContent.setTitle("Test Page");

        ConfluencePageContent.Body body = new ConfluencePageContent.Body();
        ConfluencePageContent.Body.Storage storage = new ConfluencePageContent.Body.Storage();
        storage.setValue("<p>Original content</p>");
        storage.setRepresentation("storage");
        body.setStorage(storage);
        pageContent.setBody(body);

        ConfluencePageContent.Version version = new ConfluencePageContent.Version();
        version.setNumber(1);
        pageContent.setVersion(version);

        return pageContent;
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<String> createMockStringResponse(int statusCode, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(statusCode);
        when(response.body()).thenReturn(body);
        return response;
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<byte[]> createMockBytesResponse(int statusCode, byte[] body, String contentType) {
        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(statusCode);
        when(response.body()).thenReturn(body);

        HttpHeaders headers = mock(HttpHeaders.class);
        when(headers.firstValue("content-type")).thenReturn(Optional.ofNullable(contentType));
        when(response.headers()).thenReturn(headers);

        return response;
    }
}
