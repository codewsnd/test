package com.mytest.backend.config;

import com.mytest.backend.tools.CopyDeckTools;
import com.mytest.backend.tools.PptTools;
import com.mytest.backend.tools.TestCaseTools;
import com.mytest.backend.tools.WeatherTools;
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
    private final PptTools pptTools;
    private final WeatherTools weatherTools;

    @Bean
    public ToolCallbackProvider tools() {
        return MethodToolCallbackProvider.builder()
                .toolObjects(
                        copyDeckTools,
                        testCaseTools,
                        pptTools,
                        weatherTools)
                .build();
    }

}
