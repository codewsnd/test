package com.mytest.backend.conversation.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.fasterxml.uuid.Generators;
import com.mytest.backend.conversation.dto.ConversationHtmlPreviewRequest;
import com.mytest.backend.conversation.entity.ConversationHtmlPreviewDO;
import com.mytest.backend.conversation.mapper.ConversationHtmlPreviewMapper;
import com.mytest.backend.exception.CustomException;
import com.mytest.backend.utils.ExternalResourceUtils;
import com.mytest.backend.utils.XssUtils;
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
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConversationHtmlPreviewService {

    private final ConversationHtmlPreviewMapper conversationHtmlPreviewMapper;
    private final S3Client s3Client;

    @Value("${aws.s3.bucket-name:my-bucket}")
    private String bucketName;

    @Transactional
    public ConversationHtmlPreviewDO createHtmlPreview(ConversationHtmlPreviewRequest request) {
        try {
            String htmlContent = request.getHtmlContent();
            String htmlContentHash = calculateContentHash(htmlContent);
            LocalDateTime now = LocalDateTime.now();

            ConversationHtmlPreviewDO existingPreview = findByStaffConversationTurn(
                    request.getStaffId(),
                    request.getConversationId(),
                    request.getTurnId()
            );
            if (existingPreview != null) {
                return updateExistingPreview(existingPreview, htmlContent, htmlContentHash, now);
            }
            return createNewPreview(
                    request.getStaffId(),
                    request.getConversationId(),
                    request.getTurnId(),
                    htmlContent,
                    htmlContentHash,
                    now
            );
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to create/get HTML preview", e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to create/get HTML preview");
        }
    }

    public ConversationHtmlPreviewDO getHtmlPreviewById(String id) {
        try {
            ConversationHtmlPreviewDO preview = conversationHtmlPreviewMapper.selectById(id);
            if (preview == null) {
                throw new CustomException(HttpStatus.NOT_FOUND.value(), "HTML preview not found");
            }
            return preview;
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            log.error("Failed to get HTML preview by id: {}", id, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get HTML preview");
        }
    }

    public String getHtmlContent(String s3Path) {
        try {
            ResponseBytes<GetObjectResponse> bytes = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder()
                            .bucket(bucketName)
                            .key(s3Path)
                            .build()
            );
            log.info("Retrieved HTML content from S3: {}", s3Path);
            return new String(bytes.asByteArray(), StandardCharsets.UTF_8);
        } catch (RuntimeException e) {
            log.error("Failed to retrieve HTML content from S3: {}", s3Path, e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get HTML preview");
        }
    }

    private ConversationHtmlPreviewDO findByStaffConversationTurn(String staffId, String conversationId, String turnId) {
        List<ConversationHtmlPreviewDO> previews = conversationHtmlPreviewMapper.selectList(
                Wrappers.<ConversationHtmlPreviewDO>lambdaQuery()
                        .eq(ConversationHtmlPreviewDO::getStaffId, staffId)
                        .eq(ConversationHtmlPreviewDO::getConversationId, conversationId)
                        .eq(ConversationHtmlPreviewDO::getTurnId, turnId)
                        .last("LIMIT 1")
        );
        return previews.isEmpty() ? null : previews.get(0);
    }

    private ConversationHtmlPreviewDO updateExistingPreview(
            ConversationHtmlPreviewDO existingPreview,
            String htmlContent,
            String htmlContentHash,
            LocalDateTime now
    ) {
        if (htmlContentHash.equals(existingPreview.getHtmlContentHash())) {
            existingPreview.setUpdatedAt(now);
            conversationHtmlPreviewMapper.updateById(existingPreview);
            log.info("Reuse existing HTML preview for id: {}, content hash unchanged", existingPreview.getId());
            return existingPreview;
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
        conversationHtmlPreviewMapper.updateById(existingPreview);
        deleteFromS3(existingS3Path);
        log.info("Updated HTML preview for id: {}", existingPreview.getId());
        return existingPreview;
    }

    private ConversationHtmlPreviewDO createNewPreview(
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

        ConversationHtmlPreviewDO preview = ConversationHtmlPreviewDO.builder()
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
        conversationHtmlPreviewMapper.insert(preview);
        log.info("Created HTML preview for id: {}", preview.getId());
        return preview;
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

    private void applySecurityMeta(ConversationHtmlPreviewDO preview, SecurityCheckResult securityCheckResult) {
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
