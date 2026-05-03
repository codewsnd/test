package com.mytest.backend.utils;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 外部资源检测工具类
 * 用于检测 HTML 内容中是否引入了外部第三方资源
 */
@Slf4j
public final class ExternalResourceUtils {

    // ==================== 常量定义 ====================

    /** href 属性名 */
    private static final String ATTR_HREF = "href";

    /** src 属性名 */
    private static final String ATTR_SRC = "src";

    /** data 属性名 */
    private static final String ATTR_DATA = "data";

    /** type 属性名 */
    private static final String ATTR_TYPE = "type";

    /** style 属性名 */
    private static final String ATTR_STYLE = "style";

    /** xlink:href 属性名 */
    private static final String ATTR_XLINK_HREF = "xlink:href";

    /** URL 前缀：data: */
    private static final String PREFIX_DATA = "data:";

    /** URL 前缀：// */
    private static final String PREFIX_DOUBLE_SLASH = "//";

    /** URL 前缀：/ */
    private static final String PREFIX_SLASH = "/";

    /** URL 前缀：# */
    private static final String PREFIX_HASH = "#";

    /** URL 前缀：? */
    private static final String PREFIX_QUESTION = "?";

    /** URL 前缀：about: */
    private static final String PREFIX_ABOUT = "about:";

    /** URL 前缀：https:// */
    private static final String PREFIX_HTTPS = "https://";

    /** URL 协议：http */
    private static final String SCHEME_HTTP = "http";

    /** URL 协议：https */
    private static final String SCHEME_HTTPS = "https";

    /** Worker 类型：text/worker */
    private static final String WORKER_TYPE_TEXT = "text/worker";

    /** worker 类型 */
    private static final String TYPE_WORKER = "worker";

    /** XPath 选择器：script */
    private static final String SELECTOR_SCRIPT = "script";

    /** XPath 选择器：link[rel=stylesheet], link[href] */
    private static final String SELECTOR_LINK_STYLESHEET = "link[rel=stylesheet], link[href]";

    /** XPath 选择器：script[src] */
    private static final String SELECTOR_SCRIPT_WITH_SRC = "script[src]";

    /** XPath 选择器：img[src] */
    private static final String SELECTOR_IMG_WITH_SRC = "img[src]";

    /** XPath 选择器：audio[src], audio source[src] */
    private static final String SELECTOR_AUDIO_WITH_SRC = "audio[src], audio source[src]";

    /** XPath 选择器：video[src], video source[src] */
    private static final String SELECTOR_VIDEO_WITH_SRC = "video[src], video source[src]";

    /** XPath 选择器：iframe[src] */
    private static final String SELECTOR_IFRAME_WITH_SRC = "iframe[src]";

    /** XPath 选择器：style */
    private static final String SELECTOR_STYLE = "style";

    /** XPath 选择器：SVG 子元素上的 href/xlink:href */
    private static final String SELECTOR_SVG_WITH_HREF = "svg [href], svg [xlink\\:href]";

    /** XPath 选择器：object[data], embed[src] */
    private static final String SELECTOR_OBJECT_WITH_DATA = "object[data], embed[src]";

    /** SVG 属性名 */
    private static final String[] SVG_ATTRS = {"href", ATTR_XLINK_HREF};

    /** @import URL 正则 */
    private static final Pattern IMPORT_CSS_PATTERN = Pattern.compile(
            "@import\\s+url\\(['\"]?([^'\")]+)['\"]?\\)",
            Pattern.CASE_INSENSITIVE
    );

    /** CSS url(...) 正则 */
    private static final Pattern CSS_URL_PATTERN = Pattern.compile(
            "url\\(\\s*['\"]?([^'\"\\)]+)['\"]?\\s*\\)",
            Pattern.CASE_INSENSITIVE
    );

    /** 允许的域名白名单（这些域名的外部资源是安全的） */
    private static final Set<String> ALLOWED_DOMAINS = new HashSet<>();

    /** 检测失败日志消息 */
    private static final String LOG_DETECTION_FAILED = "External resource detection failed: {}";

    /** 检测失败时返回 true（安全优先） */
    private static final boolean FAIL_SAFE_RESULT = true;

    /** URL 解析失败日志消息 */
    private static final String LOG_URL_PARSE_FAILED = "Failed to parse URL: {}";

    /** 单次最多记录的风险条目数，避免内容过长 */
    private static final int MAX_FINDING_COUNT = 30;

    static {
        // Add allowed domains here if needed
        // ALLOWED_DOMAINS.add("cdn.example.com");
        // ALLOWED_DOMAINS.add("static.example.com");
    }

    // ==================== 构造函数 ====================

    private ExternalResourceUtils() {
        throw new UnsupportedOperationException("Utility class cannot be instantiated");
    }

    // ==================== 公共方法 ====================

    /**
     * 检测 HTML 是否引入了外部第三方资源
     *
     * @param html HTML 内容
     * @return 如果检测到外部引用返回 true，否则返回 false
     */
    public static boolean hasExternalReferences(String html) {
        return !collectExternalReferenceFindings(html).isEmpty();
    }

    /**
     * 提取可读的外部资源引用内容，便于落库审计
     *
     * @param html HTML 内容
     * @return 可读外部资源明细，多条以换行分隔；无外部资源返回空字符串
     */
    public static String extractExternalReferencesContent(String html) {
        List<String> findings = collectExternalReferenceFindings(html);
        if (findings.isEmpty()) {
            return "";
        }
        return String.join("\n", findings);
    }

    /**
     * 构建可读的外部资源内容报告（仅文本摘要，不包含完整 HTML）
     *
     * @param html HTML 内容
     * @return 可读报告文本
     */
    public static String buildReadableExternalReferencesContent(String html) {
        List<String> findings = collectExternalReferenceFindings(html);
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

    private static List<String> collectExternalReferenceFindings(String html) {
        if (html == null || html.isBlank()) {
            return List.of();
        }

        try {
            Document doc = Jsoup.parse(html);
            Set<String> findings = new LinkedHashSet<>();

            collectBySelectorAttr(doc, SELECTOR_LINK_STYLESHEET, ATTR_HREF, "External CSS", findings);
            collectBySelectorAttr(doc, SELECTOR_SCRIPT_WITH_SRC, ATTR_SRC, "External script", findings);
            collectBySelectorAttr(doc, SELECTOR_IMG_WITH_SRC, ATTR_SRC, "External image", findings);
            collectBySelectorAttr(doc, SELECTOR_AUDIO_WITH_SRC, ATTR_SRC, "External audio", findings);
            collectBySelectorAttr(doc, SELECTOR_VIDEO_WITH_SRC, ATTR_SRC, "External video", findings);
            collectBySelectorAttr(doc, SELECTOR_IFRAME_WITH_SRC, ATTR_SRC, "External iframe", findings);
            collectExternalImportCss(doc, findings);
            collectExternalCssUrls(doc, findings);
            collectExternalSvgRefs(doc, findings);
            collectExternalWorkers(doc, findings);
            collectExternalObjects(doc, findings);

            return new ArrayList<>(findings);
        } catch (RuntimeException e) {
            log.warn(LOG_DETECTION_FAILED, e.getMessage(), e);
            if (FAIL_SAFE_RESULT) {
                return List.of("External resources check error: marked as risky by fail-safe policy");
            }
            return List.of();
        }
    }

    // ==================== 私有辅助方法 ====================

    private static void collectBySelectorAttr(
            Document doc,
            String selector,
            String attrName,
            String category,
            Set<String> findings
    ) {
        Elements elements = doc.select(selector);
        for (Element element : elements) {
            if (!element.hasAttr(attrName)) {
                continue;
            }
            String value = element.attr(attrName);
            if (isExternalUrl(value)) {
                addFinding(findings, category + ": " + describeElement(element) + " -> " + safeSnippet(value));
            }
        }
    }

    /**
     * 检测 @import 规则中的外部 CSS
     */
    private static void collectExternalImportCss(Document doc, Set<String> findings) {
        Elements styleElements = doc.select(SELECTOR_STYLE);
        for (Element style : styleElements) {
            String styleContent = style.html();
            Matcher matcher = IMPORT_CSS_PATTERN.matcher(styleContent);
            while (matcher.find()) {
                String url = matcher.group(1);
                if (isExternalUrl(url)) {
                    addFinding(findings,
                            "External CSS (@import): " + describeElement(style) + " -> " + safeSnippet(url));
                }
            }
        }
    }

    /**
     * 检测 CSS url(...) 中的外部资源（style 标签和内联 style 属性）
     */
    private static void collectExternalCssUrls(Document doc, Set<String> findings) {
        for (Element style : doc.select(SELECTOR_STYLE)) {
            collectCssUrlsInText(style.html(), "External CSS resource (url)", describeElement(style), findings);
        }
        for (Element element : doc.getAllElements()) {
            if (!element.hasAttr(ATTR_STYLE)) {
                continue;
            }
            collectCssUrlsInText(
                    element.attr(ATTR_STYLE),
                    "External inline style resource (url)",
                    describeElement(element),
                    findings
            );
        }
    }

    private static void collectCssUrlsInText(
            String cssText,
            String category,
            String elementDescription,
            Set<String> findings
    ) {
        if (cssText == null || cssText.isBlank()) {
            return;
        }
        Matcher matcher = CSS_URL_PATTERN.matcher(cssText);
        while (matcher.find()) {
            String url = matcher.group(1);
            if (isExternalUrl(url)) {
                addFinding(findings, category + ": " + elementDescription + " -> " + safeSnippet(url));
            }
        }
    }

    /**
     * 检测 SVG 中的外部引用
     */
    private static void collectExternalSvgRefs(Document doc, Set<String> findings) {
        Elements svgElements = doc.select(SELECTOR_SVG_WITH_HREF);
        for (Element svg : svgElements) {
            for (String attr : SVG_ATTRS) {
                if (!svg.hasAttr(attr)) {
                    continue;
                }
                String href = svg.attr(attr);
                if (isExternalUrl(href)) {
                    addFinding(findings,
                            "External SVG reference: " + describeElement(svg) + " " + attr + " -> " + safeSnippet(href));
                }
            }
        }
    }

    /**
     * 检测外部 Web Workers
     */
    private static void collectExternalWorkers(Document doc, Set<String> findings) {
        Elements scripts = doc.select(SELECTOR_SCRIPT);
        for (Element script : scripts) {
            String workerType = script.attr(ATTR_TYPE);
            if (WORKER_TYPE_TEXT.equalsIgnoreCase(workerType) ||
                    TYPE_WORKER.equalsIgnoreCase(workerType)) {
                String src = script.attr(ATTR_SRC);
                if (isExternalUrl(src)) {
                    addFinding(findings,
                            "External Worker: " + describeElement(script) + " -> " + safeSnippet(src));
                }
            }
        }
    }

    /**
     * 检测嵌入对象的 data/src 属性
     */
    private static void collectExternalObjects(Document doc, Set<String> findings) {
        Elements objects = doc.select(SELECTOR_OBJECT_WITH_DATA);
        for (Element object : objects) {
            String value = object.hasAttr(ATTR_DATA) ? object.attr(ATTR_DATA) : object.attr(ATTR_SRC);
            if (isExternalUrl(value)) {
                addFinding(findings,
                        "External embedded object: " + describeElement(object) + " -> " + safeSnippet(value));
            }
        }
    }

    private static void addFinding(Set<String> findings, String finding) {
        if (findings.size() >= MAX_FINDING_COUNT) {
            return;
        }
        findings.add(finding);
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

    /**
     * 判断 URL 是否为外部 URL
     *
     * @param url URL 字符串
     * @return 如果是外部 URL 返回 true
     */
    private static boolean isExternalUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }

        String normalizedUrl = url.trim();

        if (normalizedUrl.startsWith(PREFIX_DOUBLE_SLASH)) {
            return isExternalNetworkUrl(PREFIX_HTTPS + normalizedUrl);
        }

        // 跳过 data: URI 和相对路径
        if (startsWithIgnoreCase(normalizedUrl, PREFIX_DATA) ||
                normalizedUrl.startsWith(PREFIX_SLASH) ||
                normalizedUrl.startsWith(PREFIX_HASH) ||
                normalizedUrl.startsWith(PREFIX_QUESTION) ||
                startsWithIgnoreCase(normalizedUrl, PREFIX_ABOUT)) {
            return false;
        }

        return isExternalNetworkUrl(normalizedUrl);
    }

    private static boolean isExternalNetworkUrl(String networkUrl) {
        try {
            URI uri = new URI(networkUrl);
            String scheme = uri.getScheme();
            if (scheme == null ||
                    (!SCHEME_HTTP.equalsIgnoreCase(scheme) && !SCHEME_HTTPS.equalsIgnoreCase(scheme))) {
                return false;
            }

            String host = uri.getHost();

            if (host == null) {
                return false;
            }

            // 检查是否在白名单中
            for (String allowedDomain : ALLOWED_DOMAINS) {
                if (hostMatchesAllowedDomain(host, allowedDomain)) {
                    return false;
                }
            }

            return true;
        } catch (URISyntaxException e) {
            log.debug(LOG_URL_PARSE_FAILED, networkUrl);
            return false;
        }
    }

    private static boolean hostMatchesAllowedDomain(String host, String allowedDomain) {
        if (allowedDomain == null || allowedDomain.isBlank()) {
            return false;
        }
        String normalizedHost = host.toLowerCase(Locale.ROOT);
        String normalizedAllowedDomain = allowedDomain.toLowerCase(Locale.ROOT);
        return normalizedHost.equals(normalizedAllowedDomain) ||
                normalizedHost.endsWith("." + normalizedAllowedDomain);
    }

    private static boolean startsWithIgnoreCase(String source, String prefix) {
        return source.regionMatches(true, 0, prefix, 0, prefix.length());
    }
}
