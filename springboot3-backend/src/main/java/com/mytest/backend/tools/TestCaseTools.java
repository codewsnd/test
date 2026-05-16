package com.mytest.backend.tools;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

@Component
@Slf4j
@RequiredArgsConstructor
public class TestCaseTools {


    @Tool(
        name = "createTestCase",
        description = "Analyze any user-provided source materials and generate software test cases as a markdown table for the frontend. " +
            "Source materials may come from uploaded files or pasted text in many formats, including txt, csv, markdown, JSON, XML, HTML, Excel-exported tables, API documents, requirement specs, user stories, acceptance criteria, Jira or other ticket data, meeting notes, screenshots, OCR text, and conversation context. " +
            "Do not assume the materials are Jira tickets; Jira is only one possible source type. " +
            "Call this tool IMMEDIATELY whenever the user asks to create, generate, design, write, list, produce, or show test cases in English or Chinese. " +
            "English trigger phrases include: 'test case', 'test cases', 'testcase', 'testcases', 'test-case', 'test plan', 'testing scenarios', 'QA cases', 'create cases', 'generate cases'. " +
            "Chinese trigger phrases include: '测试用例', '生成测试用例', '创建测试用例', '设计测试用例', '用例', '测试场景', '测试计划', '写用例', '出用例'. " +
            "CRITICAL RULES: " +
            "1. ALWAYS call this tool EVERY TIME the user wants test cases, even if you called it before in this conversation. " +
            "2. DO NOT assume previous test case generation satisfies the current request - each mention requires a new call. " +
            "3. This is a STATELESS tool - treat each invocation as independent, regardless of conversation history. " +
            "4. NEVER skip calling this tool because you think you already generated test cases earlier. " +
            "5. Pass all relevant user-provided materials into the tool parameter, preserving file names, file types, table headers, row values, section titles, and any text extracted from uploads or images when available. " +
            "6. If the input contains structured data such as CSV rows, markdown tables, JSON fields, or XML nodes, analyze the structure instead of treating it as plain prose only. " +
            "This is the ONLY way to generate test cases - do not write test cases manually. " +
            "Each invocation creates a fresh set of test cases for the current source materials."
    )
    public String testCaseResultUploader(
            @ToolParam(description = "All user-provided source materials to analyze for test case creation. Include the latest user request, uploaded file names and types, extracted txt/csv/markdown/table/JSON/XML/API/spec content, pasted text, user stories, acceptance criteria, ticket data if present, image observations, and relevant conversation context.")
            String providedData
    ) {
        log.info("TestCase tool called, provided data length: {}", providedData != null ? providedData.length() : 0);

        if (providedData == null || providedData.trim().isEmpty()) {
            log.warn("No data provided to TestCase tool");
            return "Please provide source materials such as requirement documents, txt/csv files, tables, user stories, screenshots, API docs, or functional descriptions before creating test cases.";
        }

        String normalizedProvidedData = providedData.trim();

        return """
            As an experienced QA engineer, analyze all of the following user-provided source materials and generate comprehensive software test cases.

            Source Materials:
            %s

            Test Case Generation Instructions:
            1. Carefully analyze every piece of source material to identify all testable scenarios.
            2. Consider all test types:
               - Positive scenarios (happy path)
               - Negative scenarios (invalid inputs, error handling)
               - Edge cases (boundary values, limits)
               - Boundary conditions (min/max values)
            3. If the materials contain structured data such as CSV columns, table headers, JSON fields, XML tags, or API schemas, use that structure to derive test coverage.
            4. Each test case must be independent and executable.
            5. Each step must have a clear, verifiable expected result.
            6. Ensure complete coverage of functional and non-functional requirements.
            7. If any important detail is missing, continue with reasonable assumptions and put each assumption in the Preconditions cell.
            8. Use the same language as the user's latest request for cell content, but keep the table headers exactly as specified below.

            Output Requirements:
            - Generate a SINGLE markdown table
            - NO additional text, explanations, or formatting outside the table
            - Use the exact format below

            Table Format:
            |Test Case Id|Test Case Description|Preconditions|Test Steps|Expected Results|
            |---|---|---|---|---|

            Test Case ID Naming Convention:
            - Format: TC##-Descriptive_Name
            - Examples: TC01-Valid_Login, TC02-Invalid_Email, TC03-Empty_Password

            Example Row:
            |Test Case Id|Test Case Description|Preconditions|Test Steps|Expected Results|
            |---|---|---|---|---|
            |TC01-Valid_Login|Verify user can login with valid credentials|User account exists and is active|1. Navigate to login page<br>2. Enter valid email address<br>3. Enter correct password<br>4. Click "Login" button|1. Login page loads successfully<br>2. Email field accepts input<br>3. Password field accepts input and masks characters<br>4. User is redirected to dashboard with welcome message|

            Now generate comprehensive test cases for the source materials following the above format.
            """.formatted(normalizedProvidedData);
    }
}
