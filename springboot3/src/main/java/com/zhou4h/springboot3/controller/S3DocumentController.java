package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.entity.ChatDocumentInfo;
import com.zhou4h.springboot3.service.ChatDocumentService;
import com.zhou4h.springboot3.repository.ChatDocumentInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.scheduling.annotation.Async;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Pattern;

import static org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE;

@RestController
@RequestMapping("/api/document")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.PUT, RequestMethod.OPTIONS})
public class S3DocumentController {

    private final ChatDocumentService chatDocumentService;
    private final ChatDocumentInfoRepository chatDocumentInfoRepository;
    private final S3AsyncClient s3AsyncClient;
    private final S3Presigner s3Presigner;

    @Value("${aws.s3.bucket-name:my-bucket}")
    private String bucketName;

    private static final String STUFF_ID = "123";

    @PostMapping(value = "/upload", consumes = {MULTIPART_FORM_DATA_VALUE})
    public Mono<ResponseEntity<Map<String, Object>>> uploadFile(@RequestPart("file") FilePart file) {
        // 文件验证
        if (file == null) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "File is empty");
            return Mono.just(ResponseEntity.badRequest().body(response));
        }

        String fileName = file.filename();
        if (fileName == null || fileName.trim().isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "File name cannot be empty");
            return Mono.just(ResponseEntity.badRequest().body(response));
        }

        // 读取文件内容
        return DataBufferUtils.join(file.content())
            .flatMap(dataBuffer -> {
                try {
                    byte[] fileBytes = new byte[dataBuffer.readableByteCount()];
                    dataBuffer.read(fileBytes);
                    DataBufferUtils.release(dataBuffer);

                    // 文件大小验证 - 10MB限制
                    if (fileBytes.length > 10 * 1024 * 1024) {
                        return Mono.error(new RuntimeException("File size cannot exceed 10MB"));
                    }

                    String documentType = getDocumentType(fileName);
                    String jobId = UUID.randomUUID().toString();
                    LocalDateTime now = LocalDateTime.now();

                    // 计算文件MD5哈希值
                    String md5Hash = calculateMD5(fileBytes);

                    boolean isTextFile = isTextFile(documentType);
                    String content = null;
                    String status;
                    String s3Path = null;

                    if (isTextFile) {
                        // 文本文件：保存内容到数据库，不上传到S3
                        content = new String(fileBytes, StandardCharsets.UTF_8);
                        status = "completed";
                    } else {
                        // 非文本文件：上传到S3，设置processing状态
                        status = "processing";
                        s3Path = generateS3Path();
                    }

                    ChatDocumentInfo documentInfo = ChatDocumentInfo.builder()
                            .documentName(fileName.trim())
                            .documentType(documentType)
                            .content(content)
                            .fileSize((long) fileBytes.length)
                            .uploadTime(now)
                            .createTime(now)
                            .updateTime(now)
                            .stuffId(STUFF_ID)
                            .status(status)
                            .s3Path(s3Path)
                            .jobId(jobId)
                            .md5(md5Hash)
                            .build();

                    String contentType = file.headers().getContentType() != null ?
                        file.headers().getContentType().toString() : "application/octet-stream";

                    return Mono.just(new Object[]{fileBytes, s3Path, contentType, documentInfo, isTextFile});
                } catch (Exception e) {
                    return Mono.error(new RuntimeException("Error processing file", e));
                }
            })
        .flatMap(data -> {
            Object[] params = data;
            byte[] fileBytes = (byte[]) params[0];
            String s3Path = (String) params[1];
            String contentType = (String) params[2];
            ChatDocumentInfo documentInfo = (ChatDocumentInfo) params[3];
            boolean isTextFile = (boolean) params[4];

            if (isTextFile) {
                // 文本文件直接保存到数据库
                return chatDocumentInfoRepository.save(documentInfo);
            } else {
                // 非文本文件先上传到S3再保存到数据库
                return uploadToS3Async(s3Path, fileBytes, contentType)
                        .then(chatDocumentInfoRepository.save(documentInfo))
                        .doOnSuccess(savedDoc -> {
                            // 启动异步处理，随机1-10秒后完成
                            processFileAsyncWithRandom(savedDoc.getJobId(), savedDoc.getDocumentName());
                        });
            }
        })
        .map(documentInfo -> {
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "File uploaded successfully");
            response.put("id", documentInfo.getId());
            response.put("documentName", documentInfo.getDocumentName());
            response.put("documentType", documentInfo.getDocumentType());
            response.put("size", documentInfo.getFileSize());
            response.put("status", documentInfo.getStatus());
            response.put("jobId", documentInfo.getJobId());
            response.put("createTime", documentInfo.getCreateTime());
            response.put("updateTime", documentInfo.getUpdateTime());
            response.put("uploadTime", documentInfo.getUploadTime());
            response.put("md5", documentInfo.getMd5());
            if (documentInfo.getContent() != null) {
                response.put("content", documentInfo.getContent());
            }
            if (documentInfo.getS3Path() != null) {
                response.put("s3Path", documentInfo.getS3Path());
            }
            return ResponseEntity.ok(response);
        })
        .onErrorResume(error -> {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Failed to upload file: " + error.getMessage());
            return Mono.just(ResponseEntity.internalServerError().body(response));
        });
    }

    @PostMapping(value = "/upload-multiple", consumes = {MULTIPART_FORM_DATA_VALUE, MediaType.ALL_VALUE})
    public Mono<ResponseEntity<Map<String, Object>>> uploadMultipleFiles(@RequestPart("files") Flux<FilePart> files) {
        return files
                .flatMap(this::processUploadFile)
                .collectList()
                .flatMap(results -> {
                    if (results.isEmpty()) {
                        Map<String, Object> response = new HashMap<>();
                        response.put("success", false);
                        response.put("message", "No files provided");
                        return Mono.just(ResponseEntity.badRequest().body(response));
                    }

                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("message", "Files uploaded successfully");
                    response.put("totalFiles", results.size());
                    response.put("files", results);
                    return Mono.just(ResponseEntity.ok(response));
                })
                .onErrorResume(error -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);
                    response.put("message", "Failed to upload files: " + error.getMessage());
                    return Mono.just(ResponseEntity.internalServerError().body(response));
                });
    }

    private Mono<Map<String, Object>> processUploadFile(FilePart file) {
        return DataBufferUtils.join(file.content())
            .flatMap(dataBuffer -> {
                try {
                    byte[] fileBytes = new byte[dataBuffer.readableByteCount()];
                    dataBuffer.read(fileBytes);
                    DataBufferUtils.release(dataBuffer);

                    String fileName = file.filename();
                    String documentType = getDocumentType(fileName);
                    String jobId = UUID.randomUUID().toString();
                    String s3Path = generateS3Path();

                    LocalDateTime now = LocalDateTime.now();

                    // 计算文件MD5哈希值
                    String md5Hash = calculateMD5(fileBytes);

                    boolean isTextFile = isTextFile(documentType);
                    String content = null;
                    String status = "processing";

                    if (isTextFile) {
                        content = new String(fileBytes, StandardCharsets.UTF_8);
                        status = "completed";
                    }

                    ChatDocumentInfo documentInfo = ChatDocumentInfo.builder()
                            .documentName(fileName)
                            .documentType(documentType)
                            .content(content)
                            .fileSize((long) fileBytes.length)
                            .uploadTime(now)
                            .createTime(now)
                            .updateTime(now)
                            .stuffId(STUFF_ID)
                            .status(status)
                            .s3Path(s3Path)
                            .jobId(jobId)
                            .md5(md5Hash)
                            .build();

                    String contentType = file.headers().getContentType() != null ?
                        file.headers().getContentType().toString() : "application/octet-stream";

                    return Mono.just(new Object[]{fileBytes, s3Path, contentType, documentInfo});
                } catch (Exception e) {
                    return Mono.error(new RuntimeException("Error processing file: " + file.filename(), e));
                }
            })
        .flatMap(data -> {
            Object[] params = data;
            byte[] fileBytes = (byte[]) params[0];
            String s3Path = (String) params[1];
            String contentType = (String) params[2];
            ChatDocumentInfo documentInfo = (ChatDocumentInfo) params[3];

            return uploadToS3Async(s3Path, fileBytes, contentType)
                    .then(chatDocumentInfoRepository.save(documentInfo))
                    .doOnSuccess(savedDoc -> {
                        if (!"completed".equals(savedDoc.getStatus())) {
                            processFileAsync(savedDoc.getJobId());
                        }
                    });
        })
        .map(documentInfo -> {
            Map<String, Object> fileResponse = new HashMap<>();
            fileResponse.put("id", documentInfo.getId());
            fileResponse.put("documentName", documentInfo.getDocumentName());
            fileResponse.put("documentType", documentInfo.getDocumentType());
            fileResponse.put("size", documentInfo.getFileSize());
            fileResponse.put("status", documentInfo.getStatus());
            fileResponse.put("jobId", documentInfo.getJobId());
            fileResponse.put("createTime", documentInfo.getCreateTime());
            fileResponse.put("updateTime", documentInfo.getUpdateTime());
            fileResponse.put("uploadTime", documentInfo.getUploadTime());
            fileResponse.put("md5", documentInfo.getMd5());
            return fileResponse;
        });
    }

    @PostMapping("/download/{id}")
    public Mono<ResponseEntity<byte[]>> downloadDocument(@PathVariable Long id) {
        return chatDocumentInfoRepository.findById(id)
                .switchIfEmpty(Mono.error(new RuntimeException("Document not found")))
                .flatMap(document -> {
                    // Check if this is a text file based on document type
                    boolean isTextFile = isTextFile(document.getDocumentType());

                    Mono<byte[]> contentMono;
                    if (isTextFile && document.getContent() != null) {
                        // For text files, return content as bytes
                        contentMono = Mono.just(document.getContent().getBytes(StandardCharsets.UTF_8));
                    } else if (document.getS3Path() != null && !document.getS3Path().isEmpty()) {
                        // For non-text files or text files without content, download from S3
                        contentMono = chatDocumentService.downloadDocument(id);
                    } else {
                        // Neither content nor S3 path available
                        contentMono = Mono.error(new RuntimeException("File content not available for download"));
                    }

                    return contentMono.map(bytes -> {
                        String safeFileName = sanitizeFileName(document.getDocumentName());
                        MediaType mediaType = isTextFile ? MediaType.TEXT_PLAIN : MediaType.APPLICATION_OCTET_STREAM;

                        return ResponseEntity.ok()
                                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeFileName + "\"")
                                .contentType(mediaType)
                                .body(bytes);
                    });
                })
                .onErrorResume(error -> {
                    System.err.println("Download failed for document " + id + ": " + error.getMessage());
                    return Mono.just(ResponseEntity.notFound().build());
                });
    }

    @GetMapping("/download-url/{id}")
    public Mono<ResponseEntity<Map<String, Object>>> getDownloadUrl(@PathVariable Long id) {
        return chatDocumentInfoRepository.findById(id)
                .switchIfEmpty(Mono.fromCallable(() -> {
                    throw new RuntimeException("Document not found");
                }))
                .flatMap(document -> {
                    // Check if this is a text file
                    boolean isTextFile = isTextFile(document.getDocumentType());

                    if (isTextFile) {
                        // For text files, return direct download URL
                        return generateDirectDownloadResponse(document);
                    } else {
                        // For other files, generate S3 presigned URL
                        return generatePresignedUrl(document);
                    }
                })
                .onErrorResume(this::handleDownloadUrlError);
    }

    private Mono<ResponseEntity<Map<String, Object>>> generateDirectDownloadResponse(ChatDocumentInfo documentInfo) {
        return Mono.fromCallable(() -> {
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("downloadUrl", "/api/document/download/" + documentInfo.getId());
            response.put("fileName", documentInfo.getDocumentName());
            response.put("fileSize", documentInfo.getFileSize());
            response.put("contentType", "text/plain");
            response.put("isDirectDownload", true);
            response.put("message", "Use POST request to download this text file");
            return ResponseEntity.ok(response);
        });
    }

    private Mono<ResponseEntity<Map<String, Object>>> generatePresignedUrl(ChatDocumentInfo documentInfo) {
        return Mono.fromCallable(() -> {
            if (documentInfo.getS3Path() == null || documentInfo.getS3Path().isEmpty()) {
                throw new RuntimeException("Document not found in S3 storage");
            }

            String safeFileName = sanitizeFileName(documentInfo.getDocumentName());

            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(documentInfo.getS3Path())
                    .responseContentDisposition("attachment; filename=\"" + safeFileName + "\"")
                    .responseContentType("application/octet-stream")
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofHours(1))
                    .getObjectRequest(getObjectRequest)
                    .build();

            PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(presignRequest);

            return ResponseEntity.ok(createSuccessResponse(presignedRequest, documentInfo));
        });
    }

    private Map<String, Object> createSuccessResponse(PresignedGetObjectRequest presignedRequest, ChatDocumentInfo documentInfo) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("downloadUrl", presignedRequest.url().toString());
        response.put("fileName", documentInfo.getDocumentName());
        response.put("fileSize", documentInfo.getFileSize());
        response.put("contentType", documentInfo.getDocumentType());
        response.put("expiresIn", "1 hour");
        response.put("expiresAt", System.currentTimeMillis() + Duration.ofHours(1).toMillis());
        return response;
    }

    private Mono<ResponseEntity<Map<String, Object>>> handleDownloadUrlError(Throwable error) {
        String errorMessage = error.getMessage();

        System.err.println("Download URL generation failed: " + errorMessage);

        Map<String, Object> response = new HashMap<>();
        response.put("success", false);
        response.put("error", "DOWNLOAD_URL_GENERATION_FAILED");

        if (errorMessage != null && errorMessage.contains("Document not found")) {
            response.put("message", "Document not found");
            return Mono.just(ResponseEntity.notFound().build());
        } else if (errorMessage != null && errorMessage.contains("S3")) {
            response.put("message", "File not available for download");
        } else {
            response.put("message", "Failed to generate download URL. Please try again later.");
        }

        return Mono.just(ResponseEntity.internalServerError().body(response));
    }

    @DeleteMapping("/{id}")
    public Mono<ResponseEntity<Map<String, Object>>> deleteDocument(@PathVariable Long id) {
        return chatDocumentService.deleteDocument(id)
                .then(Mono.fromCallable(() -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("message", "Document deleted successfully");
                    return ResponseEntity.ok(response);
                }))
                .onErrorResume(error -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);
                    response.put("message", "Failed to delete document: " + error.getMessage());
                    return Mono.just(ResponseEntity.internalServerError().body(response));
                });
    }

    private Mono<Void> uploadToS3Async(String s3Path, byte[] fileBytes, String contentType) {
        return Mono.fromFuture(() -> {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3Path)
                    .contentType(contentType)
                    .build();

            return s3AsyncClient.putObject(putObjectRequest,
                    AsyncRequestBody.fromBytes(fileBytes));
        }).then();
    }

    @Async
    protected void processFileAsyncWithRandom(String jobId, String documentName) {
        CompletableFuture.runAsync(() -> {
            try {
                Random random = new Random();
                // 随机1-10秒的处理时间
                int processingTime = 1000 + random.nextInt(9000);
                Thread.sleep(processingTime);

                chatDocumentInfoRepository.findByJobId(jobId)
                        .flatMap(doc -> {
                            doc.setStatus("completed");
                            doc.setContent(documentName); // 设置content为文件名
                            doc.setUpdateTime(LocalDateTime.now());
                            return chatDocumentInfoRepository.save(doc);
                        })
                        .subscribe();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
    }

    @Async
    protected void processFileAsync(String jobId) {
        CompletableFuture.runAsync(() -> {
            try {
                Random random = new Random();
                int processingTime = 3000 + random.nextInt(7000);
                Thread.sleep(processingTime);

                chatDocumentInfoRepository.findByJobId(jobId)
                        .flatMap(doc -> {
                            doc.setStatus("completed");
                            doc.setUpdateTime(LocalDateTime.now());
                            return chatDocumentInfoRepository.save(doc);
                        })
                        .subscribe();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
    }

    /**
     * 计算文件内容的MD5哈希值
     * @param fileBytes 文件字节数组
     * @return MD5哈希值的十六进制字符串
     */
    private String calculateMD5(byte[] fileBytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] hashBytes = md.digest(fileBytes);

            // 转换为十六进制字符串
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("MD5 algorithm not available", e);
        }
    }

    private String getDocumentType(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return "";
        }

        int lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < fileName.length() - 1) {
            return fileName.substring(lastDotIndex + 1).toLowerCase();
        }

        return "";
    }

    private boolean isTextFile(String extension) {
        if (extension == null || extension.isEmpty()) {
            return false;
        }
        return "txt".equals(extension) || "md".equals(extension) ||
               "sql".equals(extension) || "csv".equals(extension);
    }

    private String generateS3Path() {
        return "documents/" + STUFF_ID + "/upload/" + UUID.randomUUID();
    }

    private String sanitizeFileName(String fileName) {
        if (fileName == null || fileName.isEmpty()) {
            return "download";
        }

        String sanitized = fileName.replaceAll("[^\\x20-\\x7E]", "_");
        sanitized = sanitized.replaceAll("_{2,}", "_");
        sanitized = sanitized.trim().replaceAll("^_+|_+$", "");

        if (sanitized.isEmpty()) {
            sanitized = "download";
        }

        if (sanitized.length() > 100) {
            String extension = "";
            int lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex > 0 && lastDotIndex < fileName.length() - 1) {
                extension = fileName.substring(lastDotIndex);
            }

            int maxNameLength = 100 - extension.length();
            sanitized = sanitized.substring(0, maxNameLength) + extension;
        }

        return sanitized;
    }
}
