package com.zhou4h.backend.service;

import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.zhou4h.backend.dto.ConfluencePageContent;
import com.zhou4h.backend.dto.copydeck.*;
import com.zhou4h.backend.exception.CustomException;
import com.zhou4h.backend.utils.ConfluenceUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;


@Slf4j
@Service
@RequiredArgsConstructor
public class CopyDeckService {

    private final UserService userService;

    /**
     * 匹配Confluence页面URL的正则表达式
     */
    private static final Pattern PAGE_ID_PATTERN =
            Pattern.compile(".*/pages/(\\d+)(?:/.*)?", Pattern.CASE_INSENSITIVE);

    /**
     * 匹配URL前缀的正则表达式
     */
    private static final Pattern BASE_URL_PATTERN =
            Pattern.compile("(https?://[^/]+).*");


    private String getConfluenceToken(String staffId, String confluenceUrl) {
        return "MjAzNTcxNjM0NjIzOhsdNe9Eq9ooeipUDLqQ3r3JHLGY";
        // String token;
        // String lower = confluenceUrl.toLowerCase(Locale.ROOT);
        // if(lower.contains("alm")) {
        //     token = userService.getConfluenceAlmToken(staffId);
        // }else if(lower.contains("wpb")) {
        //     token = userService.getConfluenceWpbToken(staffId);
        // }else {
        //     throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get Confluence Token");
        // }
        // if(StringUtils.isBlank(token)) {
        //     throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(), "Failed to get Confluence Token");
        // }
        // return token;
    }

    /**
     * 解析Confluence页面URL，提取pageId和baseUrl
     */
    public static ConfluencePageInfo parsePageUrl(String pageUrl) {
        if (pageUrl == null || pageUrl.trim().isEmpty()) {
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "Page URL cannot be empty");
        }

        // 提取pageId
        Matcher pageIdMatcher = PAGE_ID_PATTERN.matcher(pageUrl);
        String pageId;
        if (pageIdMatcher.find()) {
            pageId = pageIdMatcher.group(1);
        } else {
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "Unable to extract pageId from URL, URL format should be: http://domain/spaces/XXX/pages/{pageId}");
        }

        // 提取baseUrl
        Matcher baseUrlMatcher = BASE_URL_PATTERN.matcher(pageUrl);
        String baseUrl;
        if (baseUrlMatcher.find()) {
            baseUrl = baseUrlMatcher.group(1);
        } else {
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "Unable to extract baseUrl from URL, URL format should be: http://domain:port or https://domain:port");
        }

        log.debug("解析Confluence URL - baseUrl: {}, pageId: {}", baseUrl, pageId);
        return new ConfluencePageInfo(baseUrl, null, pageId, null);
    }

    /**
     * 获取Storage内容
     */
    public static String getStorageContent(ConfluencePageContent pageContent) {
        if (pageContent.getBody() != null &&
                pageContent.getBody().getStorage() != null) {
            return pageContent.getBody().getStorage().getValue();
        }
        return "";
    }


    public CopyDeckStorageResponse getStorage(String staffId, String confluenceUrl) {
            String token = getConfluenceToken(staffId, confluenceUrl);
            ConfluencePageContent pageContent = ConfluenceUtil.getPageContent(confluenceUrl, token);
            String storageContent = getStorageContent(pageContent);
            if (storageContent.isEmpty()) {
                new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "Confluence storage is empty!");
            }
            String storage = pageContent.getBody().getStorage().getValue();
        return  new CopyDeckStorageResponse(storage, pageContent.getTitle());
    }

    /**
     * 上传完整的 Storage HTML 到 Confluence
     */
    public void uploadStorage(CopDeckUploadRequest request) {
        try {
            String staffId = request.getStaffId();
            String confluenceUrl = request.getConfluenceUrl();
            String storageHtml = request.getStorageHtml();
            List<ImageData> images = request.getImages();

            // 获取认证 token
            String token = getConfluenceToken(staffId, confluenceUrl);

            // 获取当前页面内容（包含版本号等信息）
            ConfluencePageContent pageContent = ConfluenceUtil.getPageContent(confluenceUrl, token);

            // 从 URL 中提取 baseUrl 和 pageId
            ConfluencePageInfo pageInfo = parsePageUrl(confluenceUrl);
            String baseUrl = pageInfo.getBaseUrl();
            String pageId = pageInfo.getPageId();

            log.info("准备更新 Confluence 页面，URL: {}, 页面ID: {}, Storage长度: {}, 图片数量: {}",
                    confluenceUrl, pageContent.getId(), storageHtml.length(),
                    images != null ? images.size() : 0);

            // 如果有图片，先上传图片附件
            if (images != null && !images.isEmpty()) {
                log.info("开始上传 {} 张图片附件到 Confluence", images.size());

                // 调用 ConfluenceUtil 上传图片（已存在则跳过）
                Map<String, String> uploadedImages = ConfluenceUtil.uploadImagesToConfluence(
                        images, pageId, token, baseUrl);

                log.info("图片上传完成，成功上传: {} 张", uploadedImages.size());
            }

            // 调用 ConfluenceUtil 更新页面内容
            ConfluenceUtil.updatePageContentWithStorage(pageContent, storageHtml, token, baseUrl);

            log.info("成功上传 Storage HTML 到 Confluence");

        } catch (Exception e) {
            log.error("上传 Storage HTML 失败: {}", e.getMessage(), e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "Failed to upload storage HTML: " + e.getMessage());
        }
    }

    /**
     * 获取 Confluence 附件的 base64 数据
     */
    public CopyDeckAttachmentResponse getAttachments(CopyDeckAttachmentsRequest request) {
        try {
            String staffId = request.getStaffId();
            String confluenceUrl = request.getConfluenceUrl();
            List<String> fileNames = request.getFileNames();

            // 获取认证 token
            String token = getConfluenceToken(staffId, confluenceUrl);

            // 从 URL 中提取 baseUrl 和 pageId
            ConfluencePageInfo pageInfo = parsePageUrl(confluenceUrl);
            String baseUrl = pageInfo.getBaseUrl();
            String pageId = pageInfo.getPageId();

            log.info("准备获取附件，页面ID: {}, 文件数量: {}", pageId, fileNames.size());

            // 获取所有附件
            Map<String, ConfluenceUtil.AttachmentInfo> existingAttachments =
                    ConfluenceUtil.getExistingAttachments(pageId, token, baseUrl);

            List<ImageData> imageDataList = new ArrayList<>();

            // 为每个文件名下载附件并转换为 base64
            for (String fileName : fileNames) {
                if (existingAttachments.containsKey(fileName)) {
                    try {
                        // 构建附件下载 URL
                        String downloadUrl = baseUrl + "/download/attachments/" + pageId + "/" + fileName;

                        Map<String, String> headers = new HashMap<>();
                        headers.put("Authorization", "Bearer " + token);

                        // 下载图片并转换为 base64
                        ImageData imageData = ConfluenceUtil.downloadImageAsBase64(downloadUrl, headers);

                        if (imageData != null && imageData.getBase64() != null) {
                            imageDataList.add(new ImageData(
                                    fileName,
                                    imageData.getBase64()
                            ));
                            log.info("成功下载附件: {}", fileName);
                        } else {
                            log.warn("下载附件失败: {}", fileName);
                        }
                    } catch (Exception e) {
                        log.error("下载附件失败: {} - {}", fileName, e.getMessage(), e);
                    }
                } else {
                    log.warn("附件不存在: {}", fileName);
                }
            }

            log.info("成功获取 {} 个附件的 base64 数据", imageDataList.size());

            return new CopyDeckAttachmentResponse(imageDataList);

        } catch (Exception e) {
            log.error("获取附件失败: {}", e.getMessage(), e);
            throw new CustomException(HttpStatus.INTERNAL_SERVER_ERROR.value(),
                    "Failed to get attachments: " + e.getMessage());
        }
    }


}
