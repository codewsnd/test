package com.zhou4h.springboot3.service;

import com.fasterxml.uuid.Generators;
import com.zhou4h.springboot3.dto.ConversationHtmlPreviewRequest;
import com.zhou4h.springboot3.entity.ConversationHtmlPreview;
import com.zhou4h.springboot3.exception.CustomBaseException;
import com.zhou4h.springboot3.repository.ConversationHtmlPreviewRepository;
import com.zhou4h.springboot3.util.ExternalResourceUtils;
import com.zhou4h.springboot3.util.XssUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.r2dbc.core.R2dbcEntityTemplate;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.core.async.AsyncResponseTransformer;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * HTML 预览服务
 * 提供 HTML 内容的 XSS 过滤和 S3 存储功能
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHtmlPreviewService {

    private final ConversationHtmlPreviewRepository conversationHtmlPreviewRepository;
    private final R2dbcEntityTemplate r2dbcEntityTemplate;
    private final S3AsyncClient s3AsyncClient;

    @Value("${aws.s3.bucket-name:my-bucket}")
    private String bucketName;

    /**
     * 创建或获取 HTML 预览
     * 1. 检查是否已存在（根据 staffId, conversationId, turnId）
     * 2. 如果存在，覆盖上传 S3 并更新数据库元数据
     * 3. 如果不存在，检测 XSS 和外部引用，上传到 S3，保存到数据库
     */
    public Mono<ConversationHtmlPreview> createHtmlPreview(ConversationHtmlPreviewRequest request) {
        String staffId = request.getStaffId();
        String conversationId = request.getConversationId();
        String turnId = request.getTurnId();
        String htmlContent = request.getHtmlContent();
        String htmlContentHash = calculateContentHash(htmlContent);
        LocalDateTime now = LocalDateTime.now();

        // 1. 先检查是否已存在
        return conversationHtmlPreviewRepository.findByStaffIdAndConversationIdAndTurnId(staffId, conversationId, turnId)
                .flatMap(existingPreview -> {
                    if (htmlContentHash.equals(existingPreview.getHtmlContentHash())) {
                        existingPreview.setUpdatedAt(now);
                        log.info("Reuse existing HTML preview for id: {}, content hash unchanged", existingPreview.getId());
                        return conversationHtmlPreviewRepository.save(existingPreview);
                    }

                    // 2. 已存在时，覆盖上传并更新元数据
                    SecurityCheckResult securityCheckResult = checkSecurityContent(htmlContent);

                    String existingS3Path = existingPreview.getS3Path();
                    UUID uuid7 = Generators.timeBasedEpochGenerator().generate();
                    String s3Path = generateS3Path(staffId, uuid7.toString());

                    existingPreview.setS3Path(s3Path);
                    applySecurityMeta(existingPreview, securityCheckResult);
                    existingPreview.setHtmlContentLength(htmlContent.length());
                    existingPreview.setHtmlContentHash(htmlContentHash);
                    existingPreview.setUpdatedAt(now);

                    return uploadToS3Async(s3Path, htmlContent)
                            .then(conversationHtmlPreviewRepository.save(existingPreview))
                            .flatMap(saved ->
                                    deleteFromS3Async(existingS3Path)
                                            .onErrorMap(error -> {
                                                log.warn("Failed to delete previous HTML preview object: {}", existingS3Path, error);
                                                return new CustomBaseException(
                                                        HttpStatus.INTERNAL_SERVER_ERROR.value(),
                                                        "Failed to delete previous HTML preview object"
                                                );
                                            })
                                            .thenReturn(saved)
                            )
                            .doOnSuccess(saved -> log.info("Updated HTML preview for id: {}", saved.getId()));
                })
                .switchIfEmpty(Mono.defer(() -> {
                    // 3. 判断 XSS 和外部引用
                    SecurityCheckResult securityCheckResult = checkSecurityContent(htmlContent);

                    // 生成 UUIDv7 和 S3 路径
                    UUID uuid7 = Generators.timeBasedEpochGenerator().generate();
                    String s3Path = generateS3Path(staffId, uuid7.toString());

                    // 3. 创建新记录
                    ConversationHtmlPreview conversationHtmlPreview = ConversationHtmlPreview.builder()
                            .id(uuid7.toString())
                            .staffId(staffId)
                            .conversationId(conversationId)
                            .turnId(turnId)
                            .s3Path(s3Path)
                            .createdAt(now)
                            .updatedAt(now)
                            .hasXss(securityCheckResult.hasXss())
                            .xssContent(securityCheckResult.xssContent())
                            .hasExternalReferences(securityCheckResult.hasExternalReferences())
                            .externalReferencesContent(securityCheckResult.externalReferencesContent())
                            .htmlContentLength(htmlContent.length())
                            .htmlContentHash(htmlContentHash)
                            .build();

                    // 4. 先上传到 S3，然后保存到数据库
                    return uploadToS3Async(s3Path, htmlContent)
                            .then(Mono.just(conversationHtmlPreview))
                            .flatMap(r2dbcEntityTemplate::insert)
                            .doOnSuccess(saved -> log.info("Created HTML preview for id: {}", saved.getId()));
                }))
                .doOnError(error -> log.error("Failed to create/get HTML preview", error));
    }

    /**
     * 根据 id 获取 HTML 预览
     * 如果有错误原因，则抛出异常
     *
     * @param id 预览 ID
     * @return HtmlPreview
     */
    public Mono<ConversationHtmlPreview> getHtmlPreviewById(String id) {
        return conversationHtmlPreviewRepository.findById(id)
                .switchIfEmpty(Mono.error(new CustomBaseException(
                        HttpStatus.NOT_FOUND.value(),
                        "HTML preview not found"
                )));
    }


    /**
     * 从 S3 下载 HTML 内容
     *
     * @param s3Path S3 路径
     * @return HTML 内容
     */
    public Mono<String> getHtmlContent(String s3Path) {
        return Mono.fromFuture(
                s3AsyncClient.getObject(
                    builder -> builder.bucket(bucketName).key(s3Path),
                    AsyncResponseTransformer.toBytes()
                ))
                .map(bytes -> new String(bytes.asByteArray(), StandardCharsets.UTF_8))
                .doOnSuccess(content -> log.info("Retrieved HTML content from S3: {}", s3Path))
                .doOnError(error -> log.error("Failed to retrieve HTML content from S3: {}", s3Path, error));
    }

    /**
     * 上传 HTML 到 S3
     */
    private Mono<Void> uploadToS3Async(String s3Path, String htmlContent) {
        byte[] contentBytes = htmlContent.getBytes(StandardCharsets.UTF_8);

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Path)
                .contentType("text/html")
                .contentLength((long) contentBytes.length)
                .build();

        return Mono.fromFuture(() ->
                s3AsyncClient.putObject(putObjectRequest, AsyncRequestBody.fromBytes(contentBytes)))
                .then();
    }

    /**
     * 删除旧的 HTML S3 对象
     */
    private Mono<Void> deleteFromS3Async(String s3Path) {
        if (s3Path == null || s3Path.isBlank()) {
            return Mono.empty();
        }

        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Path)
                .build();

        return Mono.fromFuture(() -> s3AsyncClient.deleteObject(deleteObjectRequest))
                .then()
                .doOnSuccess(unused -> log.info("Deleted previous HTML preview object from S3: {}", s3Path));
    }

    /**
     * 生成 S3 路径
     */
    private String generateS3Path(String staffId, String uuid) {
        return String.format("html/%s/%s.html", staffId, uuid);
    }

    /**
     * 计算 HTML 内容的 SHA-256 哈希，用于幂等判断
     */
    private String calculateContentHash(String htmlContent) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(htmlContent.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(hashBytes.length * 2);
            for (byte hashByte : hashBytes) {
                builder.append(String.format("%02x", hashByte));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }

    private SecurityCheckResult checkSecurityContent(String htmlContent) {
        boolean hasXss = XssUtils.hasXss(htmlContent);
        boolean hasExternalReferences = ExternalResourceUtils.hasExternalReferences(htmlContent);
        String xssContent = hasXss
                ? normalizeRiskContent(XssUtils.buildReadableXssContent(htmlContent))
                : "";
        String externalReferencesContent = hasExternalReferences
                ? normalizeRiskContent(ExternalResourceUtils.buildReadableExternalReferencesContent(htmlContent))
                : "";

        return new SecurityCheckResult(
                hasXss,
                xssContent,
                hasExternalReferences,
                externalReferencesContent
        );
    }

    private void applySecurityMeta(ConversationHtmlPreview preview, SecurityCheckResult securityCheckResult) {
        preview.setHasXss(securityCheckResult.hasXss());
        preview.setXssContent(securityCheckResult.xssContent());
        preview.setHasExternalReferences(securityCheckResult.hasExternalReferences());
        preview.setExternalReferencesContent(securityCheckResult.externalReferencesContent());
    }

    private String normalizeRiskContent(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        return content;
    }

    private record SecurityCheckResult(
            boolean hasXss,
            String xssContent,
            boolean hasExternalReferences,
            String externalReferencesContent
    ) {
    }


}
