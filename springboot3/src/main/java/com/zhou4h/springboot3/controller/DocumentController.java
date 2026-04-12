package com.zhou4h.springboot3.controller;

import com.zhou4h.springboot3.entity.ChatDocumentInfo;
import com.zhou4h.springboot3.service.ChatDocumentService;
import com.zhou4h.springboot3.repository.ChatDocumentInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.RequestMethod;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE, RequestMethod.PUT, RequestMethod.OPTIONS})
public class DocumentController {

    private final ChatDocumentService chatDocumentService;
    private final ChatDocumentInfoRepository chatDocumentInfoRepository;

    private static final String STUFF_ID = "123";

    @PostMapping("/create")
    public Mono<ResponseEntity<Map<String, Object>>> createDocument(@RequestBody Map<String, Object> documentRequest) {
        String documentName = (String) documentRequest.get("documentName");
        String documentType = (String) documentRequest.get("documentType");
        Long fileSize = documentRequest.get("fileSize") != null ? ((Number) documentRequest.get("fileSize")).longValue() : 0L;

        if (documentName == null || documentName.trim().isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "Document name is required");
            return Mono.just(ResponseEntity.badRequest().body(response));
        }

        LocalDateTime now = LocalDateTime.now();
        String jobId = UUID.randomUUID().toString();

        ChatDocumentInfo documentInfo = ChatDocumentInfo.builder()
                .documentName(documentName.trim())
                .documentType(documentType != null ? documentType : "Other")
                .fileSize(fileSize)
                .uploadTime(now)
                .createTime(now)
                .updateTime(now)
                .stuffId(STUFF_ID)
                .status("pending")
                .s3Path("")
                .jobId(jobId)
                .build();

        return chatDocumentInfoRepository.save(documentInfo)
                .map(savedDocument -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("message", "Document created successfully");
                    response.put("document", savedDocument);
                    return ResponseEntity.ok(response);
                })
                .onErrorResume(error -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);
                    response.put("message", "Failed to create document: " + error.getMessage());
                    return Mono.just(ResponseEntity.internalServerError().body(response));
                });
    }

    @GetMapping("/list")
    public Flux<ChatDocumentInfo> getAllDocuments() {
        return chatDocumentService.getAllDocuments();
    }

    @GetMapping("/{id}")
    public Mono<ResponseEntity<ChatDocumentInfo>> getDocumentById(@PathVariable Long id) {
        return chatDocumentInfoRepository.findById(id)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @GetMapping("/status/{status}")
    public Flux<ChatDocumentInfo> getDocumentsByStatus(@PathVariable String status) {
        return chatDocumentService.getDocumentsByStatus(status);
    }

    @GetMapping("/type/{type}")
    public Flux<ChatDocumentInfo> getDocumentsByType(@PathVariable String type) {
        return chatDocumentService.getDocumentsByType(type);
    }

    @GetMapping("/search")
    public Flux<ChatDocumentInfo> searchDocuments(@RequestParam String name) {
        return chatDocumentService.searchDocumentsByName(name);
    }

    @GetMapping("/job/{jobId}")
    public Mono<ResponseEntity<ChatDocumentInfo>> getDocumentByJobId(@PathVariable String jobId) {
        return chatDocumentInfoRepository.findByJobId(jobId)
                .map(ResponseEntity::ok)
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @GetMapping("/job/{jobId}/status")
    public Mono<ResponseEntity<Map<String, Object>>> getDocumentStatusByJobId(@PathVariable String jobId) {
        return chatDocumentInfoRepository.findByJobId(jobId)
                .map(document -> {
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", true);
                    response.put("status", document.getStatus());
                    response.put("content", document.getContent());
                    response.put("id", document.getId());
                    response.put("documentName", document.getDocumentName());
                    response.put("documentType", document.getDocumentType());
                    response.put("updateTime", document.getUpdateTime());
                    response.put("s3Path", document.getS3Path());
                    return ResponseEntity.ok(response);
                })
                .defaultIfEmpty(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/rename")
    public Mono<ResponseEntity<Map<String, Object>>> renameDocument(
            @PathVariable Long id,
            @RequestBody Map<String, String> request) {

        String newFileName = request.get("newFileName");
        if (newFileName == null || newFileName.trim().isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "New file name is required");
            return Mono.just(ResponseEntity.badRequest().body(response));
        }

        return chatDocumentInfoRepository.findById(id)
                .switchIfEmpty(Mono.fromCallable(() -> {
                    throw new RuntimeException("Document not found");
                }))
                .flatMap(document -> {
                    return chatDocumentInfoRepository.findByDocumentNameAndStuffId(newFileName.trim(), STUFF_ID)
                            .hasElement()
                            .flatMap(exists -> {
                                if (exists) {
                                    Map<String, Object> response = new HashMap<>();
                                    response.put("success", false);
                                    response.put("message", "File name already exists");
                                    return Mono.just(ResponseEntity.badRequest().body(response));
                                }

                                document.setDocumentName(newFileName.trim());
                                document.setUpdateTime(LocalDateTime.now());

                                return chatDocumentInfoRepository.save(document)
                                        .map(savedDoc -> {
                                            Map<String, Object> response = new HashMap<>();
                                            response.put("success", true);
                                            response.put("message", "File renamed successfully");
                                            response.put("id", savedDoc.getId());
                                            response.put("documentName", savedDoc.getDocumentName());
                                            response.put("updateTime", savedDoc.getUpdateTime());
                                            return ResponseEntity.ok(response);
                                        });
                            });
                })
                .onErrorResume(error -> {
                    String errorMessage = error.getMessage();
                    Map<String, Object> response = new HashMap<>();
                    response.put("success", false);

                    if (errorMessage != null && errorMessage.contains("Document not found")) {
                        response.put("message", "Document not found");
                        return Mono.just(ResponseEntity.notFound().build());
                    } else {
                        response.put("message", "Failed to rename document: " + errorMessage);
                        return Mono.just(ResponseEntity.internalServerError().body(response));
                    }
                });
    }

    @PutMapping("/job/{jobId}/update")
    public Mono<ResponseEntity<Map<String, Object>>> updateDocumentByJobId(
            @PathVariable String jobId,
            @RequestBody Map<String, Object> request) {

        String content = (String) request.get("content");
        String status = (String) request.get("status");

        if (status == null || status.trim().isEmpty()) {
            Map<String, Object> response = new HashMap<>();
            response.put("code", 400);
            response.put("message", "Status is required");
            response.put("data", false);
            return Mono.just(ResponseEntity.badRequest().body(response));
        }

        return chatDocumentInfoRepository.findByJobId(jobId)
                .switchIfEmpty(Mono.fromCallable(() -> {
                    throw new RuntimeException("Document not found with jobId: " + jobId);
                }))
                .flatMap(document -> {
                    // 更新文档内容和状态
                    if (content != null) {
                        document.setContent(content);
                    }
                    document.setStatus(status.trim());
                    document.setUpdateTime(LocalDateTime.now());

                    return chatDocumentInfoRepository.save(document)
                            .map(savedDoc -> {
                                Map<String, Object> response = new HashMap<>();
                                response.put("code", 200);
                                response.put("message", "Document updated successfully");
                                response.put("data", true);
                                return ResponseEntity.ok(response);
                            });
                })
                .onErrorResume(error -> {
                    String errorMessage = error.getMessage();
                    Map<String, Object> response = new HashMap<>();
                    response.put("code", 500);

                    if (errorMessage != null && errorMessage.contains("Document not found")) {
                        response.put("code", 404);
                        response.put("message", "Document not found with jobId: " + jobId);
                        response.put("data", false);
                        return Mono.just(ResponseEntity.internalServerError().body(response));
                    } else {
                        response.put("message", "Failed to update document: " + errorMessage);
                        response.put("data", false);
                        return Mono.just(ResponseEntity.internalServerError().body(response));
                    }
                });
    }
}
