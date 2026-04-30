package com.zhou4h.backend.utils;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * XSS 检测工具类
 * 仅拦截“高危且明确”的 XSS 场景，尽量避免误判导致正常 HTML 无法渲染
 */
@Slf4j
public final class XssUtils {

    // ==================== 常量定义 ====================

    /** style 属性名 */
    private static final String ATTR_STYLE = "style";

    /** src 属性名 */
    private static final String ATTR_SRC = "src";

    /** action 属性名 */
    private static final String ATTR_ACTION = "action";

    /** formaction 属性名 */
    private static final String ATTR_FORMACTION = "formaction";

    /** xlink:href 属性名 */
    private static final String ATTR_XLINK_HREF = "xlink:href";

    /** XPath 选择器：inline script */
    private static final String SELECTOR_INLINE_SCRIPT = "script:not([src])";

    /** XPath 选择器：带 href/src/action/formaction/xlink:href 的元素 */
    private static final String SELECTOR_ELEMENTS_WITH_URL = "[href],[src],[action],[formaction],[xlink\\:href]";

    /** 检查外部引用的属性名 */
    private static final String[] URL_ATTRS = {
        "href", ATTR_SRC, ATTR_ACTION, ATTR_FORMACTION, ATTR_XLINK_HREF
    };

    /** 危险 URL 协议（仅保留明确可执行协议） */
    private static final Pattern DANGEROUS_URL_PROTOCOL_PATTERN = Pattern.compile(
        "^\\s*(javascript|vbscript)\\s*:",
        Pattern.CASE_INSENSITIVE
    );

    /** 危险 data 协议（仅保留最明确可执行内容） */
    private static final Pattern DANGEROUS_DATA_URL_PATTERN = Pattern.compile(
        "^\\s*data\\s*:\\s*(text/html|application/javascript|text/javascript)\\b",
        Pattern.CASE_INSENSITIVE
    );

    /** style 中危险的可执行 URL */
    private static final Pattern DANGEROUS_STYLE_URL_PATTERN = Pattern.compile(
        "url\\s*\\(\\s*['\"]?\\s*(javascript|vbscript|data\\s*:\\s*(text/html|application/javascript|text/javascript))",
        Pattern.CASE_INSENSITIVE
    );

    /** style 中旧版 IE 执行表达式 */
    private static final Pattern DANGEROUS_STYLE_EXPRESSION_PATTERN = Pattern.compile(
        "expression\\s*\\(",
        Pattern.CASE_INSENSITIVE
    );

    /** style 中旧版 IE behavior 执行入口 */
    private static final Pattern DANGEROUS_STYLE_BEHAVIOR_PATTERN = Pattern.compile(
        "\\bbehavior\\s*:",
        Pattern.CASE_INSENSITIVE
    );

    /** 敏感数据来源（只有与外发行为组合时才判定风险） */
    private static final Pattern SENSITIVE_SOURCE_PATTERN = Pattern.compile(
        "document\\s*\\.\\s*cookie|(?:localStorage|sessionStorage)\\s*(?:\\.|\\[)",
        Pattern.CASE_INSENSITIVE
    );

    /** 明确外发/回传通道 */
    private static final Pattern EXFILTRATION_SINK_PATTERN = Pattern.compile(
        "\\b(?:fetch|XMLHttpRequest|sendBeacon|navigator\\s*\\.\\s*sendBeacon)\\b" +
            "|new\\s+Image\\s*\\(" +
            "|location\\s*\\.\\s*(?:href|assign|replace)",
        Pattern.CASE_INSENSITIVE
    );

    /** DOM XSS 的常见不可信来源 */
    private static final Pattern UNTRUSTED_DOM_SOURCE_PATTERN = Pattern.compile(
        "location\\s*\\.\\s*(?:hash|search|href)|document\\s*\\.\\s*(?:URL|location)",
        Pattern.CASE_INSENSITIVE
    );

    /** 可能执行 HTML/脚本的危险 DOM 注入点 */
    private static final Pattern DOM_HTML_SINK_PATTERN = Pattern.compile(
        "(?:innerHTML|outerHTML)\\s*=|document\\s*\\.\\s*write\\s*\\(|insertAdjacentHTML\\s*\\(",
        Pattern.CASE_INSENSITIVE
    );

    /** 动态执行入口（需要和不可信来源组合才判定风险） */
    private static final Pattern DYNAMIC_EXEC_SINK_PATTERN = Pattern.compile(
        "\\b(?:eval|Function)\\s*\\(",
        Pattern.CASE_INSENSITIVE
    );

    /** 检测失败日志消息 */
    private static final String LOG_DETECTION_FAILED = "XSS detection failed: {}";

    /** 检测失败时返回 false（避免误判导致页面不可渲染） */
    private static final boolean FAIL_SAFE_RESULT = false;

    /** 单次最多记录的风险条目数，避免内容过长 */
    private static final int MAX_FINDING_COUNT = 20;

    // ==================== 构造函数 ====================

    private XssUtils() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    // ==================== 公共方法 ====================

    /**
     * 检测 HTML 是否包含 XSS 攻击代码
     *
     * @param html HTML 内容
     * @return 如果检测到 XSS 返回 true，否则返回 false
     */
    public static boolean hasXss(String html) {
        return !collectXssFindings(html).isEmpty();
    }

    /**
     * 提取可读的 XSS 风险内容，便于落库审计
     *
     * @param html HTML 内容
     * @return 可读风险明细，多条以换行分隔；无风险返回空字符串
     */
    public static String extractXssContent(String html) {
        List<String> findings = collectXssFindings(html);
        if (findings.isEmpty()) {
            return "";
        }
        return String.join("\n", findings);
    }

    /**
     * 构建可读的 XSS 内容报告（仅文本摘要，不包含完整 HTML）
     *
     * @param html HTML 内容
     * @return 可读报告文本
     */
    public static String buildReadableXssContent(String html) {
        List<String> findings = collectXssFindings(html);
        if (findings.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < findings.size(); i++) {
            if (i > 0) {
                builder.append("\n");
            }
            builder.append(i + 1).append(". ").append(findings.get(i));
        }
        return builder.toString();
    }

    private static List<String> collectXssFindings(String html) {
        if (html == null || html.isBlank()) {
            return List.of();
        }

        try {
            Document doc = Jsoup.parse(html);
            List<String> findings = new ArrayList<>();

            collectDangerousUrlProtocolFindings(doc, findings);
            collectDangerousInlineScriptFindings(doc, findings);
            collectDangerousInlineStyleFindings(doc, findings);

            return findings;
        } catch (RuntimeException e) {
            log.warn(LOG_DETECTION_FAILED, e.getMessage(), e);
            return FAIL_SAFE_RESULT ? List.of("XSS check error: marked as risky by fail-safe policy") : List.of();
        }
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 检测危险 URL 协议（javascript:/vbscript:/高危 data:）
     */
    private static void collectDangerousUrlProtocolFindings(Document doc, List<String> findings) {
        for (Element element : doc.select(SELECTOR_ELEMENTS_WITH_URL)) {
            for (String attrName : URL_ATTRS) {
                if (!element.hasAttr(attrName)) {
                    continue;
                }
                String attrValue = element.attr(attrName);
                if (DANGEROUS_URL_PROTOCOL_PATTERN.matcher(attrValue).find()) {
                    addFinding(findings,
                            "Dangerous URL protocol: " + describeElement(element) +
                                    " " + attrName + "=\"" + safeSnippet(attrValue) + "\"");
                }
                if (DANGEROUS_DATA_URL_PATTERN.matcher(attrValue).find()) {
                    addFinding(findings,
                            "Dangerous Data URL: " + describeElement(element) +
                                    " " + attrName + "=\"" + safeSnippet(attrValue) + "\"");
                }
            }
        }
    }

    /**
     * 检测危险的内联脚本（仅拦截高危片段）
     */
    private static void collectDangerousInlineScriptFindings(Document doc, List<String> findings) {
        Elements scripts = doc.select(SELECTOR_INLINE_SCRIPT);
        for (Element script : scripts) {
            // script type 为空或是 JS 类型才参与检测；JSON-LD/template 脚本跳过
            String scriptType = script.attr("type");
            if (!scriptType.isBlank() &&
                !scriptType.equalsIgnoreCase("text/javascript") &&
                !scriptType.equalsIgnoreCase("application/javascript") &&
                !scriptType.equalsIgnoreCase("module")) {
                continue;
            }

            String scriptContent = script.data();
            if (scriptContent == null || scriptContent.isBlank()) {
                scriptContent = script.html();
            }

            if (isClearlyMaliciousInlineScript(scriptContent)) {
                addFinding(findings,
                        "Dangerous inline script: " + describeElement(script) +
                                " snippet=\"" + safeSnippet(scriptContent) + "\"");
            }
        }
    }

    /**
     * 检测危险 style 执行入口（不拦截普通 url(...)）
     */
    private static void collectDangerousInlineStyleFindings(Document doc, List<String> findings) {
        for (Element element : doc.getAllElements()) {
            if (!element.hasAttr(ATTR_STYLE)) {
                continue;
            }
            String styleValue = element.attr(ATTR_STYLE);
            if (DANGEROUS_STYLE_EXPRESSION_PATTERN.matcher(styleValue).find()) {
                addFinding(findings,
                        "Dangerous inline style (expression): " + describeElement(element) +
                                " style=\"" + safeSnippet(styleValue) + "\"");
            }
            if (DANGEROUS_STYLE_BEHAVIOR_PATTERN.matcher(styleValue).find()) {
                addFinding(findings,
                        "Dangerous inline style (behavior): " + describeElement(element) +
                                " style=\"" + safeSnippet(styleValue) + "\"");
            }
            if (DANGEROUS_STYLE_URL_PATTERN.matcher(styleValue).find()) {
                addFinding(findings,
                        "Dangerous inline style (url): " + describeElement(element) +
                                " style=\"" + safeSnippet(styleValue) + "\"");
            }
        }
    }

    private static void addFinding(List<String> findings, String finding) {
        if (findings.size() >= MAX_FINDING_COUNT) {
            return;
        }
        if (!findings.contains(finding)) {
            findings.add(finding);
        }
    }

    /**
     * 仅在出现“高危来源 + 高危行为”的明确组合时判定为恶意
     */
    private static boolean isClearlyMaliciousInlineScript(String scriptContent) {
        boolean hasSensitiveSource = SENSITIVE_SOURCE_PATTERN.matcher(scriptContent).find();
        boolean hasExfiltrationSink = EXFILTRATION_SINK_PATTERN.matcher(scriptContent).find();
        if (hasSensitiveSource && hasExfiltrationSink) {
            return true;
        }

        boolean hasUntrustedDomSource = UNTRUSTED_DOM_SOURCE_PATTERN.matcher(scriptContent).find();
        boolean hasDomHtmlSink = DOM_HTML_SINK_PATTERN.matcher(scriptContent).find();
        if (hasUntrustedDomSource && hasDomHtmlSink) {
            return true;
        }

        boolean hasDynamicExecSink = DYNAMIC_EXEC_SINK_PATTERN.matcher(scriptContent).find();
        return hasUntrustedDomSource && hasDynamicExecSink;
    }

    private static String safeSnippet(String input) {
        if (input == null || input.isBlank()) {
            return "";
        }
        return input.replaceAll("\\s+", " ").trim();
    }

    private static String describeElement(Element element) {
        StringBuilder builder = new StringBuilder("<").append(element.tagName());
        String id = element.id();
        if (id != null && !id.isBlank()) {
            builder.append("#").append(id);
        }
        if (!element.classNames().isEmpty()) {
            builder.append(".").append(String.join(".", element.classNames()));
        }
        builder.append(">");
        return builder.toString();
    }

}
