package com.mytest.springboot3.controller;

import com.mytest.springboot3.entity.ChatDocumentInfo;
import com.mytest.springboot3.repository.ChatDocumentInfoRepository;
import com.mytest.springboot3.service.ChatDocumentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class S3DocumentControllerTest {

    private static final DefaultDataBufferFactory BUFFER_FACTORY = new DefaultDataBufferFactory();

    @Mock
    private ChatDocumentService chatDocumentService;

    @Mock
    private ChatDocumentInfoRepository chatDocumentInfoRepository;

    @Mock
    private S3AsyncClient s3AsyncClient;

    @Mock
    private S3Presigner s3Presigner;

    private S3DocumentController controller;

    @BeforeEach
    void setUp() {
        controller = spy(new S3DocumentController(
                chatDocumentService,
                chatDocumentInfoRepository,
                s3AsyncClient,
                s3Presigner
        ));
        ReflectionTestUtils.setField(controller, "bucketName", "test-bucket");
    }

    @Test
    void uploadFile_shouldCoverValidationAndSuccessBranches() {
        ResponseEntity<Map<String, Object>> nullFileResponse = controller.uploadFile(null).block();
        assertEquals(400, nullFileResponse.getStatusCode().value());
        assertEquals("File is empty", nullFileResponse.getBody().get("message"));

        FilePart blankNameFile = mock(FilePart.class);
        when(blankNameFile.filename()).thenReturn("   ");
        ResponseEntity<Map<String, Object>> blankNameResponse = controller.uploadFile(blankNameFile).block();
        assertEquals(400, blankNameResponse.getStatusCode().value());
        assertEquals("File name cannot be empty", blankNameResponse.getBody().get("message"));

        FilePart textFile = mockFilePart("note.txt", "hello".getBytes(StandardCharsets.UTF_8), MediaType.TEXT_PLAIN);
        when(chatDocumentInfoRepository.save(any(ChatDocumentInfo.class))).thenAnswer(invocation -> {
            ChatDocumentInfo documentInfo = invocation.getArgument(0);
            documentInfo.setId(1L);
            return Mono.just(documentInfo);
        });

        ResponseEntity<Map<String, Object>> textResponse = controller.uploadFile(textFile).block();
        assertEquals(200, textResponse.getStatusCode().value());
        assertEquals(true, textResponse.getBody().get("success"));
        assertEquals("completed", textResponse.getBody().get("status"));
        assertEquals("hello", textResponse.getBody().get("content"));
        assertNotNull(textResponse.getBody().get("md5"));
        verify(chatDocumentInfoRepository).save(any(ChatDocumentInfo.class));
        verifyNoInteractions(s3AsyncClient);
    }

    @Test
    void uploadFile_shouldCoverNonTextAndErrorBranches() {
        doNothing().when(controller).processFileAsyncWithRandom(any(), any());
        when(s3AsyncClient.putObject(any(PutObjectRequest.class), any(AsyncRequestBody.class)))
                .thenReturn(CompletableFuture.completedFuture(PutObjectResponse.builder().eTag("ok").build()));
        when(chatDocumentInfoRepository.save(any(ChatDocumentInfo.class))).thenAnswer(invocation -> {
            ChatDocumentInfo documentInfo = invocation.getArgument(0);
            documentInfo.setId(2L);
            return Mono.just(documentInfo);
        });

        FilePart pdfFile = mockFilePart("report.pdf", "pdf".getBytes(StandardCharsets.UTF_8), null);
        ResponseEntity<Map<String, Object>> pdfResponse = controller.uploadFile(pdfFile).block();
        assertEquals(200, pdfResponse.getStatusCode().value());
        assertEquals("processing", pdfResponse.getBody().get("status"));
        assertTrue(((String) pdfResponse.getBody().get("s3Path")).startsWith("documents/123/upload/"));

        ArgumentCaptor<PutObjectRequest> putObjectCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(s3AsyncClient).putObject(putObjectCaptor.capture(), any(AsyncRequestBody.class));
        assertEquals("application/octet-stream", putObjectCaptor.getValue().contentType());
        verify(controller).processFileAsyncWithRandom(any(), Mockito.eq("report.pdf"));

        FilePart largeFile = mockFilePart("big.pdf", new byte[10 * 1024 * 1024 + 1], MediaType.APPLICATION_PDF);
        ResponseEntity<Map<String, Object>> largeResponse = controller.uploadFile(largeFile).block();
        assertEquals(500, largeResponse.getStatusCode().value());
        assertEquals("Failed to upload file: File size cannot exceed 10MB", largeResponse.getBody().get("message"));

        FilePart failingFile = mock(FilePart.class);
        when(failingFile.filename()).thenReturn("broken.txt");
        when(failingFile.headers()).thenReturn(null);
        when(failingFile.content()).thenReturn(Flux.just(BUFFER_FACTORY.wrap("boom".getBytes(StandardCharsets.UTF_8))));

        ResponseEntity<Map<String, Object>> failingResponse = controller.uploadFile(failingFile).block();
        assertEquals(500, failingResponse.getStatusCode().value());
        assertTrue(((String) failingResponse.getBody().get("message")).contains("Error processing file"));
    }

    @Test
    void uploadMultipleFiles_shouldCoverSuccessEmptyAndErrorBranches() {
        doNothing().when(controller).processFileAsync(any());
        when(s3AsyncClient.putObject(any(PutObjectRequest.class), any(AsyncRequestBody.class)))
                .thenReturn(CompletableFuture.completedFuture(PutObjectResponse.builder().build()));
        when(chatDocumentInfoRepository.save(any(ChatDocumentInfo.class))).thenAnswer(invocation -> {
            ChatDocumentInfo documentInfo = invocation.getArgument(0);
            documentInfo.setId(documentInfo.getDocumentName().endsWith(".txt") ? 10L : 11L);
            return Mono.just(documentInfo);
        });

        FilePart textFile = mockFilePart("batch.txt", "hello".getBytes(StandardCharsets.UTF_8), MediaType.TEXT_PLAIN);
        FilePart imageFile = mockFilePart("image.png", "png".getBytes(StandardCharsets.UTF_8), null);

        ResponseEntity<Map<String, Object>> successResponse = controller.uploadMultipleFiles(Flux.just(textFile, imageFile)).block();
        assertEquals(200, successResponse.getStatusCode().value());
        assertEquals(2, successResponse.getBody().get("totalFiles"));
        assertInstanceOf(Iterable.class, successResponse.getBody().get("files"));
        verify(controller, times(1)).processFileAsync(any());

        ResponseEntity<Map<String, Object>> emptyResponse = controller.uploadMultipleFiles(Flux.empty()).block();
        assertEquals(400, emptyResponse.getStatusCode().value());
        assertEquals("No files provided", emptyResponse.getBody().get("message"));

        FilePart errorFile = mock(FilePart.class);
        when(errorFile.filename()).thenReturn("broken.bin");
        when(errorFile.headers()).thenReturn(null);
        when(errorFile.content()).thenReturn(Flux.just(BUFFER_FACTORY.wrap("broken".getBytes(StandardCharsets.UTF_8))));

        ResponseEntity<Map<String, Object>> errorResponse = controller.uploadMultipleFiles(Flux.just(errorFile)).block();
        assertEquals(500, errorResponse.getStatusCode().value());
        assertTrue(((String) errorResponse.getBody().get("message")).contains("Error processing file: broken.bin"));
    }

    @Test
    void downloadDocument_shouldCoverTextS3AndFallbackBranches() {
        ChatDocumentInfo textDocument = document(20L, "bad\u4e2d__name.txt", "txt", "hello", null, "completed");
        when(chatDocumentInfoRepository.findById(20L)).thenReturn(Mono.just(textDocument));

        ResponseEntity<byte[]> textResponse = controller.downloadDocument(20L).block();
        assertEquals(200, textResponse.getStatusCode().value());
        assertEquals(MediaType.TEXT_PLAIN, textResponse.getHeaders().getContentType());
        assertEquals("attachment; filename=\"bad_name.txt\"", textResponse.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertEquals("hello", new String(textResponse.getBody(), StandardCharsets.UTF_8));

        ChatDocumentInfo s3Document = document(21L, "report.pdf", "pdf", null, "documents/path/report.pdf", "processing");
        when(chatDocumentInfoRepository.findById(21L)).thenReturn(Mono.just(s3Document));
        when(chatDocumentService.downloadDocument(21L)).thenReturn(Mono.just("pdf".getBytes(StandardCharsets.UTF_8)));

        ResponseEntity<byte[]> s3Response = controller.downloadDocument(21L).block();
        assertEquals(200, s3Response.getStatusCode().value());
        assertEquals(MediaType.APPLICATION_OCTET_STREAM, s3Response.getHeaders().getContentType());
        assertEquals("pdf", new String(s3Response.getBody(), StandardCharsets.UTF_8));

        ChatDocumentInfo missingContent = document(22L, "ghost.pdf", "pdf", null, "", "processing");
        when(chatDocumentInfoRepository.findById(22L)).thenReturn(Mono.just(missingContent));
        ResponseEntity<byte[]> missingContentResponse = controller.downloadDocument(22L).block();
        assertEquals(404, missingContentResponse.getStatusCode().value());

        when(chatDocumentInfoRepository.findById(23L)).thenReturn(Mono.empty());
        ResponseEntity<byte[]> notFoundResponse = controller.downloadDocument(23L).block();
        assertEquals(404, notFoundResponse.getStatusCode().value());
    }

    @Test
    void getDownloadUrl_shouldCoverDirectPresignedAndErrorBranches() throws MalformedURLException {
        ChatDocumentInfo textDocument = document(30L, "note.txt", "txt", "hello", null, "completed");
        when(chatDocumentInfoRepository.findById(30L)).thenReturn(Mono.just(textDocument));
        ResponseEntity<Map<String, Object>> directResponse = controller.getDownloadUrl(30L).block();
        assertEquals(200, directResponse.getStatusCode().value());
        assertEquals(true, directResponse.getBody().get("isDirectDownload"));
        assertEquals("/api/document/download/30", directResponse.getBody().get("downloadUrl"));

        ChatDocumentInfo binaryDocument = document(31L, "report.pdf", "pdf", null, "documents/31", "processing");
        PresignedGetObjectRequest presignedRequest = mock(PresignedGetObjectRequest.class);
        when(presignedRequest.url()).thenReturn(new URL("https://example.com/download"));
        when(chatDocumentInfoRepository.findById(31L)).thenReturn(Mono.just(binaryDocument));
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenReturn(presignedRequest);

        ResponseEntity<Map<String, Object>> presignedResponse = controller.getDownloadUrl(31L).block();
        assertEquals(200, presignedResponse.getStatusCode().value());
        assertEquals("https://example.com/download", presignedResponse.getBody().get("downloadUrl"));
        assertEquals("1 hour", presignedResponse.getBody().get("expiresIn"));

        ChatDocumentInfo missingS3Document = document(32L, "report.pdf", "pdf", null, "", "processing");
        when(chatDocumentInfoRepository.findById(32L)).thenReturn(Mono.just(missingS3Document));
        ResponseEntity<Map<String, Object>> missingS3Response = controller.getDownloadUrl(32L).block();
        assertEquals(404, missingS3Response.getStatusCode().value());
        assertNull(missingS3Response.getBody());

        ChatDocumentInfo s3ErrorDocument = document(33L, "report.pdf", "pdf", null, "documents/33", "processing");
        when(chatDocumentInfoRepository.findById(33L)).thenReturn(Mono.just(s3ErrorDocument));
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenThrow(new RuntimeException("S3 timeout"));
        ResponseEntity<Map<String, Object>> s3ErrorResponse = controller.getDownloadUrl(33L).block();
        assertEquals(500, s3ErrorResponse.getStatusCode().value());
        assertEquals("File not available for download", s3ErrorResponse.getBody().get("message"));

        ChatDocumentInfo genericErrorDocument = document(35L, "report.pdf", "pdf", null, "documents/35", "processing");
        when(chatDocumentInfoRepository.findById(35L)).thenReturn(Mono.just(genericErrorDocument));
        when(s3Presigner.presignGetObject(any(GetObjectPresignRequest.class))).thenThrow(new RuntimeException("boom"));
        ResponseEntity<Map<String, Object>> genericErrorResponse = controller.getDownloadUrl(35L).block();
        assertEquals(500, genericErrorResponse.getStatusCode().value());
        assertEquals("Failed to generate download URL. Please try again later.", genericErrorResponse.getBody().get("message"));

        when(chatDocumentInfoRepository.findById(34L)).thenReturn(Mono.empty());
        ResponseEntity<Map<String, Object>> notFoundResponse = controller.getDownloadUrl(34L).block();
        assertEquals(404, notFoundResponse.getStatusCode().value());
        assertNull(notFoundResponse.getBody());
    }

    @Test
    void deleteDocument_shouldCoverSuccessAndErrorBranches() {
        when(chatDocumentService.deleteDocument(40L)).thenReturn(Mono.empty());
        ResponseEntity<Map<String, Object>> successResponse = controller.deleteDocument(40L).block();
        assertEquals(200, successResponse.getStatusCode().value());
        assertEquals("Document deleted successfully", successResponse.getBody().get("message"));

        when(chatDocumentService.deleteDocument(41L)).thenReturn(Mono.error(new RuntimeException("cannot delete")));
        ResponseEntity<Map<String, Object>> errorResponse = controller.deleteDocument(41L).block();
        assertEquals(500, errorResponse.getStatusCode().value());
        assertEquals("Failed to delete document: cannot delete", errorResponse.getBody().get("message"));
    }

    @Test
    void helperMethods_shouldCoverBranchyPrivateUtilities() throws Exception {
        assertEquals("", invokeString("getDocumentType", (Object) null));
        assertEquals("", invokeString("getDocumentType", ""));
        assertEquals("pdf", invokeString("getDocumentType", "report.PDF"));
        assertEquals("", invokeString("getDocumentType", "no-extension"));

        assertFalse((Boolean) invoke("isTextFile", (Object) null));
        assertFalse((Boolean) invoke("isTextFile", ""));
        assertTrue((Boolean) invoke("isTextFile", "txt"));
        assertTrue((Boolean) invoke("isTextFile", "md"));
        assertTrue((Boolean) invoke("isTextFile", "sql"));
        assertTrue((Boolean) invoke("isTextFile", "csv"));
        assertFalse((Boolean) invoke("isTextFile", "pdf"));

        String s3Path = invokeString("generateS3Path");
        assertTrue(s3Path.startsWith("documents/123/upload/"));

        assertEquals("download", invokeString("sanitizeFileName", (Object) null));
        assertEquals("download", invokeString("sanitizeFileName", ""));
        assertEquals("bad_name.txt", invokeString("sanitizeFileName", "bad\u4e2d__name.txt"));
        assertEquals("download", invokeString("sanitizeFileName", "\u4e2d\u6587"));

        String longFileName = "a".repeat(150) + ".pdf";
        String sanitizedLong = invokeString("sanitizeFileName", longFileName);
        assertTrue(sanitizedLong.endsWith(".pdf"));
        assertEquals(100, sanitizedLong.length());

        assertEquals("5d41402abc4b2a76b9719d911017c592", invokeString("calculateMD5", "hello".getBytes(StandardCharsets.UTF_8)));

        try (MockedStatic<MessageDigest> mockedDigest = mockStatic(MessageDigest.class)) {
            mockedDigest.when(() -> MessageDigest.getInstance("MD5")).thenThrow(new NoSuchAlgorithmException("missing"));
            InvocationTargetException exception = assertThrows(
                    InvocationTargetException.class,
                    () -> method("calculateMD5", byte[].class).invoke(controller, "x".getBytes(StandardCharsets.UTF_8))
            );
            assertTrue(exception.getCause().getMessage().contains("MD5 algorithm not available"));
        }
    }

    @Test
    void asyncHelpers_shouldCoverSuccessAndInterruptedBranches() {
        ChatDocumentInfo randomDocument = document(50L, "random.pdf", "pdf", null, "documents/50", "processing");
        ChatDocumentInfo plainDocument = document(51L, "plain.pdf", "pdf", null, "documents/51", "processing");
        when(chatDocumentInfoRepository.findByJobId("job-random")).thenReturn(Mono.just(randomDocument));
        when(chatDocumentInfoRepository.findByJobId("job-plain")).thenReturn(Mono.just(plainDocument));
        when(chatDocumentInfoRepository.save(any(ChatDocumentInfo.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        try (MockedStatic<CompletableFuture> futureMock = mockStatic(CompletableFuture.class)) {
            futureMock.when(() -> CompletableFuture.runAsync(any(Runnable.class))).thenAnswer(invocation -> {
                Runnable runnable = invocation.getArgument(0);
                runnable.run();
                return CompletableFuture.completedFuture(null);
            });

            controller.processFileAsyncWithRandom("job-random", "random.pdf");
            controller.processFileAsync("job-plain");
        }

        assertEquals("completed", randomDocument.getStatus());
        assertEquals("random.pdf", randomDocument.getContent());
        assertEquals("completed", plainDocument.getStatus());
        verify(chatDocumentInfoRepository, times(2)).save(any(ChatDocumentInfo.class));

        try (MockedStatic<CompletableFuture> futureMock = mockStatic(CompletableFuture.class)) {
            futureMock.when(() -> CompletableFuture.runAsync(any(Runnable.class))).thenAnswer(invocation -> {
                Runnable runnable = invocation.getArgument(0);
                runnable.run();
                return CompletableFuture.completedFuture(null);
            });

            Thread.currentThread().interrupt();
            controller.processFileAsyncWithRandom("job-random", "random.pdf");
            controller.processFileAsync("job-plain");
            assertTrue(Thread.currentThread().isInterrupted());
            Thread.interrupted();
        }
    }

    private FilePart mockFilePart(String fileName, byte[] content, MediaType contentType) {
        FilePart filePart = mock(FilePart.class);
        HttpHeaders headers = new HttpHeaders();
        if (contentType != null) {
            headers.setContentType(contentType);
        }
        when(filePart.filename()).thenReturn(fileName);
        Mockito.lenient().when(filePart.headers()).thenReturn(headers);
        when(filePart.content()).thenReturn(Flux.just(BUFFER_FACTORY.wrap(content)));
        return filePart;
    }

    private ChatDocumentInfo document(Long id, String name, String type, String content, String s3Path, String status) {
        LocalDateTime now = LocalDateTime.now();
        return ChatDocumentInfo.builder()
                .id(id)
                .documentName(name)
                .documentType(type)
                .content(content)
                .fileSize(5L)
                .uploadTime(now)
                .createTime(now)
                .updateTime(now)
                .stuffId("123")
                .status(status)
                .s3Path(s3Path)
                .jobId("job-" + id)
                .md5("hash")
                .build();
    }

    private Object invoke(String name, Object... args) throws Exception {
        Class<?>[] types = new Class<?>[args.length];
        for (int i = 0; i < args.length; i++) {
            types[i] = args[i] instanceof byte[] ? byte[].class : String.class;
        }
        Method method = method(name, types);
        return method.invoke(controller, args);
    }

    private String invokeString(String name, Object... args) throws Exception {
        return (String) invoke(name, args);
    }

    private Method method(String name, Class<?>... parameterTypes) throws NoSuchMethodException {
        Method method = S3DocumentController.class.getDeclaredMethod(name, parameterTypes);
        method.setAccessible(true);
        return method;
    }
}
