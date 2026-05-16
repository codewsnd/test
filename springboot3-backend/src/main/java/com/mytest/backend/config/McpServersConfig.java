package com.mytest.backend.config;

import com.mytest.backend.tools.CopyDeckTools;
import com.mytest.backend.tools.PptTools;
import com.mytest.backend.tools.WeatherTools;
import com.mytest.backend.tools.a2ui.A2uiMcpToolFactory;
import com.mytest.backend.tools.a2ui.A2uiToolDefinition;
import com.mytest.backend.tools.a2ui.A2uiToolProvider;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.tool.ToolCallbackProvider;
import org.springframework.ai.tool.method.MethodToolCallbackProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class McpServersConfig {

    private final CopyDeckTools copyDeckTools;
    private final PptTools pptTools;
    private final WeatherTools weatherTools;
    private final List<A2uiToolProvider> a2uiToolProviders;
    private final A2uiMcpToolFactory a2uiMcpToolFactory;

    @Bean
    public ToolCallbackProvider tools() {
        return MethodToolCallbackProvider.builder()
                .toolObjects(
                        copyDeckTools,
                        pptTools,
                        weatherTools)
                .build();
    }

    @Bean
    public List<McpStatelessServerFeatures.SyncToolSpecification> a2uiStatelessTools() {
        return a2uiMcpToolFactory.statelessTools(a2uiToolDefinitions());
    }

    @Bean
    public List<McpServerFeatures.SyncToolSpecification> a2uiStatefulTools() {
        return a2uiMcpToolFactory.statefulTools(a2uiToolDefinitions());
    }

    private List<A2uiToolDefinition> a2uiToolDefinitions() {
        return a2uiToolProviders.stream()
                .map(A2uiToolProvider::a2uiToolDefinition)
                .toList();
    }

}
