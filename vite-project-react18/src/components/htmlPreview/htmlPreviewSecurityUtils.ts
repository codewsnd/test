const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'xlink:href'] as const;
const SVG_ATTRS = ['href', 'xlink:href'] as const;

const DANGEROUS_URL_PROTOCOL_PATTERN = /^\s*(javascript|vbscript)\s*:/i;
const DANGEROUS_DATA_URL_PATTERN = /^\s*data\s*:\s*(text\/html|application\/javascript|text\/javascript)\b/i;
const DANGEROUS_STYLE_URL_PATTERN = /url\s*\(\s*['"]?\s*(javascript|vbscript|data\s*:\s*(text\/html|application\/javascript|text\/javascript))/i;
const DANGEROUS_STYLE_EXPRESSION_PATTERN = /expression\s*\(/i;
const DANGEROUS_STYLE_BEHAVIOR_PATTERN = /\bbehavior\s*:/i;

const SENSITIVE_SOURCE_PATTERN = /document\s*\.\s*cookie|(?:localStorage|sessionStorage)\s*(?:\.|\[)/i;
const EXFILTRATION_SINK_PATTERN = /\b(?:fetch|XMLHttpRequest|sendBeacon|navigator\s*\.\s*sendBeacon)\b|new\s+Image\s*\(|location\s*\.\s*(?:href|assign|replace)/i;
const UNTRUSTED_DOM_SOURCE_PATTERN = /location\s*\.\s*(?:hash|search|href)|document\s*\.\s*(?:URL|location)/i;
const DOM_HTML_SINK_PATTERN = /(?:innerHTML|outerHTML)\s*=|document\s*\.\s*write\s*\(|insertAdjacentHTML\s*\(/i;
const DYNAMIC_EXEC_SINK_PATTERN = /\b(?:eval|Function)\s*\(/i;

const IMPORT_CSS_PATTERN = /@import\s+url\(['"]?([^'")]+)['"]?\)/gi;
const CSS_URL_PATTERN = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

const MAX_XSS_FINDINGS = 20;
const MAX_EXTERNAL_FINDINGS = 30;

const ALLOWED_DOMAINS = new Set<string>();

type SecurityWarningData = {
  hasXss: boolean;
  xssContent: string;
  hasExternalReferences: boolean;
  externalReferencesContent: string;
};

export const checkHtmlPreviewSecurity = (html: string | null | undefined): SecurityWarningData => {
  if (!html || !html.trim()) {
    return {
      hasXss: false,
      xssContent: '',
      hasExternalReferences: false,
      externalReferencesContent: '',
    };
  }

  const document = new DOMParser().parseFromString(html, 'text/html');

  const xssFindings = collectXssFindings(document);
  const externalFindings = collectExternalFindings(document);

  return {
    hasXss: xssFindings.length > 0,
    xssContent: buildNumberedReport(xssFindings),
    hasExternalReferences: externalFindings.length > 0,
    externalReferencesContent: buildNumberedReport(externalFindings),
  };
};

const collectXssFindings = (document: Document): string[] => {
  try {
    const findings: string[] = [];
    collectDangerousUrlProtocolFindings(document, findings);
    collectDangerousInlineScriptFindings(document, findings);
    collectDangerousInlineStyleFindings(document, findings);
    return findings;
  } catch {
    return [];
  }
};

const collectDangerousUrlProtocolFindings = (document: Document, findings: string[]): void => {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
    for (const attrName of URL_ATTRS) {
      const attrValue = element.getAttribute(attrName);
      if (!attrValue) {
        continue;
      }
      if (DANGEROUS_URL_PROTOCOL_PATTERN.test(attrValue)) {
        addFinding(findings, MAX_XSS_FINDINGS, `Dangerous URL protocol: ${describeElement(element)} ${attrName}="${safeSnippet(attrValue)}"`);
      }
      if (DANGEROUS_DATA_URL_PATTERN.test(attrValue)) {
        addFinding(findings, MAX_XSS_FINDINGS, `Dangerous Data URL: ${describeElement(element)} ${attrName}="${safeSnippet(attrValue)}"`);
      }
    }
  }
};

const collectDangerousInlineScriptFindings = (document: Document, findings: string[]): void => {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script:not([src])'));
  for (const script of scripts) {
    const scriptType = (script.getAttribute('type') ?? '').trim();
    if (scriptType &&
      !equalsIgnoreCase(scriptType, 'text/javascript') &&
      !equalsIgnoreCase(scriptType, 'application/javascript') &&
      !equalsIgnoreCase(scriptType, 'module')) {
      continue;
    }

    const scriptContent = (script.textContent ?? '').trim();
    if (isClearlyMaliciousInlineScript(scriptContent)) {
      addFinding(
        findings,
        MAX_XSS_FINDINGS,
        `Dangerous inline script: ${describeElement(script)} snippet="${safeSnippet(scriptContent)}"`
      );
    }
  }
};

const collectDangerousInlineStyleFindings = (document: Document, findings: string[]): void => {
  const styledElements = Array.from(document.querySelectorAll<HTMLElement>('[style]'));
  for (const element of styledElements) {
    const styleValue = element.getAttribute('style') ?? '';
    if (DANGEROUS_STYLE_EXPRESSION_PATTERN.test(styleValue)) {
      addFinding(
        findings,
        MAX_XSS_FINDINGS,
        `Dangerous inline style (expression): ${describeElement(element)} style="${safeSnippet(styleValue)}"`
      );
    }
    if (DANGEROUS_STYLE_BEHAVIOR_PATTERN.test(styleValue)) {
      addFinding(
        findings,
        MAX_XSS_FINDINGS,
        `Dangerous inline style (behavior): ${describeElement(element)} style="${safeSnippet(styleValue)}"`
      );
    }
    if (DANGEROUS_STYLE_URL_PATTERN.test(styleValue)) {
      addFinding(
        findings,
        MAX_XSS_FINDINGS,
        `Dangerous inline style (url): ${describeElement(element)} style="${safeSnippet(styleValue)}"`
      );
    }
  }
};

const isClearlyMaliciousInlineScript = (scriptContent: string): boolean => {
  const hasSensitiveSource = SENSITIVE_SOURCE_PATTERN.test(scriptContent);
  const hasExfiltrationSink = EXFILTRATION_SINK_PATTERN.test(scriptContent);
  if (hasSensitiveSource && hasExfiltrationSink) {
    return true;
  }

  const hasUntrustedDomSource = UNTRUSTED_DOM_SOURCE_PATTERN.test(scriptContent);
  const hasDomHtmlSink = DOM_HTML_SINK_PATTERN.test(scriptContent);
  if (hasUntrustedDomSource && hasDomHtmlSink) {
    return true;
  }

  const hasDynamicExecSink = DYNAMIC_EXEC_SINK_PATTERN.test(scriptContent);
  return hasUntrustedDomSource && hasDynamicExecSink;
};

const collectExternalFindings = (document: Document): string[] => {
  try {
    const findings = new Set<string>();

    collectBySelectorAttr(document, 'link[rel=stylesheet], link[href]', 'href', 'External CSS', findings);
    collectBySelectorAttr(document, 'script[src]', 'src', 'External script', findings);
    collectBySelectorAttr(document, 'img[src]', 'src', 'External image', findings);
    collectBySelectorAttr(document, 'audio[src], audio source[src]', 'src', 'External audio', findings);
    collectBySelectorAttr(document, 'video[src], video source[src]', 'src', 'External video', findings);
    collectBySelectorAttr(document, 'iframe[src]', 'src', 'External iframe', findings);
    collectExternalImportCss(document, findings);
    collectExternalCssUrls(document, findings);
    collectExternalSvgRefs(document, findings);
    collectExternalWorkers(document, findings);
    collectExternalObjects(document, findings);

    return Array.from(findings);
  } catch {
    return ['External resources check error: marked as risky by fail-safe policy'];
  }
};

const collectBySelectorAttr = (
  document: Document,
  selector: string,
  attrName: string,
  category: string,
  findings: Set<string>
): void => {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
  for (const element of elements) {
    const value = element.getAttribute(attrName);
    if (!value) {
      continue;
    }
    if (isExternalUrl(value)) {
      addFinding(findings, MAX_EXTERNAL_FINDINGS, `${category}: ${describeElement(element)} -> ${safeSnippet(value)}`);
    }
  }
};

const collectExternalImportCss = (document: Document, findings: Set<string>): void => {
  const styleElements = Array.from(document.querySelectorAll<HTMLStyleElement>('style'));
  for (const styleElement of styleElements) {
    const styleContent = styleElement.textContent ?? '';
    for (const url of matchAllUrls(styleContent, IMPORT_CSS_PATTERN)) {
      if (isExternalUrl(url)) {
        addFinding(
          findings,
          MAX_EXTERNAL_FINDINGS,
          `External CSS (@import): ${describeElement(styleElement)} -> ${safeSnippet(url)}`
        );
      }
    }
  }
};

const collectExternalCssUrls = (document: Document, findings: Set<string>): void => {
  const styleElements = Array.from(document.querySelectorAll<HTMLStyleElement>('style'));
  for (const styleElement of styleElements) {
    collectCssUrlsInText(styleElement.textContent ?? '', 'External CSS resource (url)', describeElement(styleElement), findings);
  }

  const styledElements = Array.from(document.querySelectorAll<HTMLElement>('[style]'));
  for (const element of styledElements) {
    collectCssUrlsInText(
      element.getAttribute('style') ?? '',
      'External inline style resource (url)',
      describeElement(element),
      findings
    );
  }
};

const collectCssUrlsInText = (
  cssText: string,
  category: string,
  elementDescription: string,
  findings: Set<string>
): void => {
  for (const url of matchAllUrls(cssText, CSS_URL_PATTERN)) {
    if (isExternalUrl(url)) {
      addFinding(findings, MAX_EXTERNAL_FINDINGS, `${category}: ${elementDescription} -> ${safeSnippet(url)}`);
    }
  }
};

const collectExternalSvgRefs = (document: Document, findings: Set<string>): void => {
  const svgElements = Array.from(document.querySelectorAll<HTMLElement>('svg [href], svg [xlink\\:href]'));
  for (const element of svgElements) {
    for (const attr of SVG_ATTRS) {
      const href = element.getAttribute(attr);
      if (!href) {
        continue;
      }
      if (isExternalUrl(href)) {
        addFinding(
          findings,
          MAX_EXTERNAL_FINDINGS,
          `External SVG reference: ${describeElement(element)} ${attr} -> ${safeSnippet(href)}`
        );
      }
    }
  }
};

const collectExternalWorkers = (document: Document, findings: Set<string>): void => {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script'));
  for (const script of scripts) {
    const workerType = script.getAttribute('type') ?? '';
    if (equalsIgnoreCase(workerType, 'text/worker') || equalsIgnoreCase(workerType, 'worker')) {
      const src = script.getAttribute('src');
      if (src && isExternalUrl(src)) {
        addFinding(findings, MAX_EXTERNAL_FINDINGS, `External Worker: ${describeElement(script)} -> ${safeSnippet(src)}`);
      }
    }
  }
};

const collectExternalObjects = (document: Document, findings: Set<string>): void => {
  const objects = Array.from(document.querySelectorAll<HTMLElement>('object[data], embed[src]'));
  for (const element of objects) {
    const value = element.getAttribute('data') ?? element.getAttribute('src');
    if (!value) {
      continue;
    }
    if (isExternalUrl(value)) {
      addFinding(findings, MAX_EXTERNAL_FINDINGS, `External embedded object: ${describeElement(element)} -> ${safeSnippet(value)}`);
    }
  }
};

const isExternalUrl = (url: string): boolean => {
  const normalizedUrl = url.trim();
  if (!normalizedUrl) {
    return false;
  }

  if (normalizedUrl.startsWith('//')) {
    return isExternalNetworkUrl(`https:${normalizedUrl}`);
  }

  if (startsWithIgnoreCase(normalizedUrl, 'data:') ||
    normalizedUrl.startsWith('/') ||
    normalizedUrl.startsWith('#') ||
    normalizedUrl.startsWith('?') ||
    startsWithIgnoreCase(normalizedUrl, 'about:')) {
    return false;
  }

  return isExternalNetworkUrl(normalizedUrl);
};

const isExternalNetworkUrl = (networkUrl: string): boolean => {
  try {
    const parsedUrl = new URL(networkUrl);
    const protocol = parsedUrl.protocol.replace(':', '').toLowerCase();
    if (protocol !== 'http' && protocol !== 'https') {
      return false;
    }

    const host = parsedUrl.hostname;
    if (!host) {
      return false;
    }

    for (const allowedDomain of Array.from(ALLOWED_DOMAINS)) {
      if (hostMatchesAllowedDomain(host, allowedDomain)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

const hostMatchesAllowedDomain = (host: string, allowedDomain: string): boolean => {
  if (!allowedDomain || !allowedDomain.trim()) {
    return false;
  }
  const normalizedHost = host.toLowerCase();
  const normalizedAllowedDomain = allowedDomain.toLowerCase();
  return normalizedHost === normalizedAllowedDomain || normalizedHost.endsWith(`.${normalizedAllowedDomain}`);
};

const buildNumberedReport = (findings: string[]): string => {
  if (findings.length === 0) {
    return '';
  }
  return findings.map((finding, index) => `${index + 1}. ${finding}`).join('\n');
};

const describeElement = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();
  let description = `<${tagName}`;
  if (element.id) {
    description += `#${element.id}`;
  }
  const classNames = Array.from(element.classList);
  if (classNames.length > 0) {
    description += `.${classNames.join('.')}`;
  }
  description += '>';
  return description;
};

const safeSnippet = (input: string): string => input.replace(/\s+/g, ' ').trim();

const startsWithIgnoreCase = (source: string, prefix: string): boolean =>
  source.toLowerCase().startsWith(prefix.toLowerCase());

const equalsIgnoreCase = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase();

const matchAllUrls = (content: string, pattern: RegExp): string[] => {
  if (!content || !content.trim()) {
    return [];
  }
  const matches: string[] = [];
  const regex = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null = regex.exec(content);
  while (match) {
    const url = match[1];
    if (url) {
      matches.push(url);
    }
    match = regex.exec(content);
  }
  return matches;
};

function addFinding(collection: string[] | Set<string>, maxCount: number, finding: string): void {
  if (collection instanceof Set) {
    if (collection.size >= maxCount) {
      return;
    }
    collection.add(finding);
    return;
  }

  if (collection.length >= maxCount) {
    return;
  }
  if (!collection.includes(finding)) {
    collection.push(finding);
  }
}
