package com.zhou4h.backend.service;

import com.fasterxml.uuid.Generators;
import com.zhou4h.backend.dto.ConversationHtmlPreviewRequest;
import com.zhou4h.backend.entity.ConversationHtmlPreview;
import com.zhou4h.backend.exception.CustomException;
import com.zhou4h.backend.repository.ConversationHtmlPreviewRepository;
import com.zhou4h.backend.utils.ExternalResourceUtils;
import com.zhou4h.backend.utils.XssUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHtmlPreviewService {

    private final ConversationHtmlPreviewRepository conversationHtmlPreviewRepository;
    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name:my-bucket}")
    private String bucketName;

    @Transactional
    public ConversationHtmlPreview createHtmlPreview(ConversationHtmlPreviewRequest request) {
        String staffId = request.getStaffId();
        String conversationId = request.getConversationId();
        String turnId = request.getTurnId();
        String htmlContent = request.getHtmlContent();
        String htmlContentHash = calculateContentHash(htmlContent);
        LocalDateTime now = LocalDateTime.now();

        return conversationHtmlPreviewRepository.findByStaffIdAndConversationIdAndTurnId(staffId, conversationId, turnId)
                .map(existingPreview -> updateExistingPreview(existingPreview, htmlContent, htmlContentHash, now))
                .orElseGet(() -> createNewPreview(staffId, conversationId, turnId, htmlContent, htmlContentHash, now));
    }

    public ConversationHtmlPreview getHtmlPreviewById(String id) {
        return conversationHtmlPreviewRepository.findById(id)
                .orElseThrow(() -> new CustomException(HttpStatus.NOT_FOUND.value(), "HTML preview not found"));
    }

    public String getHtmlContent(String s3Path) {
        ResponseBytes<GetObjectResponse> bytes = s3Client.getObjectAsBytes(
                GetObjectRequest.builder()
                        .bucket(bucketName)
                        .key(s3Path)
                        .build()
        );
        log.info("Retrieved HTML content from S3: {}", s3Path);
        return new String(bytes.asByteArray(), StandardCharsets.UTF_8);
    }

    private ConversationHtmlPreview updateExistingPreview(
            ConversationHtmlPreview existingPreview,
            String htmlContent,
            String htmlContentHash,
            LocalDateTime now
    ) {
        if (htmlContentHash.equals(existingPreview.getHtmlContentHash())) {
            existingPreview.setUpdatedAt(now);
            log.info("Reuse existing HTML preview for id: {}, content hash unchanged", existingPreview.getId());
            return conversationHtmlPreviewRepository.save(existingPreview);
        }

        SecurityCheckResult securityCheckResult = checkSecurityContent(htmlContent);
        String existingS3Path = existingPreview.getS3Path();
        UUID uuid7 = Generators.timeBasedEpochGenerator().generate();
        String s3Path = generateS3Path(existingPreview.getStaffId(), uuid7.toString());

        existingPreview.setS3Path(s3Path);
        applySecurityMeta(existingPreview, securityCheckResult);
        existingPreview.setHtmlContentLength(htmlContent.length());
        existingPreview.setHtmlContentHash(htmlContentHash);
        existingPreview.setUpdatedAt(now);

        uploadToS3(s3Path, htmlContent);
        ConversationHtmlPreview saved = conversationHtmlPreviewRepository.save(existingPreview);
        deleteFromS3(existingS3Path);
        log.info("Updated HTML preview for id: {}", saved.getId());
        return saved;
    }

    private ConversationHtmlPreview createNewPreview(
            String staffId,
            String conversationId,
            String turnId,
            String htmlContent,
            String htmlContentHash,
            LocalDateTime now
    ) {
        SecurityCheckResult securityCheckResult = checkSecurityContent(htmlContent);
        UUID uuid7 = Generators.timeBasedEpochGenerator().generate();
        String s3Path = generateS3Path(staffId, uuid7.toString());

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

        uploadToS3(s3Path, htmlContent);
        ConversationHtmlPreview saved = conversationHtmlPreviewRepository.save(conversationHtmlPreview);
        log.info("Created HTML preview for id: {}", saved.getId());
        return saved;
    }

    private void uploadToS3(String s3Path, String htmlContent) {
        byte[] contentBytes = htmlContent.getBytes(StandardCharsets.UTF_8);
        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Path)
                .contentType("text/html")
                .contentLength((long) contentBytes.length)
                .build();

        s3Client.putObject(putObjectRequest, RequestBody.fromBytes(contentBytes));
    }

    private void deleteFromS3(String s3Path) {
        if (!StringUtils.hasText(s3Path)) {
            return;
        }

        DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(s3Path)
                .build();
        s3Client.deleteObject(deleteObjectRequest);
        log.info("Deleted previous HTML preview object from S3: {}", s3Path);
    }

    private String generateS3Path(String staffId, String uuid) {
        return String.format("html/%s/%s.html", staffId, uuid);
    }

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
