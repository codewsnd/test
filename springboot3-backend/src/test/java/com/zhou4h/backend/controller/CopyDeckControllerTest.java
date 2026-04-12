package com.zhou4h.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhou4h.backend.dto.copydeck.CopyDeckAttachmentsRequest;
import com.zhou4h.backend.dto.copydeck.CopyDeckAttachmentResponse;
import com.zhou4h.backend.dto.copydeck.CopDeckUploadRequest;
import com.zhou4h.backend.dto.copydeck.CopyDeckStorageResponse;
import com.zhou4h.backend.dto.copydeck.ImageData;
import com.zhou4h.backend.exception.CustomException;
import com.zhou4h.backend.exception.GlobalExceptionHandler;
import com.zhou4h.backend.service.CopyDeckService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class CopyDeckControllerTest {

    private MockMvc mockMvc;

    private ObjectMapper objectMapper;

    @Mock
    private CopyDeckService copyDeckService;

    @InjectMocks
    private CopyDeckController copyDeckController;

    private String testConfluenceUrl;
    private String testStaffId;

    @BeforeEach
    void setUp() {
        testConfluenceUrl = "https://confluence.example.com/spaces/TEST/pages/12345";
        testStaffId = "staffId123";
        objectMapper = new ObjectMapper();

        // Setup MockMvc with standalone configuration
        mockMvc = MockMvcBuilders.standaloneSetup(copyDeckController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void testGetStorage_Success() throws Exception {
        CopyDeckStorageResponse expectedResponse = new CopyDeckStorageResponse(
                "<p>Test storage content</p>",
                "Test Page"
        );

        when(copyDeckService.getStorage(eq(testStaffId), eq(testConfluenceUrl)))
                .thenReturn(expectedResponse);

        mockMvc.perform(get("/api/chatbycard/copydeck/storage")
                        .param("confluenceUrl", testConfluenceUrl)
                        .param("staffId", testStaffId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storage").value("<p>Test storage content</p>"))
                .andExpect(jsonPath("$.confluenceTitle").value("Test Page"));

        verify(copyDeckService, times(1)).getStorage(testStaffId, testConfluenceUrl);
    }

    @Test
    void testGetStorage_WithException() throws Exception {
        when(copyDeckService.getStorage(any(), any()))
                .thenThrow(new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "Failed to get storage"));

        mockMvc.perform(get("/api/chatbycard/copydeck/storage")
                        .param("confluenceUrl", testConfluenceUrl)
                        .param("staffId", testStaffId))
                .andExpect(status().is5xxServerError());

        verify(copyDeckService, times(1)).getStorage(testStaffId, testConfluenceUrl);
    }

    @Test
    void testGetStorage_MissingParameters() throws Exception {
        mockMvc.perform(get("/api/chatbycard/copydeck/storage")
                        .param("confluenceUrl", testConfluenceUrl))
                .andExpect(status().is4xxClientError());

        verify(copyDeckService, never()).getStorage(any(), any());
    }

    @Test
    void testUploadGetStorage_Success() throws Exception {
        CopDeckUploadRequest request = new CopDeckUploadRequest();
        request.setStaffId(testStaffId);
        request.setConfluenceUrl(testConfluenceUrl);
        request.setStorageHtml("<p>Updated content</p>");
        request.setImages(null);

        doNothing().when(copyDeckService).uploadStorage(any(CopDeckUploadRequest.class));

        mockMvc.perform(post("/api/chatbycard/copydeck/upload")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(copyDeckService, times(1)).uploadStorage(any(CopDeckUploadRequest.class));
    }

    @Test
    void testUploadGetStorage_WithImages() throws Exception {
        List<ImageData> images = new ArrayList<>();
        images.add(new ImageData("image1.png", "base64data1"));
        images.add(new ImageData("image2.png", "base64data2"));

        CopDeckUploadRequest request = new CopDeckUploadRequest();
        request.setStaffId(testStaffId);
        request.setConfluenceUrl(testConfluenceUrl);
        request.setStorageHtml("<p>Content with images</p>");
        request.setImages(images);

        doNothing().when(copyDeckService).uploadStorage(any(CopDeckUploadRequest.class));

        mockMvc.perform(post("/api/chatbycard/copydeck/upload")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(copyDeckService, times(1)).uploadStorage(any(CopDeckUploadRequest.class));
    }

    @Test
    void testUploadGetStorage_WithException() throws Exception {
        CopDeckUploadRequest request = new CopDeckUploadRequest();
        request.setStaffId(testStaffId);
        request.setConfluenceUrl(testConfluenceUrl);
        request.setStorageHtml("<p>Updated content</p>");

        doThrow(new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Failed to upload storage"))
                .when(copyDeckService).uploadStorage(any(CopDeckUploadRequest.class));

        mockMvc.perform(post("/api/chatbycard/copydeck/upload")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().is5xxServerError());

        verify(copyDeckService, times(1)).uploadStorage(any(CopDeckUploadRequest.class));
    }

    @Test
    void testUploadGetStorage_InvalidRequestBody() throws Exception {
        mockMvc.perform(post("/api/chatbycard/copydeck/upload")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{invalid json}"))
                .andExpect(status().is4xxClientError());

        verify(copyDeckService, never()).uploadStorage(any());
    }

    @Test
    void testGetAttachments_Success() throws Exception {
        List<String> fileNames = Arrays.asList("image1.png", "image2.png");
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId(testStaffId);
        request.setConfluenceUrl(testConfluenceUrl);
        request.setFileNames(fileNames);

        List<ImageData> imageDataList = new ArrayList<>();
        imageDataList.add(new ImageData("image1.png", "base64data1"));
        imageDataList.add(new ImageData("image2.png", "base64data2"));

        CopyDeckAttachmentResponse expectedResponse = new CopyDeckAttachmentResponse(imageDataList);

        when(copyDeckService.getAttachments(any(CopyDeckAttachmentsRequest.class)))
                .thenReturn(expectedResponse);

        mockMvc.perform(post("/api/chatbycard/copydeck/getAttachments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images").isArray())
                .andExpect(jsonPath("$.images.length()").value(2))
                .andExpect(jsonPath("$.images[0].fileName").value("image1.png"))
                .andExpect(jsonPath("$.images[0].base64").value("base64data1"))
                .andExpect(jsonPath("$.images[1].fileName").value("image2.png"))
                .andExpect(jsonPath("$.images[1].base64").value("base64data2"));

        verify(copyDeckService, times(1)).getAttachments(any(CopyDeckAttachmentsRequest.class));
    }

    @Test
    void testGetAttachments_EmptyResult() throws Exception {
        List<String> fileNames = Arrays.asList("missing.png");
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId(testStaffId);
        request.setConfluenceUrl(testConfluenceUrl);
        request.setFileNames(fileNames);

        CopyDeckAttachmentResponse expectedResponse = new CopyDeckAttachmentResponse(new ArrayList<>());

        when(copyDeckService.getAttachments(any(CopyDeckAttachmentsRequest.class)))
                .thenReturn(expectedResponse);

        mockMvc.perform(post("/api/chatbycard/copydeck/getAttachments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images").isArray())
                .andExpect(jsonPath("$.images.length()").value(0));

        verify(copyDeckService, times(1)).getAttachments(any(CopyDeckAttachmentsRequest.class));
    }

    @Test
    void testGetAttachments_WithException() throws Exception {
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId(testStaffId);
        request.setConfluenceUrl(testConfluenceUrl);
        request.setFileNames(Arrays.asList("image1.png"));

        when(copyDeckService.getAttachments(any(CopyDeckAttachmentsRequest.class)))
                .thenThrow(new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "Failed to get attachments"));

        mockMvc.perform(post("/api/chatbycard/copydeck/getAttachments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().is5xxServerError());

        verify(copyDeckService, times(1)).getAttachments(any(CopyDeckAttachmentsRequest.class));
    }

    @Test
    void testGetAttachments_InvalidRequestBody() throws Exception {
        mockMvc.perform(post("/api/chatbycard/copydeck/getAttachments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{invalid json}"))
                .andExpect(status().is4xxClientError());

        verify(copyDeckService, never()).getAttachments(any());
    }

    @Test
    void testGetAttachments_MissingContentType() throws Exception {
        CopyDeckAttachmentsRequest request = new CopyDeckAttachmentsRequest();
        request.setStaffId(testStaffId);
        request.setConfluenceUrl(testConfluenceUrl);
        request.setFileNames(Arrays.asList("image1.png"));

        mockMvc.perform(post("/api/chatbycard/copydeck/getAttachments")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().is4xxClientError());

        verify(copyDeckService, never()).getAttachments(any());
    }
}
