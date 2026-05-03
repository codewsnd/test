package com.mytest.backend.tools;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * CopyDeck 生成工具
 * 用于 Spring AI Function Calling
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class CopyDeckTools {

    @Tool(
        name = "createCopyDeck",
        description = "Creates a new interactive CopyDeck form for marketing copy creation. " +
            "TRIGGER KEYWORDS: Call this tool IMMEDIATELY when user input contains ANY of these keywords or phrases: " +
            "'copy deck', 'copydeck', 'copy test', 'copytest', 'copy-deck', 'copy-test'. " +
            "CRITICAL RULES: " +
            "1. ALWAYS call this tool EVERY TIME user mentions trigger keywords, even if you called it before in this conversation. " +
            "2. DO NOT assume previous CopyDeck calls satisfy the current request - each mention requires a new call. " +
            "3. This is a STATELESS tool - treat each invocation as independent, regardless of conversation history. " +
            "4. NEVER skip calling this tool because you think you already created a CopyDeck earlier. " +
            "This is the ONLY way to create a CopyDeck - do not attempt to create it manually. " +
            "Call this in any context where user mentions these keywords (create, use, generate, make, show, open, start, new). " +
            "Each invocation generates a fresh form instance."
            , returnDirect = true
    )
    public String copyTestResultUpdater() {
        log.info("CopyDeck tool called");
        return "```copydeck\n{}\n```";
    }
}
