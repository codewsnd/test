package com.zhou4h.springboot3.service;

import com.zhou4h.springboot3.entity.ChatDocumentInfo;
import com.zhou4h.springboot3.repository.ChatDocumentInfoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.core.BytesWrapper;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatDocumentService {

    private final S3AsyncClient s3AsyncClient;
    private final ChatDocumentInfoRepository chatDocumentInfoRepository;

    @Value("${aws.s3.bucket-name:my-bucket}")
    private String bucketName;

    private static final String STUFF_ID = "123";

    public Mono<ChatDocumentInfo> uploadFile(FilePart filePart) {
        String fileName = filePart.filename();
        String documentType = getDocumentType(fileName);
        String jobId = UUID.randomUUID().toString();
        String s3Path = generateS3Path(fileName);

        LocalDateTime now = LocalDateTime.now();

        return filePart.content()
                .reduce(new ByteArrayOutputStream(), (baos, buffer) -> {
                    try {
                        byte[] bytes = new byte[buffer.readableByteCount()];
                        buffer.read(bytes);
                        baos.write(bytes);
                        return baos;
                    } catch (IOException e) {
                        throw new RuntimeException("Error reading file content", e);
                    }
                })
                .flatMap(baos -> {
                    byte[] fileBytes = baos.toByteArray();
                    long fileSize = fileBytes.length;

                    // Check if file type supports content extraction
                    boolean isTextFile = isTextFile(documentType);
                    String content = null;
                    String status = "processing";

                    if (isTextFile) {
                        content = new String(fileBytes, StandardCharsets.UTF_8);
                        status = "completed";
                    }

                    // Create document info
                    ChatDocumentInfo documentInfo = ChatDocumentInfo.builder()
                            .documentName(fileName)
                            .documentType(documentType)
                            .content(content)
                            .fileSize(fileSize)
                            .uploadTime(now)
                            .createTime(now)
                            .updateTime(now)
                            .stuffId(STUFF_ID)
                            .status(status)
                            .s3Path(s3Path)
                            .jobId(jobId)
                            .build();

                    // Upload to S3 first
                    return uploadToS3Async(s3Path, fileBytes, filePart.headers().getContentType().toString())
                            .then(chatDocumentInfoRepository.save(documentInfo))
                            .doOnSuccess(savedDoc -> {
                                if (!isTextFile) {
                                    // Start async processing for non-text files
                                    processFileAsync(jobId);
                                }
                            });
                });
    }

    @Async
    public void processFileAsync(String jobId) {
        CompletableFuture.runAsync(() -> {
            try {
                // Simulate processing time (3-10 seconds)
                Random random = new Random();
                int processingTime = 3000 + random.nextInt(7000); // 3-10 seconds
                Thread.sleep(processingTime);

                // Update status to completed
                chatDocumentInfoRepository.updateStatusByJobId(jobId, "completed")
                        .doOnSuccess(result -> log.info("Processing completed for job: {}", jobId))
                        .doOnError(error -> log.error("Error updating status for job: {}", jobId, error))
                        .subscribe();

            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.error("Processing interrupted for job: {}", jobId, e);
            }
        });
    }

    public Flux<ChatDocumentInfo> getAllDocuments() {
        return chatDocumentInfoRepository.findAllOrderByUploadTimeDesc();
    }

    public Flux<ChatDocumentInfo> getDocumentsByStatus(String status) {
        return chatDocumentInfoRepository.findByStatus(status);
    }

    public Flux<ChatDocumentInfo> getDocumentsByType(String documentType) {
        return chatDocumentInfoRepository.findByDocumentType(documentType);
    }

    public Flux<ChatDocumentInfo> searchDocumentsByName(String name) {
        return chatDocumentInfoRepository.findByDocumentNameContaining(name);
    }

    public Mono<Void> deleteDocument(Long id) {
        return chatDocumentInfoRepository.findById(id)
                .flatMap(document -> {
                    // Delete from S3 first
                    return deleteFromS3Async(document.getS3Path())
                            .then(chatDocumentInfoRepository.deleteById(id));
                });
    }

    public Mono<byte[]> downloadDocument(Long id) {
        return chatDocumentInfoRepository.findById(id)
                .flatMap(document -> {
                    // Check if this is a text file based on document type
                    boolean isTextFile = isTextFile(document.getDocumentType());
                    
                    if (isTextFile && document.getContent() != null) {
                        // For text files, return content as bytes
                        return Mono.just(document.getContent().getBytes(StandardCharsets.UTF_8));
                    } else if (document.getS3Path() != null && !document.getS3Path().isEmpty()) {
                        // For non-text files or text files without content, download from S3
                        return downloadFromS3Async(document.getS3Path());
                    } else {
                        // Neither content nor S3 path available
                        return Mono.error(new RuntimeException("File content not available for download"));
                    }
                });
    }

    private Mono<Void> uploadToS3Async(String s3Path, byte[] fileBytes, String contentType) {
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Path)
                .contentType(contentType)
                .build();

        return Mono.fromFuture(() ->
            s3AsyncClient.putObject(putObjectRequest, AsyncRequestBody.fromBytes(fileBytes)))
                .then();
    }

    private Mono<Void> deleteFromS3Async(String s3Path) {
        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Path)
                .build();

        return Mono.fromFuture(() -> s3AsyncClient.deleteObject(deleteObjectRequest))
                .then();
    }

    private Mono<byte[]> downloadFromS3Async(String s3Path) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Path)
                .build();

        return Mono.fromFuture(() ->
            s3AsyncClient.getObject(getObjectRequest,
                software.amazon.awssdk.core.async.AsyncResponseTransformer.toBytes()))
                .map(BytesWrapper::asByteArray);
    }

    private String generateS3Path(String originalFileName) {
        String extension = "";
        if (originalFileName != null && originalFileName.contains(".")) {
            extension = originalFileName.substring(originalFileName.lastIndexOf("."));
        }
        return "documents/" + UUID.randomUUID() + extension;
    }

    private String getDocumentType(String fileName) {
        if (fileName == null) return "other";

        String extension = fileName.toLowerCase();
        if (extension.endsWith(".txt") || extension.endsWith(".md")) return "text";
        if (extension.endsWith(".sql")) return "sql";
        if (extension.endsWith(".csv")) return "csv";
        if (extension.endsWith(".pdf")) return "pdf";
        if (extension.endsWith(".png") || extension.endsWith(".jpg") ||
            extension.endsWith(".jpeg") || extension.endsWith(".gif") ||
            extension.endsWith(".svg")) return "image";
        if (extension.endsWith(".xls") || extension.endsWith(".xlsx")) return "spreadsheet";
        if (extension.endsWith(".ppt") || extension.endsWith(".pptx")) return "presentation";
        if (extension.endsWith(".doc") || extension.endsWith(".docx")) return "document";

        return "other";
    }

    private boolean isTextFile(String documentType) {
        return "text".equals(documentType) || "sql".equals(documentType) ||
               "csv".equals(documentType) || "md".equals(documentType);
    }
}
