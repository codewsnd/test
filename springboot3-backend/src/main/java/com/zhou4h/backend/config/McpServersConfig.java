package com.zhou4h.backend.config;

import com.zhou4h.backend.tools.CopyDeckTools;
import com.zhou4h.backend.tools.TestCaseTools;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class McpServersConfig {

    private final CopyDeckTools copyDeckTools;
    private final TestCaseTools testCaseTools;

    @Bean
    public ToolCallbackProvider tools() {
        return MethodToolCallbackProvider.builder()
                .toolObjects(
                        copyDeckTools,
                        testCaseTools)
                .build();
    }

}
