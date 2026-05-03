package com.mytest.backend.controller;

import com.mytest.backend.dto.copydeck.CopyDeckAttachmentsRequest;
import com.mytest.backend.dto.copydeck.CopyDeckAttachmentResponse;
import com.mytest.backend.dto.copydeck.CopDeckUploadRequest;
import com.mytest.backend.dto.copydeck.CopyDeckStorageResponse;
import com.mytest.backend.service.CopyDeckService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;


@Slf4j
@RestController
@RequestMapping("/api/chatbycard/copydeck")
@RequiredArgsConstructor
public class CopyDeckController {

    private final CopyDeckService copyDeckService;


    /**
     * 获取Confluence的Storage
     */
    @GetMapping("/storage")
    public CopyDeckStorageResponse getStorage(@RequestParam String confluenceUrl, @RequestParam String staffId) {
        return copyDeckService.getStorage(staffId, confluenceUrl);
    }


    /**
     * 上传完整的 Storage HTML 到 Confluence
     */
    @PostMapping("/upload")
    public void uploadStorage(@RequestBody CopDeckUploadRequest request) {
        copyDeckService.uploadStorage(request);
    }

    /**
     * 获取 Confluence 附件的 base64 数据
     */
    @PostMapping("/getAttachments")
    public CopyDeckAttachmentResponse getAttachments(@RequestBody CopyDeckAttachmentsRequest request) {
        return copyDeckService.getAttachments(request);
    }
}
