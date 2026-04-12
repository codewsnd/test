package com.zhou4h.backend.tools;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * PPT 生成工具
 * 用于 Spring AI Function Calling
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class PptTools {

    /**
     * 创建 PPT 的工具函数
     * 当用户请求创建 PPT 时，AI 会调用此函数
     *
     * @param userRequest 用户的原始请求内容
     * @return 返回 markdown 代码块格式，前端会识别并渲染表单
     */
    @Tool(
        description = "Generate a PPT presentation creation form. This tool should be called when the user asks to create, generate, or make a PowerPoint presentation (PPT, 演示文稿, 幻灯片). Returns a special markdown code block that the frontend will render as an interactive form."
    )
    public String createPpt(
            @ToolParam(description = "The user's original request about creating a PPT")
            String userRequest
    ) {
        log.info("PPT 创建工具被调用，用户请求: {}", userRequest);

        // 直接返回 markdown 代码块
        String result = "```pptGenerator\n{}\n```";
        log.info("工具返回内容: {}", result);

        return result;
    }
}
