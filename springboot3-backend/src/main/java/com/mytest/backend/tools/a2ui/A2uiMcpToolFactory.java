package com.mytest.backend.tools.a2ui;

import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.server.McpStatelessServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class A2uiMcpToolFactory {

    public List<McpStatelessServerFeatures.SyncToolSpecification> statelessTools(
            List<A2uiToolDefinition> definitions
    ) {
        return definitions.stream()
                .map(this::statelessTool)
                .toList();
    }

    public List<McpServerFeatures.SyncToolSpecification> statefulTools(
            List<A2uiToolDefinition> definitions
    ) {
        return definitions.stream()
                .map(this::statefulTool)
                .toList();
    }

    private McpStatelessServerFeatures.SyncToolSpecification statelessTool(
            A2uiToolDefinition definition
    ) {
        return McpStatelessServerFeatures.SyncToolSpecification.builder()
                .tool(tool(definition))
                .callHandler((context, request) -> call(definition, request.arguments()))
                .build();
    }

    private McpServerFeatures.SyncToolSpecification statefulTool(
            A2uiToolDefinition definition
    ) {
        return McpServerFeatures.SyncToolSpecification.builder()
                .tool(tool(definition))
                .callHandler((exchange, request) -> call(definition, request.arguments()))
                .build();
    }

    private McpSchema.Tool tool(A2uiToolDefinition definition) {
        return McpSchema.Tool.builder()
                .name(definition.name())
                .description(definition.description())
                .inputSchema(definition.inputSchema())
                .build();
    }

    private McpSchema.CallToolResult call(
            A2uiToolDefinition definition,
            Map<String, Object> arguments
    ) {
        Map<String, Object> safeArguments = arguments == null ? Map.of() : arguments;
        return resourceResult(definition.handler().apply(safeArguments));
    }

    private McpSchema.CallToolResult resourceResult(A2uiResource resource) {
        return new McpSchema.CallToolResult(
                List.of(
                        new McpSchema.TextContent(resource.text()),
                        new McpSchema.EmbeddedResource(
                                new McpSchema.Annotations(
                                        List.of(McpSchema.Role.USER, McpSchema.Role.ASSISTANT),
                                        null
                                ),
                                new McpSchema.TextResourceContents(
                                        resource.resourceUri(),
                                        A2uiResource.MIME_TYPE,
                                        resource.a2uiJson()
                                )
                        )
                ),
                false
        );
    }
}
