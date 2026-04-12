package com.zhou4h.backend.controller;

import com.zhou4h.backend.dto.PptGenerateRequest;
import com.zhou4h.backend.dto.PptGenerateResponse;
import com.zhou4h.backend.service.PptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * PPT 生成 Controller
 */
@RestController
@RequestMapping("/api/ppt")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin("*")
public class PptController {

    private final PptService pptService;

    /**
     * 生成 PPT
     */
    @PostMapping("/generate")
    public PptGenerateResponse generatePpt(@RequestBody PptGenerateRequest request) {
        try {
            log.info("收到 PPT 生成请求: {}", request);

            // 参数校验
            if (request.getFont() == null || request.getFont().isEmpty()) {
                return PptGenerateResponse.error("字体不能为空");
            }
            if (request.getPageCount() == null || request.getPageCount() < 1) {
                return PptGenerateResponse.error("页数必须大于 0");
            }
            if (request.getPageCount() > 100) {
                return PptGenerateResponse.error("页数不能超过 100");
            }

            // 设置默认标题
            String title = request.getTitle();
            if (title == null || title.isEmpty()) {
                title = "AI 生成的演示文稿";
            }

            // 生成 PPT
            String pptBase64 = pptService.generatePpt(
                    request.getFont(),
                    request.getPageCount(),
                    title
            );

            // 生成文件名（带时间戳）
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
            String fileName = "presentation_" + timestamp + ".pptx";

            return PptGenerateResponse.success(pptBase64, fileName);

        } catch (Exception e) {
            log.error("生成 PPT 失败", e);
            return PptGenerateResponse.error("生成 PPT 失败: " + e.getMessage());
        }
    }
}
