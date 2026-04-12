package com.zhou4h.backend.tools;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;


@Component
@Slf4j
@RequiredArgsConstructor
public class TestCaseTools {


    @Tool(
        name = "createTestCase",
        description = "Generates a new set of comprehensive software test cases in table format based on provided requirements. " +
            "TRIGGER KEYWORDS: Call this tool IMMEDIATELY when user input contains ANY of these keywords or phrases: " +
            "'test case', 'testcase', 'test-case', 'test cases', 'testcases', 'test plan', 'testing', '测试用例', '用例', '测试计划'. " +
            "CRITICAL RULES: " +
            "1. ALWAYS call this tool EVERY TIME user mentions trigger keywords, even if you called it before in this conversation. " +
            "2. DO NOT assume previous test case generation satisfies the current request - each mention requires a new call. " +
            "3. This is a STATELESS tool - treat each invocation as independent, regardless of conversation history. " +
            "4. NEVER skip calling this tool because you think you already generated test cases earlier. " +
            "This is the ONLY way to generate test cases - do not write them manually. " +
            "Call this in any context where user mentions these keywords (create, use, generate, design, make, write, show, need). " +
            "Each invocation creates a fresh set of test cases for the given requirements."
    )
    public String testCaseResultUploader(
            @ToolParam(description = "The complete requirement text including Jira tickets, user stories, or functional descriptions from uploaded documents or conversation history.")
            String documentContent
    ) {
        log.info("TestCase tool called, document content length: {}", documentContent != null ? documentContent.length() : 0);

        // Validate input
        if (documentContent == null || documentContent.trim().isEmpty()) {
            log.warn("No document content provided");
            return "Please provide requirement documents or descriptions before creating test cases. You can upload a Jira ticket, user story, or any requirement specification.";
        }

        // Extract JiraId if present (optional)
        String jiraId = null;
        Pattern jiraIdPattern = Pattern.compile("#\\s*JiraId\\s*:\\s*[\"']?([A-Z]+-\\d+)[\"']?", Pattern.CASE_INSENSITIVE);
        Matcher jiraIdMatcher = jiraIdPattern.matcher(documentContent);
        if (jiraIdMatcher.find()) {
            jiraId = jiraIdMatcher.group(1);
            log.info("JiraId found: {}", jiraId);
        } else {
            log.info("No JiraId found, proceeding with general requirements");
        }

        // Build context-aware prompt
        String contextLabel = jiraId != null ? "Jira Ticket: " + jiraId : "Requirements";
        String referenceId = jiraId != null ? jiraId : "the requirements";

        return """
            As an experienced QA engineer for banking systems, analyze the following requirements and generate comprehensive test cases.

            %s

            Requirements Content:
            %s

            Test Case Generation Instructions:
            1. Carefully analyze the requirement to identify all testable scenarios
            2. Consider all test types:
               - Positive scenarios (happy path)
               - Negative scenarios (invalid inputs, error handling)
               - Edge cases (boundary values, limits)
               - Boundary conditions (min/max values)
            3. Each test case must be independent and executable
            4. Each step must have a clear, verifiable expected result
            5. Ensure complete coverage of functional and non-functional requirements

            Output Requirements:
            - Generate a SINGLE markdown table
            - NO additional text, explanations, or formatting outside the table
            - Use the exact format below

            Table Format:
            |Test Case Id|Test Case Description|Preconditions|Test Steps|Expected Results|

            Test Case ID Naming Convention:
            - Format: TC##-Descriptive_Name
            - Examples: TC01-Valid_Login, TC02-Invalid_Email, TC03-Empty_Password

            Example Row:
            |Test Case Id|Test Case Description|Preconditions|Test Steps|Expected Results|
            |TC01-Valid_Login|Verify user can login with valid credentials|User account exists and is active|1. Navigate to login page<br>2. Enter valid email address<br>3. Enter correct password<br>4. Click "Login" button|1. Login page loads successfully<br>2. Email field accepts input<br>3. Password field accepts input and masks characters<br>4. User is redirected to dashboard with welcome message|

            Now generate comprehensive test cases for %s following the above format.
            """.formatted(contextLabel, documentContent, referenceId);
    }
}
