import React from 'react';
import { Button, message, Tooltip } from 'antd';
import {
  ExpandAltOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useSetAtom } from 'jotai';
import { showTestCaseTableAtom } from '@/pages/home/components/testCase/testCaseAtom';
import 'highlight.js/styles/github.css';
import CopyDeckRenderer from './CopyDeckRenderer';
import CopyTestRenderer from './CopyTestRenderer';
import HtmlRenderer from './htmlPreview/HtmlRenderer';
import {
  extractHtmlCodeBlocks,
  isHtmlCodeContent,
  isHtmlLanguage,
  normalizeMarkdownContent
} from './htmlPreview/htmlCodeBlockUtils';
import PptGeneratorRenderer from './PptGeneratorRenderer';
import type {ConversationTurn} from "@/pages/home/components/chat/types";
import { Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
import oneLight from 'react-syntax-highlighter/dist/cjs/styles/prism/one-light'

interface MarkdownRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
  showExpandButton?: boolean; // 是否显示展开按钮
  turn: ConversationTurn;
}

type MarkdownAstNode = {
  children?: Array<MarkdownAstNode & { value?: string }>;
  data?: {
    value?: string;
  };
  position?: {
    start?: {
      line?: number;
      offset?: number;
    };
    end?: {
      line?: number;
    };
  };
};

const normalizeToolName = (value?: string) => (value ?? '').trim().toLowerCase();

const hasCopyTestResultUpdaterToolCall = (turn: ConversationTurn): boolean =>
  turn.processSteps?.some((step) => {
    const detailToolName = step.details?.find((detail) => detail.label === 'Tool')?.value;
    return (
      normalizeToolName(detailToolName) === 'copytestresultupdater' ||
      normalizeToolName(step.content).includes('copytestresultupdater')
    );
  }) ?? false;

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
                                                                    content,
                                                                    className,
                                                                    style,
                                                                    showExpandButton = false,
                                                                    turn
                                                                  }) => {
  const showTestCaseTable = useSetAtom(showTestCaseTableAtom)

  const markdownContent = React.useMemo(() => normalizeMarkdownContent(content), [content]);
  const htmlCodeBlocks = React.useMemo(() => extractHtmlCodeBlocks(markdownContent), [markdownContent]);
  const shouldUseCopyTestRenderer = hasCopyTestResultUpdaterToolCall(turn);

  // 手动解析和渲染表格
  const parseTable = (text: string) => {
    const lines = text.split('\n');
    const tableLines: string[] = [];
    const otherLines: string[] = [];
    let inTable = false;

    for (const line of lines) {
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        tableLines.push(line);
        inTable = true;
      } else if (inTable && line.trim() === '') {
        inTable = false;
      } else if (!inTable) {
        otherLines.push(line);
      }
    }

    if (tableLines.length === 0) {
      return { hasTable: false, otherContent: text };
    }

    // 解析表头
    const headers = tableLines[0].split('|').map(h => h.trim()).filter(h => h !== '');
    // 跳过分隔线，解析数据行
    const dataRows = tableLines.slice(2).map(row =>
      row.split('|').map(cell => cell.trim()).filter((_, idx) => idx > 0 && idx <= headers.length)
    );

    return {
      hasTable: true,
      otherContent: otherLines.join('\n'),
      headers,
      dataRows
    };
  };

  const { hasTable, otherContent, headers = [], dataRows = [] } = parseTable(markdownContent);
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const shouldShowHelloButton = hasTable && ['test case id', 'test case description', 'preconditions']
    .every((requiredHeader) => normalizedHeaders.includes(requiredHeader));
  let htmlBlockIndex = 0;

  return (
    <div className={className} style={{ ...style, position: 'relative' }}>
      {/* 展开按钮 */}
      {showExpandButton && (
        <Button
          type="text"
          size="small"
          icon={<ExpandAltOutlined />}
          onClick={showTestCaseTable}
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            zIndex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid #d9d9d9'
          }}
          title="展开详细视图"
        />
      )}

      {/* 如果有表格，先渲染其他内容，然后渲染表格 */}
      {hasTable && (
        <>
          {/* 渲染非表格内容 */}
          {otherContent && (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {otherContent}
            </ReactMarkdown>
          )}

          {/* 渲染表格 */}
          <div style={{ overflowX: 'auto', marginTop: '16px', marginBottom: '16px' }}>
            <table style={{
              borderCollapse: 'collapse',
              width: '100%',
              minWidth: '300px',
              border: '1px solid #e1e4e8',
              fontSize: '14px'
            }}>
              <thead style={{ backgroundColor: '#f6f8fa' }}>
              <tr style={{ borderBottom: '1px solid #e1e4e8' }}>
                {headers.map((header, idx) => (
                  <th key={idx} style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    backgroundColor: '#f6f8fa',
                    border: '1px solid #e1e4e8',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
              </thead>
              <tbody>
              {dataRows.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ borderBottom: '1px solid #e1e4e8' }}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} style={{
                      padding: '8px 12px',
                      border: '1px solid #e1e4e8',
                      verticalAlign: 'top',
                      wordBreak: 'break-word'
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
              </tbody>
            </table>
          </div>
          {shouldShowHelloButton && (
            <Button
              type="primary"
              onClick={() => message.info('hello')}
            >
              hello
            </Button>
          )}
        </>
      )}

      {/* 如果没有表格，使用 ReactMarkdown 渲染所有内容 */}
      {!hasTable && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            // 自定义代码块样式
            code: ({ node, className, children, ...props }) => {
              const match = /language-(\w+)/.exec(className || '');
              const explicitLanguage = match ? match[1] : '';

              // 尝试从 node 获取原始代码内容
              let codeContent = '';
              const markdownNode = node as MarkdownAstNode | undefined;

              // 方法1: 尝试从 node.children[0].value 获取
              if (markdownNode?.children?.[0]?.value) {
                codeContent = markdownNode.children[0].value;
              }
              // 方法2: 尝试从 node.data 获取
              else if (markdownNode?.data?.value) {
                codeContent = markdownNode.data.value;
              }
              // 方法3: 从 children 中提取文本（递归处理）
              else if (children) {
                const extractText = (item: unknown): string => {
                  if (typeof item === 'string') return item;
                  if (Array.isArray(item)) return item.map(extractText).join('');
                  if (React.isValidElement<{ children?: unknown }>(item) && item.props.children) {
                    return extractText(item.props.children);
                  }
                  return '';
                };
                codeContent = extractText(children);
              }
              const language = explicitLanguage || (isHtmlCodeContent(codeContent) ? 'html' : '');
              const codeStartLine = markdownNode?.position?.start?.line;
              const codeEndLine = markdownNode?.position?.end?.line;
              const hasCodeNodePosition =
                codeStartLine !== undefined &&
                codeEndLine !== undefined;
              const isSingleLineCodeNode = hasCodeNodePosition && codeStartLine === codeEndLine;
              const isInlineCode =
                !className &&
                (hasCodeNodePosition ? isSingleLineCodeNode : !codeContent.includes('\n') && !language);
              const blockKey = `${turn.id}-${markdownNode?.position?.start?.offset ?? 0}-${language}`;

              // 处理 copydeck 格式
              if (language === 'copydeck') {
                if (shouldUseCopyTestRenderer) {
                  return <CopyTestRenderer />;
                }

                return <CopyDeckRenderer />;
              }

              if (language.toLowerCase() === 'copytest') {
                return <CopyTestRenderer />;
              }

              // 处理 pptGenerator 格式（不区分大小写）
              if (language.toLowerCase() === 'pptgenerator') {
                return <PptGeneratorRenderer />;
              }

              if (isInlineCode) {
                return (
                  <code
                    style={{
                      backgroundColor: '#f6f8fa',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      fontSize: '85%',
                      color: '#d73a49'
                    }}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }

              if (isHtmlLanguage(language)) {
                const htmlExpansionKey = `${turn.id}-html-${htmlBlockIndex}`;
                const exactHtmlCodeContent = htmlCodeBlocks[htmlBlockIndex] ?? codeContent;
                htmlBlockIndex += 1;

                return (
                  <HtmlRenderer
                    blockKey={blockKey}
                    codeContent={exactHtmlCodeContent}
                    expansionKey={htmlExpansionKey}
                    language={language}
                    turn={turn}
                  />
                );
              }

              const displayLanguage = `${language.charAt(0).toUpperCase()}${language.slice(1)}`;
              const lineCount = codeContent ? codeContent.replace(/\n$/, '').split('\n').length : 0;

              return !isInlineCode && language ? (

                <div className={'relative group'}>
                  <div className={'transition-opacity duration-200'}>
                    <div className={'flex items-center justify-between px-3 h-10 bg-white'} style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 20,
                      border: '1px solid #e5e5e5',
                      borderBottom: 'none'
                    }}>
                      <div className={'text-sm font-medium'}>
                        <span>{displayLanguage}</span>
                        <span style={{ color: '#ccc', marginLeft: '6px' }}>- {lineCount} lines</span>
                      </div>
                      <div className={'flex items-center space-x-2'}>
                        <div className={'inline-block'}>
                          <Tooltip title="Test">
                            <Button
                              type="text"
                              size="small"
                              icon={<ExperimentOutlined />}
                              aria-label="Test"
                            />
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                  <SyntaxHighlighter
                    showLineNumbers
                    style={oneLight}
                    language={language}
                    wrapLongLines={false}
                    PreTag={'div'}
                    className={'rounded-lg'}
                    lineProps={{ style: { whiteSpace: 'pre' } }}
                    customStyle={{
                      marginTop: 0,
                      marginBottom: '0.5rem',
                      background: '#fff',
                      padding: '1rem',
                      borderRadius: 0,
                      border: '1px solid #e5e5e5',
                      overflowX: 'auto',
                      whiteSpace: 'pre'
                    }}
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                </div>
              ): (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
            // 自定义段落样式
            p: ({ children }) => (
              <p style={{ marginBottom: '12px', lineHeight: '1.6' }}>
                {children}
              </p>
            ),
            // 自定义列表样式
            ul: ({ children }) => (
              <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol style={{ marginLeft: '20px', marginBottom: '12px' }}>
                {children}
              </ol>
            ),
            // 自定义表格样式
            table: ({ children }) => (
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  minWidth: '300px',
                  border: '1px solid #e1e4e8',
                  fontSize: '14px'
                }}>
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead style={{ backgroundColor: '#f6f8fa' }}>
              {children}
              </thead>
            ),
            tbody: ({ children }) => (
              <tbody>
              {children}
              </tbody>
            ),
            tr: ({ children }) => (
              <tr style={{ borderBottom: '1px solid #e1e4e8' }}>
                {children}
              </tr>
            ),
            th: ({ children }) => (
              <th style={{
                padding: '8px 12px',
                textAlign: 'left',
                backgroundColor: '#f6f8fa',
                border: '1px solid #e1e4e8',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td style={{
                padding: '8px 12px',
                border: '1px solid #e1e4e8',
                verticalAlign: 'top',
                wordBreak: 'break-word'
              }}>
                {children}
              </td>
            ),
            // 自定义标题样式
            h1: ({ children }) => (
              <h1 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '16px',
                borderBottom: '1px solid #e1e4e8',
                paddingBottom: '8px'
              }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                marginBottom: '14px',
                borderBottom: '1px solid #e1e4e8',
                paddingBottom: '6px'
              }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>
                {children}
              </h3>
            ),
            h4: ({ children }) => (
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
                {children}
              </h4>
            ),
            h5: ({ children }) => (
              <h5 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                {children}
              </h5>
            ),
            h6: ({ children }) => (
              <h6 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>
                {children}
              </h6>
            ),
            // 自定义引用块样式
            blockquote: ({ children }) => (
              <blockquote style={{
                borderLeft: '4px solid #dfe2e5',
                paddingLeft: '16px',
                margin: '16px 0',
                color: '#6a737d',
                backgroundColor: '#f6f8fa',
                padding: '16px'
              }}>
                {children}
              </blockquote>
            ),
            // 自定义链接样式
            a: ({ children, href }) => (
              <a
                href={href}
                style={{ color: '#0366d6', textDecoration: 'none' }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.textDecoration = 'underline'}
                onMouseLeave={(e) => (e.target as HTMLElement).style.textDecoration = 'none'}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            // 自定义水平线样式
            hr: () => (
              <hr style={{
                border: 'none',
                borderTop: '1px solid #e1e4e8',
                margin: '24px 0'
              }} />
            ),
            // 自定义强调样式
            strong: ({ children }) => (
              <strong style={{ fontWeight: 'bold' }}>
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em style={{ fontStyle: 'italic' }}>
                {children}
              </em>
            ),
            // 自定义删除线样式
            del: ({ children }) => (
              <del style={{ textDecoration: 'line-through', color: '#6a737d' }}>
                {children}
              </del>
            )
          }}
        >
          {otherContent}
        </ReactMarkdown>
      )}
    </div>
  );
};

export default MarkdownRenderer;
