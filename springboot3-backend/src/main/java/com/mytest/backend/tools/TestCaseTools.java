package com.mytest.backend.tools;

import com.mytest.backend.tools.a2ui.A2uiResource;
import com.mytest.backend.tools.a2ui.A2uiResourceFactory;
import com.mytest.backend.tools.a2ui.A2uiToolDefinition;
import com.mytest.backend.tools.a2ui.A2uiToolProvider;
import com.mytest.backend.tools.a2ui.A2uiToolSchema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.mytest.backend.tools.a2ui.A2uiArguments.optionalString;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.action;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.bind;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.component;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.list;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.obj;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.repeatedChildren;
import static com.mytest.backend.tools.a2ui.A2uiProtocol.surface;

@Component
@Order(20)
@Slf4j
@RequiredArgsConstructor
public class TestCaseTools implements A2uiToolProvider {

    public static final String TOOL_NAME = "createTestCase";
    public static final String TOOL_DESCRIPTION = "Analyze user-provided source materials and generate an interactive A2UI test case table. " +
            "Source materials may come from uploaded files or pasted text in many formats, including txt, csv, markdown, JSON, XML, HTML, Excel-exported tables, API documents, requirement specs, user stories, acceptance criteria, Jira or other ticket data, meeting notes, screenshots, OCR text, and conversation context. " +
            "Do not assume the materials are Jira tickets; Jira is only one possible source type. " +
            "Call this tool IMMEDIATELY whenever the user asks to create, generate, design, write, list, produce, or show test cases in English or Chinese. " +
            "English trigger phrases include: 'test case', 'test cases', 'testcase', 'testcases', 'test-case', 'test plan', 'testing scenarios', 'QA cases', 'create cases', 'generate cases'. " +
            "Chinese trigger phrases include: '测试用例', '生成测试用例', '创建测试用例', '设计测试用例', '用例', '测试场景', '测试计划', '写用例', '出用例'. " +
            "Return an A2UI v0.9 payload for the frontend to render. Do not manually describe a markdown table when this tool is available.";

    private static final String CATALOG_ID = "https://local.a2ui.dev/catalogs/test-case/v1.json";
    private static final int MAX_SOURCE_PREVIEW_LENGTH = 180;
    private static final int MAX_REQUESTED_CASE_COUNT = 20;
    private static final Pattern REQUESTED_CASE_COUNT_BEFORE_PATTERN = Pattern.compile(
            "(?i)(?:^|\\D)(\\d{1,2})\\s*(?:条|个)?\\s*(?:mock\\s*)?(?:test\\s*cases?|testcases?|cases?|测试用例|用例)"
    );
    private static final Pattern REQUESTED_CASE_COUNT_AFTER_PATTERN = Pattern.compile(
            "(?i)(?:test\\s*cases?|testcases?|cases?|测试用例|用例)\\D{0,12}(\\d{1,2})"
    );

    private static final List<TestCaseTemplate> MOCK_CASE_TEMPLATES = List.of(
            new TestCaseTemplate(
                    "Invalid_Input",
                    "Verify invalid or malformed input is rejected.",
                    "[Mock Data] Validation rules are available for the target feature.",
                    "1. Enter malformed data<br>2. Submit the form or request",
                    "1. Invalid data is rejected<br>2. The error message identifies the problem"
            ),
            new TestCaseTemplate(
                    "Duplicate_Submission",
                    "Verify duplicate submissions do not create duplicate records.",
                    "[Mock Data] A valid payload or form is ready to submit.",
                    "1. Submit the same request twice in quick succession<br>2. Review the saved result",
                    "1. Only one successful record is created<br>2. The duplicate attempt is ignored or clearly reported"
            ),
            new TestCaseTemplate(
                    "Search_Filter",
                    "Verify users can search or filter results by relevant criteria.",
                    "[Mock Data] Multiple records exist with different values.",
                    "1. Enter a search keyword or filter<br>2. Apply the criteria",
                    "1. Matching records are shown<br>2. Non-matching records are hidden"
            ),
            new TestCaseTemplate(
                    "Sorting_And_Pagination",
                    "Verify large result sets can be sorted and paged correctly.",
                    "[Mock Data] More records exist than fit on one page.",
                    "1. Sort by a visible column<br>2. Move to the next page",
                    "1. Records follow the selected sort order<br>2. Pagination keeps the result set consistent"
            ),
            new TestCaseTemplate(
                    "Save_Draft",
                    "Verify partially completed work can be saved as a draft.",
                    "[Mock Data] Draft saving is supported by the feature.",
                    "1. Enter partial data<br>2. Save as draft<br>3. Reopen the draft",
                    "1. Draft is saved successfully<br>2. Previously entered data is restored"
            ),
            new TestCaseTemplate(
                    "Cancel_Without_Saving",
                    "Verify cancellation leaves existing data unchanged.",
                    "[Mock Data] Existing data is available for editing.",
                    "1. Start editing data<br>2. Make changes<br>3. Cancel the workflow",
                    "1. User returns to the previous state<br>2. Unsaved changes are not persisted"
            ),
            new TestCaseTemplate(
                    "Network_Error_Recovery",
                    "Verify the feature handles temporary service failures gracefully.",
                    "[Mock Data] The downstream service can be simulated as unavailable.",
                    "1. Trigger the workflow while the service is unavailable<br>2. Restore the service and retry",
                    "1. A clear failure state is shown<br>2. Retry succeeds after the service is restored"
            ),
            new TestCaseTemplate(
                    "Session_Timeout",
                    "Verify expired sessions are handled safely.",
                    "[Mock Data] User is authenticated and session expiration can be simulated.",
                    "1. Let the session expire<br>2. Attempt the original action again",
                    "1. User is asked to sign in again<br>2. No protected operation completes silently"
            ),
            new TestCaseTemplate(
                    "Data_Export",
                    "Verify exported data matches the visible results.",
                    "[Mock Data] Export is available for the current result set.",
                    "1. Apply a known filter<br>2. Export the result<br>3. Compare the exported file",
                    "1. Export completes successfully<br>2. Exported rows match the filtered data"
            ),
            new TestCaseTemplate(
                    "Notification_State",
                    "Verify users receive the expected notification after completion.",
                    "[Mock Data] Notification delivery is enabled.",
                    "1. Complete the target workflow<br>2. Review in-app or external notifications",
                    "1. Notification is generated once<br>2. Notification content matches the completed action"
            ),
            new TestCaseTemplate(
                    "Audit_Trail",
                    "Verify important user actions are recorded for audit.",
                    "[Mock Data] Audit logging is enabled.",
                    "1. Perform a create, update, or delete action<br>2. Inspect the audit record",
                    "1. Audit entry contains actor, timestamp, and action<br>2. Sensitive data is not exposed"
            ),
            new TestCaseTemplate(
                    "Responsive_Layout",
                    "Verify the workflow remains usable on a small screen.",
                    "[Mock Data] A mobile or narrow viewport is available.",
                    "1. Open the feature on a narrow viewport<br>2. Complete the main workflow",
                    "1. Controls remain visible and usable<br>2. Content does not overlap or truncate critical data"
            ),
            new TestCaseTemplate(
                    "Accessibility_Keyboard",
                    "Verify the workflow can be completed with keyboard navigation.",
                    "[Mock Data] Keyboard-only interaction is available.",
                    "1. Navigate through controls using the keyboard<br>2. Submit the workflow",
                    "1. Focus order is logical<br>2. All required actions can be completed without a mouse"
            ),
            new TestCaseTemplate(
                    "Localization_Copy",
                    "Verify labels and messages remain clear in localized content.",
                    "[Mock Data] Localized copy or translated strings are available.",
                    "1. Switch to a supported locale<br>2. Complete the target workflow",
                    "1. Labels and messages use the selected locale<br>2. Text fits within the UI"
            ),
            new TestCaseTemplate(
                    "Performance_Baseline",
                    "Verify the main workflow completes within an acceptable response time.",
                    "[Mock Data] A representative amount of data is available.",
                    "1. Start the main workflow<br>2. Measure loading and submission time",
                    "1. Screen loads within the expected threshold<br>2. Submission completes without visible delay"
            ),
            new TestCaseTemplate(
                    "Delete_Confirmation",
                    "Verify destructive actions require confirmation.",
                    "[Mock Data] A removable record exists.",
                    "1. Start a delete action<br>2. Cancel once<br>3. Repeat and confirm",
                    "1. Cancel keeps the record unchanged<br>2. Confirm removes the correct record only"
            )
    );

    private final A2uiResourceFactory a2ui;

    @Override
    public A2uiToolDefinition a2uiToolDefinition() {
        return new A2uiToolDefinition(
                TOOL_NAME,
                TOOL_DESCRIPTION,
                A2uiToolSchema.object()
                        .requiredString(
                                "providedData",
                                "All user-provided source materials to analyze for test case creation."
                        )
                        .build(),
                arguments -> createTestCaseA2uiResource(optionalString(arguments, "providedData"))
        );
    }

    @Tool(
        name = TOOL_NAME,
        description = TOOL_DESCRIPTION
    )
    public String testCaseResultUploader(
            @ToolParam(description = "All user-provided source materials to analyze for test case creation. Include the latest user request, uploaded file names and types, extracted txt/csv/markdown/table/JSON/XML/API/spec content, pasted text, user stories, acceptance criteria, ticket data if present, image observations, and relevant conversation context.")
            String providedData
    ) {
        A2uiResource resource = createTestCaseA2uiResource(providedData);
        return a2ui.payloadJson(resource);
    }

    public A2uiResource createTestCaseA2uiResource(String providedData) {
        log.info("TestCase tool called, provided data length: {}", providedData != null ? providedData.length() : 0);

        if (providedData == null || providedData.trim().isEmpty()) {
            log.warn("No data provided to TestCase tool");
            TestCaseBundle emptyBundle = emptyBundle();
            List<Map<String, Object>> messages = buildA2uiMessages(emptyBundle);
            return a2ui.create(
                    "Please provide source materials before creating test cases.",
                    "ui://test-case/" + emptyBundle.id(),
                    messages
            );
        }

        TestCaseBundle bundle = buildBundle(providedData.trim());
        List<Map<String, Object>> messages = buildA2uiMessages(bundle);
        return a2ui.create(
                "Generated " + bundle.cases().size() + " A2UI test cases.",
                "ui://test-case/" + bundle.id(),
                messages
        );
    }

    private TestCaseBundle emptyBundle() {
        String id = "test-case-" + Instant.now().toEpochMilli();
        return new TestCaseBundle(
                id,
                "test-case-surface-" + id,
                "QA Test Cases",
                "No source material was provided.",
                "0 characters analyzed",
                "Waiting for input",
                "0 cases",
                List.of(),
                ""
        );
    }

    private TestCaseBundle buildBundle(String source) {
        String id = "test-case-" + Instant.now().toEpochMilli();
        List<GeneratedTestCase> cases = generateCases(source);
        String markdownTable = toMarkdownTable(cases);
        return new TestCaseBundle(
                id,
                "test-case-surface-" + id,
                "QA Test Cases",
                sourcePreview(source),
                source.length() + " characters analyzed",
                coverageLabel(source),
                cases.size() + " cases",
                cases,
                markdownTable
        );
    }

    private List<GeneratedTestCase> generateCases(String source) {
        String loweredSource = source.toLowerCase(Locale.ROOT);
        Integer requestedCaseCount = requestedCaseCount(source);
        List<GeneratedTestCase> cases = new ArrayList<>();

        if (containsAny(loweredSource, "login", "sign in", "auth", "password", "登录", "登陆", "密码")) {
            cases.add(new GeneratedTestCase(
                    "TC01-Valid_Login",
                    "Verify a valid user can sign in successfully.",
                    "A registered active user account exists.",
                    "1. Open the sign-in page<br>2. Enter valid credentials<br>3. Submit the form",
                    "1. Credentials are accepted<br>2. User is redirected to the authenticated landing page"
            ));
            cases.add(new GeneratedTestCase(
                    "TC02-Invalid_Credentials",
                    "Verify invalid credentials are rejected.",
                    "The sign-in page is available.",
                    "1. Enter a valid username with an incorrect password<br>2. Submit the form",
                    "1. Login is blocked<br>2. A clear validation or authentication error is shown"
            ));
        }

        if (containsAny(loweredSource, "api", "json", "http", "endpoint", "接口", "请求", "响应")) {
            cases.add(new GeneratedTestCase(
                    nextId(cases, "Valid_API_Request"),
                    "Verify the API handles a valid request payload.",
                    "The API endpoint is available and the caller has required access.",
                    "1. Send a request with all required fields<br>2. Inspect the response status and body",
                    "1. Response status indicates success<br>2. Response body matches the documented schema"
            ));
            cases.add(new GeneratedTestCase(
                    nextId(cases, "Missing_Required_Field"),
                    "Verify the API rejects requests missing required data.",
                    "The API endpoint is available.",
                    "1. Remove one required field from the request<br>2. Submit the request",
                    "1. Request is rejected<br>2. Error response identifies the missing field"
            ));
        }

        if (containsAny(loweredSource, "upload", "file", "csv", "excel", "附件", "文件", "上传", "表格")) {
            cases.add(new GeneratedTestCase(
                    nextId(cases, "Valid_File_Upload"),
                    "Verify a supported file can be uploaded and processed.",
                    "A valid supported file is available.",
                    "1. Select a supported file<br>2. Upload the file<br>3. Review the processing result",
                    "1. File uploads successfully<br>2. Parsed content is shown without data loss"
            ));
            cases.add(new GeneratedTestCase(
                    nextId(cases, "Unsupported_File_Type"),
                    "Verify unsupported file types are rejected.",
                    "An unsupported file type is available.",
                    "1. Select an unsupported file<br>2. Attempt to upload it",
                    "1. Upload is blocked<br>2. User receives a clear unsupported file type message"
            ));
        }

        if (cases.isEmpty()) {
            cases.add(new GeneratedTestCase(
                    "TC01-Happy_Path",
                    "Verify the main user workflow completes successfully.",
                    "[Business Assumption] The user has valid access and required data is available.",
                    "1. Open the target feature<br>2. Complete all required fields or actions<br>3. Submit or finish the workflow",
                    "1. Workflow completes successfully<br>2. User receives a clear success state"
            ));
            cases.add(new GeneratedTestCase(
                    "TC02-Required_Field_Validation",
                    "Verify required field validation prevents incomplete submission.",
                    "[Business Assumption] The feature contains at least one required field.",
                    "1. Leave required data empty<br>2. Attempt to submit",
                    "1. Submission is blocked<br>2. Required field guidance is displayed"
            ));
        }

        cases.add(new GeneratedTestCase(
                nextId(cases, "Boundary_And_Error_Handling"),
                "Verify boundary values and unexpected input are handled safely.",
                "[Business Assumption] Input limits and validation rules follow the provided requirements.",
                "1. Enter minimum, maximum, and out-of-range values<br>2. Submit each variation",
                "1. Valid boundary values are accepted<br>2. Invalid values are rejected with actionable feedback"
        ));

        cases.add(new GeneratedTestCase(
                nextId(cases, "Permission_And_Access_Control"),
                "Verify unauthorized users cannot perform restricted actions.",
                "[Business Assumption] The feature has role-based or session-based access control.",
                "1. Access the feature without required permission<br>2. Attempt the restricted action",
                "1. Access is denied or action is blocked<br>2. No restricted data is exposed"
        ));

        if (requestedCaseCount != null) {
            fitRequestedCaseCount(cases, requestedCaseCount);
        }

        return cases;
    }

    private List<Map<String, Object>> buildA2uiMessages(TestCaseBundle bundle) {
        return surface(bundle.surfaceId(), CATALOG_ID, buildComponents(), buildDataModel(bundle));
    }

    private List<Map<String, Object>> buildComponents() {
        return list(
                component(
                        "root",
                        "TestCasePanel",
                        "children", List.of(
                                "test-case-header",
                                "test-case-stats",
                                "test-case-table",
                                "test-case-actions"
                        )
                ),
                component(
                        "test-case-header",
                        "TestCaseHeader",
                        "title", bind("/title"),
                        "sourcePreview", bind("/sourcePreview")
                ),
                component(
                        "test-case-stats",
                        "TestCaseStats",
                        "children", repeatedChildren("test-case-stat-template", "/stats")
                ),
                component(
                        "test-case-stat-template",
                        "TestCaseStat",
                        "label", bind("label"),
                        "value", bind("value")
                ),
                component(
                        "test-case-table",
                        "TestCaseTable",
                        "children", repeatedChildren("test-case-row-template", "/cases")
                ),
                component(
                        "test-case-row-template",
                        "TestCaseRow",
                        "testCaseId", bind("testCaseId"),
                        "description", bind("description"),
                        "preconditions", bind("preconditions"),
                        "steps", bind("steps"),
                        "expectedResults", bind("expectedResults")
                ),
                component(
                        "test-case-actions",
                        "TestCaseActions",
                        "exportLabel", bind("/actions/exportLabel"),
                        "copyLabel", bind("/actions/copyLabel"),
                        "exportAction", action("test_case_export_jira", testCaseActionContext()),
                        "copyAction", action("test_case_copy_markdown", testCaseActionContext())
                )
        );
    }

    private Map<String, Object> buildDataModel(TestCaseBundle bundle) {
        return obj(
                "title", bundle.title(),
                "sourcePreview", bundle.sourcePreview(),
                "stats", List.of(
                        obj("label", "Generated", "value", bundle.caseCountLabel()),
                        obj("label", "Coverage", "value", bundle.coverageLabel()),
                        obj("label", "Input", "value", bundle.sourceSizeLabel())
                ),
                "cases", bundle.cases().stream()
                        .map(testCase -> obj(
                                "testCaseId", testCase.testCaseId(),
                                "description", testCase.description(),
                                "preconditions", testCase.preconditions(),
                                "steps", testCase.steps(),
                                "expectedResults", testCase.expectedResults()
                        ))
                        .toList(),
                "actions", obj(
                        "exportLabel", "Export to Jira",
                        "copyLabel", "Copy Markdown"
                ),
                "markdownTable", bundle.markdownTable()
        );
    }

    private Map<String, Object> testCaseActionContext() {
        return obj(
                "markdownTable", bind("/markdownTable"),
                "caseCount", bind("/stats/0/value")
        );
    }

    private String toMarkdownTable(List<GeneratedTestCase> cases) {
        StringBuilder builder = new StringBuilder();
        builder.append("|Test Case Id|Test Case Description|Preconditions|Test Steps|Expected Results|\n");
        builder.append("|---|---|---|---|---|\n");
        for (GeneratedTestCase testCase : cases) {
            builder.append("|")
                    .append(markdownCell(testCase.testCaseId())).append("|")
                    .append(markdownCell(testCase.description())).append("|")
                    .append(markdownCell(testCase.preconditions())).append("|")
                    .append(markdownCell(testCase.steps())).append("|")
                    .append(markdownCell(testCase.expectedResults())).append("|\n");
        }
        return builder.toString().trim();
    }

    private static boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private static String nextId(List<GeneratedTestCase> cases, String suffix) {
        return "TC%02d-%s".formatted(cases.size() + 1, suffix);
    }

    private static Integer requestedCaseCount(String source) {
        Matcher beforeMatcher = REQUESTED_CASE_COUNT_BEFORE_PATTERN.matcher(source);
        if (beforeMatcher.find()) {
            return clampRequestedCaseCount(beforeMatcher.group(1));
        }

        Matcher afterMatcher = REQUESTED_CASE_COUNT_AFTER_PATTERN.matcher(source);
        if (afterMatcher.find()) {
            return clampRequestedCaseCount(afterMatcher.group(1));
        }

        return null;
    }

    private static int clampRequestedCaseCount(String countText) {
        int count = Integer.parseInt(countText);
        return Math.max(1, Math.min(count, MAX_REQUESTED_CASE_COUNT));
    }

    private static void fitRequestedCaseCount(List<GeneratedTestCase> cases, int requestedCaseCount) {
        if (cases.size() > requestedCaseCount) {
            cases.subList(requestedCaseCount, cases.size()).clear();
            return;
        }

        int templateIndex = 0;
        while (cases.size() < requestedCaseCount) {
            TestCaseTemplate template = MOCK_CASE_TEMPLATES.get(templateIndex % MOCK_CASE_TEMPLATES.size());
            cases.add(new GeneratedTestCase(
                    nextId(cases, template.suffix()),
                    template.description(),
                    template.preconditions(),
                    template.steps(),
                    template.expectedResults()
            ));
            templateIndex++;
        }
    }

    private static String sourcePreview(String source) {
        String singleLineSource = source.replaceAll("\\s+", " ").trim();
        if (singleLineSource.length() <= MAX_SOURCE_PREVIEW_LENGTH) {
            return singleLineSource;
        }
        return singleLineSource.substring(0, MAX_SOURCE_PREVIEW_LENGTH) + "...";
    }

    private static String coverageLabel(String source) {
        String loweredSource = source.toLowerCase(Locale.ROOT);
        List<String> signals = new ArrayList<>();
        if (containsAny(loweredSource, "api", "json", "http", "endpoint", "接口")) {
            signals.add("API");
        }
        if (containsAny(loweredSource, "login", "auth", "password", "登录", "密码")) {
            signals.add("Auth");
        }
        if (containsAny(loweredSource, "upload", "file", "csv", "excel", "上传", "文件")) {
            signals.add("File");
        }
        if (signals.isEmpty()) {
            return "Functional";
        }
        return String.join(" + ", signals);
    }

    private static String markdownCell(String value) {
        return value.replace("|", "\\|").replace("\n", "<br>");
    }

    private record TestCaseBundle(
            String id,
            String surfaceId,
            String title,
            String sourcePreview,
            String sourceSizeLabel,
            String coverageLabel,
            String caseCountLabel,
            List<GeneratedTestCase> cases,
            String markdownTable
    ) {
    }

    private record GeneratedTestCase(
            String testCaseId,
            String description,
            String preconditions,
            String steps,
            String expectedResults
    ) {
    }

    private record TestCaseTemplate(
            String suffix,
            String description,
            String preconditions,
            String steps,
            String expectedResults
    ) {
    }
}
