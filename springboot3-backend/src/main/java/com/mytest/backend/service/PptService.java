package com.mytest.backend.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.sl.usermodel.Placeholder;
import org.apache.poi.sl.usermodel.TextParagraph;
import org.apache.poi.xslf.usermodel.*;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;

/**
 * PPT 生成服务
 * 使用 Apache POI 生成 PowerPoint 文件
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PptService {

    /**
     * 生成 PPT 并返回 Base64 编码的字节数组
     *
     * @param font     字体名称
     * @param pageCount 页数
     * @param title    PPT 标题
     * @return Base64 编码的 PPT 文件
     */
    public String generatePpt(String font, int pageCount, String title) throws IOException {
        log.info("开始生成 PPT: 字体={}, 页数={}, 标题={}", font, pageCount, title);

        // 创建 PPT 对象
        XMLSlideShow ppt = new XMLSlideShow();

        // 设置页面尺寸（可选）
        ppt.setPageSize(new Dimension(720, 540));

        // 生成标题页
        createTitleSlide(ppt, title, font);

        // 生成内容页
        for (int i = 1; i < pageCount; i++) {
            createContentSlide(ppt, "第 " + i + " 页内容",
                             "这是第 " + i + " 页的详细内容\n• 要点 1\n• 要点 2\n• 要点 3",
                             font);
        }

        // 转换为字节数组
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        ppt.write(outputStream);
        ppt.close();

        // 转换为 Base64
        byte[] pptBytes = outputStream.toByteArray();
        String base64Ppt = Base64.getEncoder().encodeToString(pptBytes);

        log.info("PPT 生成完成，文件大小: {} bytes", pptBytes.length);
        return base64Ppt;
    }

    /**
     * 创建标题页
     */
    private void createTitleSlide(XMLSlideShow ppt, String title, String fontName) {
        XSLFSlide slide = ppt.createSlide(ppt.getSlideMasters().get(0).getLayout(SlideLayout.TITLE));

        // 获取占位符并设置内容
        for (XSLFShape shape : slide.getShapes()) {
            if (shape instanceof XSLFTextShape) {
                XSLFTextShape textShape = (XSLFTextShape) shape;
                if (textShape.getTextType() == Placeholder.CENTERED_TITLE ||
                    textShape.getTextType() == Placeholder.TITLE) {
                    textShape.clearText();
                    XSLFTextParagraph paragraph = textShape.addNewTextParagraph();
                    XSLFTextRun run = paragraph.addNewTextRun();
                    run.setText(title);
                    run.setFontSize(44.0);
                    run.setFontFamily(fontName);
                    run.setBold(true);
                    paragraph.setTextAlign(TextParagraph.TextAlign.CENTER);
                }
            }
        }
    }

    /**
     * 创建内容页
     */
    private void createContentSlide(XMLSlideShow ppt, String title, String content, String fontName) {
        XSLFSlide slide = ppt.createSlide(ppt.getSlideMasters().get(0).getLayout(SlideLayout.TITLE_AND_CONTENT));

        // 标题
        XSLFTextShape titleShape = slide.getPlaceholder(0);
        if (titleShape != null) {
            titleShape.clearText();
            XSLFTextParagraph titleParagraph = titleShape.addNewTextParagraph();
            XSLFTextRun titleRun = titleParagraph.addNewTextRun();
            titleRun.setText(title);
            titleRun.setFontSize(32.0);
            titleRun.setFontFamily(fontName);
            titleRun.setBold(true);
        }

        // 内容
        XSLFTextShape contentShape = slide.getPlaceholder(1);
        if (contentShape != null) {
            contentShape.clearText();

            // 分段处理内容
            String[] lines = content.split("\n");
            for (String line : lines) {
                XSLFTextParagraph paragraph = contentShape.addNewTextParagraph();
                XSLFTextRun run = paragraph.addNewTextRun();
                run.setText(line);
                run.setFontSize(20.0);
                run.setFontFamily(fontName);
                paragraph.setLeftMargin(20.0);
            }
        }
    }
}
