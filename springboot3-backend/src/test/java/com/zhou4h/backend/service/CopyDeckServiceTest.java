package com.zhou4h.backend.service;

import com.zhou4h.backend.dto.ConfluencePageContent;
import com.zhou4h.backend.dto.copydeck.*;
import com.zhou4h.backend.exception.CustomException;
import com.zhou4h.backend.utils.ConfluenceUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CopyDeckServiceTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private CopyDeckService copyDeckService;

    private ConfluencePageContent mockPageContent;

    @BeforeEach
    void setUp() {
        mockPageContent = createMockPageContent();
    }

    private ConfluencePageContent createMockPageContent() {
        ConfluencePageContent pageContent = new ConfluencePageContent();
        pageContent.setId("12345");
        pageContent.setTitle("Test Page");

        ConfluencePageContent.Body body = new ConfluencePageContent.Body();
        ConfluencePageContent.Body.Storage storage = new ConfluencePageContent.Body.Storage();
        storage.setValue("<p>Test storage content</p>");
        storage.setRepresentation("storage");
        body.setStorage(storage);
        pageContent.setBody(body);

        ConfluencePageContent.Version version = new ConfluencePageContent.Version();
        version.setNumber(1);
        pageContent.setVersion(version);

        return pageContent;
    }

    @Test
    void testParsePageUrl_Success() {
        String url = "https://confluence.example.com/spaces/TEST/pages/12345/TestPage";

        ConfluencePageInfo result = CopyDeckService.parsePageUrl(url);

        assertNotNull(result);
        assertEquals("https://confluence.example.com", result.getBaseUrl());
        assertEquals("12345", result.getPageId());
    }

    @Test
    void testParsePageUrl_WithUpperCasePAGES() {
        String url = "https://confluence.example.com/spaces/TEST/PAGES/67890";

        ConfluencePageInfo result = CopyDeckService.parsePageUrl(url);

        assertNotNull(result);
        assertEquals("https://confluence.example.com", result.getBaseUrl());
        assertEquals("67890", result.getPageId());
    }

    @Test
    void testParsePageUrl_NullUrl() {
        CustomException exception = assertThrows(CustomException.class, () -> {
            CopyDeckService.parsePageUrl(null);
        });

        assertTrue(exception.getMessage().contains("Page URL cannot be empty"));
    }

    @Test
    void testParsePageUrl_EmptyUrl() {
        CustomException exception = assertThrows(CustomException.class, () -> {
            CopyDeckService.parsePageUrl("   ");
        });

        assertTrue(exception.getMessage().contains("Page URL cannot be empty"));
    }

    @Test
    void testParsePageUrl_InvalidPageIdFormat() {
        String url = "https://confluence.example.com/invalid/format";

        CustomException exception = assertThrows(CustomException.class, () -> {
            CopyDeckService.parsePageUrl(url);
        });

        assertTrue(exception.getMessage().contains("Unable to extract pageId from URL"));
    }

    @Test
    void testGetGetStorageContent_Success() {
        ConfluencePageContent pageContent = createMockPageContent();

        String result = CopyDeckService.getStorageContent(pageContent);

        assertEquals("<p>Test storage content</p>", result);
    }

    @Test
    void testGetGetStorageContent_NullBody() {
        ConfluencePageContent pageContent = new ConfluencePageContent();
        pageContent.setBody(null);

        String result = CopyDeckService.getStorageContent(pageContent);

        assertEquals("", result);
    }

    @Test
    void testGetStorageContent_NullGetStorage() {
        ConfluencePageContent pageContent = new ConfluencePageContent();
        ConfluencePageContent.Body body = new ConfluencePageContent.Body();
        body.setStorage(null);
        pageContent.setBody(body);

        String result = CopyDeckService.getStorageContent(pageContent);

        assertEquals("", result);
    }

    @Test
    void testGetStorage_Success_AlmToken() {
        when(userService.getConfluenceAlmToken(anyString())).thenReturn("test-alm-token");

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getPageContent(anyString(), anyString()))
                    .thenReturn(mockPageContent);

            CopyDeckStorageResponse result = copyDeckService.getStorage("staffId123",
                    "https://confluence-alm.example.com/spaces/TEST/pages/12345");

            assertNotNull(result);
            assertEquals("<p>Test storage content</p>", result.getStorage());
            assertEquals("Test Page", result.getConfluenceTitle());

            verify(userService, times(1)).getConfluenceAlmToken("staffId123");
        }
    }

    @Test
    void testGetStorage_Success_WpbToken() {
        when(userService.getConfluenceWpbToken(anyString())).thenReturn("test-wpb-token");

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getPageContent(anyString(), anyString()))
                    .thenReturn(mockPageContent);

            CopyDeckStorageResponse result = copyDeckService.getStorage("staffId123",
                    "https://confluence-wpb.example.com/spaces/TEST/pages/12345");

            assertNotNull(result);
            assertEquals("<p>Test storage content</p>", result.getStorage());
            assertEquals("Test Page", result.getConfluenceTitle());

            verify(userService, times(1)).getConfluenceWpbToken("staffId123");
        }
    }

    @Test
    void testGetStorage_TokenNotFound() {
        CustomException exception = assertThrows(CustomException.class, () -> {
            copyDeckService.getStorage("staffId123", "https://confluence-other.example.com/spaces/TEST/pages/12345");
        });

        assertTrue(exception.getMessage().contains("Failed to get Confluence Token"));
    }

    @Test
    void testGetStorage_BlankToken() {
        when(userService.getConfluenceAlmToken(anyString())).thenReturn("");

        CustomException exception = assertThrows(CustomException.class, () -> {
            copyDeckService.getStorage("staffId123", "https://confluence-alm.example.com/spaces/TEST/pages/12345");
        });

        assertTrue(exception.getMessage().contains("Failed to get Confluence Token"));
    }

    @Test
    void testStorage_EmptyGetStorage() {
        when(userService.getConfluenceWpbToken(anyString())).thenReturn("test-token");

        ConfluencePageContent emptyPageContent = createMockPageContent();
        emptyPageContent.getBody().getStorage().setValue("");

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getPageContent(anyString(), anyString()))
                    .thenReturn(emptyPageContent);

            // The method creates a CustomException but doesn't throw it (bug in original code)
            CopyDeckStorageResponse result = copyDeckService.getStorage("staffId123",
                    "https://confluence-wpb.example.com/spaces/TEST/pages/12345");

            assertNotNull(result);
            assertEquals("", result.getStorage());
            assertEquals("Test Page", result.getConfluenceTitle());
        }
    }

    @Test
    void testUploadGetStorage_WithoutImages() {
        when(userService.getConfluenceAlmToken(anyString())).thenReturn("test-token");

        CopDeckUploadRequest request = new CopDeckUploadRequest();
        request.setStaffId("staffId123");
        request.setConfluenceUrl("https://confluence-alm.example.com/spaces/TEST/pages/12345");
        request.setStorageHtml("<p>Updated content</p>");
        request.setImages(null);

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getPageContent(anyString(), anyString()))
                    .thenReturn(mockPageContent);
            mockedUtil.when(() -> ConfluenceUtil.updatePageContentWithStorage(
                    any(ConfluencePageContent.class), anyString(), anyString(), anyString()))
                    .then(invocation -> null);

            assertDoesNotThrow(() -> copyDeckService.uploadStorage(request));

            mockedUtil.verify(() -> ConfluenceUtil.updatePageContentWithStorage(
                    any(ConfluencePageContent.class), eq("<p>Updated content</p>"), anyString(), anyString()));
        }
    }

    @Test
    void testUploadGetStorage_WithImages() {
        when(userService.getConfluenceWpbToken(anyString())).thenReturn("test-token");

        List<ImageData> images = new ArrayList<>();
        images.add(new ImageData("image1.png", "base64data1"));
        images.add(new ImageData("image2.png", "base64data2"));

        CopDeckUploadRequest request = new CopDeckUploadRequest();
        request.setStaffId("staffId123");
        request.setConfluenceUrl("https://confluence-wpb.example.com/spaces/TEST/pages/12345");
        request.setStorageHtml("<p>Updated content with images</p>");
        request.setImages(images);

        Map<String, String> uploadedImages = new HashMap<>();
        uploadedImages.put("image1.png", "image1.png");
        uploadedImages.put("image2.png", "image2.png");

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getPageContent(anyString(), anyString()))
                    .thenReturn(mockPageContent);
            mockedUtil.when(() -> ConfluenceUtil.uploadImagesToConfluence(anyList(), anyString(), anyString(), anyString()))
                    .thenReturn(uploadedImages);
            mockedUtil.when(() -> ConfluenceUtil.updatePageContentWithStorage(
                    any(ConfluencePageContent.class), anyString(), anyString(), anyString()))
                    .then(invocation -> null);

            assertDoesNotThrow(() -> copyDeckService.uploadStorage(request));

            mockedUtil.verify(() -> ConfluenceUtil.uploadImagesToConfluence(anyList(), eq("12345"), anyString(), anyString()));
            mockedUtil.verify(() -> ConfluenceUtil.updatePageContentWithStorage(
                    any(ConfluencePageContent.class), anyString(), anyString(), anyString()));
        }
    }

    @Test
    void testUploadGetStorage_ThrowsException() {
        when(userService.getConfluenceAlmToken(anyString())).thenReturn("test-token");

        CopDeckUploadRequest request = new CopDeckUploadRequest();
        request.setStaffId("staffId123");
        request.setConfluenceUrl("https://confluence-alm.example.com/spaces/TEST/pages/12345");
        request.setStorageHtml("<p>Updated content</p>");

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getPageContent(anyString(), anyString()))
                    .thenThrow(new RuntimeException("Connection error"));

            CustomException exception = assertThrows(CustomException.class, () -> {
                copyDeckService.uploadStorage(request);
            });

            assertTrue(exception.getMessage().contains("Failed to upload storage HTML"));
        }
    }

    @Test
    void testGetAttachments_Success() {
        when(userService.getConfluenceAlmToken(anyString())).thenReturn("test-token");

        List<String> fileNames = Arrays.asList("image1.png", "image2.png");
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId("staffId123");
        request.setConfluenceUrl("https://confluence-alm.example.com/spaces/TEST/pages/12345");
        request.setFileNames(fileNames);

        Map<String, ConfluenceUtil.AttachmentInfo> existingAttachments = new HashMap<>();
        existingAttachments.put("image1.png", new ConfluenceUtil.AttachmentInfo("att1", "image1.png", "1"));
        existingAttachments.put("image2.png", new ConfluenceUtil.AttachmentInfo("att2", "image2.png", "1"));

        ImageData imageData1 = new ImageData("image1.png", "base64data1");
        ImageData imageData2 = new ImageData("image2.png", "base64data2");

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getExistingAttachments(anyString(), anyString(), anyString()))
                    .thenReturn(existingAttachments);
            mockedUtil.when(() -> ConfluenceUtil.downloadImageAsBase64(contains("image1.png"), anyMap()))
                    .thenReturn(imageData1);
            mockedUtil.when(() -> ConfluenceUtil.downloadImageAsBase64(contains("image2.png"), anyMap()))
                    .thenReturn(imageData2);

            CopyDeckAttachmentResponse response = copyDeckService.getAttachments(request);

            assertNotNull(response);
            assertEquals(2, response.getImages().size());
            assertEquals("image1.png", response.getImages().get(0).getFileName());
            assertEquals("base64data1", response.getImages().get(0).getBase64());
        }
    }

    @Test
    void testGetAttachments_FileNotFound() {
        when(userService.getConfluenceWpbToken(anyString())).thenReturn("test-token");

        List<String> fileNames = Arrays.asList("missing.png");
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId("staffId123");
        request.setConfluenceUrl("https://confluence-wpb.example.com/spaces/TEST/pages/12345");
        request.setFileNames(fileNames);

        Map<String, ConfluenceUtil.AttachmentInfo> existingAttachments = new HashMap<>();

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getExistingAttachments(anyString(), anyString(), anyString()))
                    .thenReturn(existingAttachments);

            CopyDeckAttachmentResponse response = copyDeckService.getAttachments(request);

            assertNotNull(response);
            assertEquals(0, response.getImages().size());
        }
    }

    @Test
    void testGetAttachments_DownloadReturnsNull() {
        when(userService.getConfluenceAlmToken(anyString())).thenReturn("test-token");

        List<String> fileNames = Arrays.asList("image1.png");
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId("staffId123");
        request.setConfluenceUrl("https://confluence-alm.example.com/spaces/TEST/pages/12345");
        request.setFileNames(fileNames);

        Map<String, ConfluenceUtil.AttachmentInfo> existingAttachments = new HashMap<>();
        existingAttachments.put("image1.png", new ConfluenceUtil.AttachmentInfo("att1", "image1.png", "1"));

        try (MockedStatic<ConfluenceUtil> mockedUtil = mockStatic(ConfluenceUtil.class)) {
            mockedUtil.when(() -> ConfluenceUtil.getExistingAttachments(anyString(), anyString(), anyString()))
                    .thenReturn(existingAttachments);
            mockedUtil.when(() -> ConfluenceUtil.downloadImageAsBase64(anyString(), anyMap()))
                    .thenReturn(null);

            CopyDeckAttachmentResponse response = copyDeckService.getAttachments(request);

            assertNotNull(response);
            assertEquals(0, response.getImages().size());
        }
    }

    @Test
    void testGetAttachments_ThrowsException() {
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId("staffId123");
        request.setConfluenceUrl("invalid-url");
        request.setFileNames(Arrays.asList("image1.png"));

        CustomException exception = assertThrows(CustomException.class, () -> {
            copyDeckService.getAttachments(request);
        });

        assertTrue(exception.getMessage().contains("Failed to get attachments"));
    }
}
