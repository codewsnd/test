import React from 'react';
import { Button, message, Tooltip } from 'antd';
import {
  ExpandAltOutlined,
  DownloadOutlined,
  EyeOutlined,
  EditOutlined,
  SaveOutlined,
  RollbackOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {useAtom, useSetAtom} from 'jotai';
import { showTestCaseTableAtom } from '@/pages/home/components/testCase/testCaseAtom.ts';
import 'highlight.js/styles/github.css';
import CopyDeckRenderer from "./CopyDeckRenderer.tsx";
import PptGeneratorRenderer from "./PptGeneratorRenderer.tsx";
import {
  htmlPreviewContentAtom,
  htmlPreviewLiveModeAtom,
  htmlPreviewSidebarVisibleAtom,
  htmlPreviewTurnIdAtom,
  showHtmlPreviewSidebarAtom
} from "@/components/htmlPreview/htmlPreviewAtom";
import type {ConversationTurn} from "@/pages/home/components/chat/types";
import { Prism as SyntaxHighlighter} from 'react-syntax-highlighter';
import oneLight from 'react-syntax-highlighter/dist/cjs/styles/prism/one-light'
import CodeEditor from '@/components/editor/CodeEditor.tsx';
import {
  activeConversationIdAtom,
  setConversationStateAtom
} from "@/pages/home/components/conversationHistory/conversationHistoryAtom";
import { createHtmlPreviewApi } from '@/api/conversationHtmlPreviewApi';
import {downloadHtmlFile} from '@/utils/downloadUtils';

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
      offset?: number;
    };
  };
};

const FENCED_CODE_BLOCK_PATTERN = /^\s*```/;
const HTML_DOCUMENT_PATTERN = /(?:<!doctype\s+html|<html[\s>])/i;
const COMPLETE_HTML_TAG_PATTERN = /^<[a-z][\w:-]*(?:\s|>|\/>)[\s\S]*<\/[a-z][\w:-]*>\s*$/i;

const isHtmlCodeContent = (value: string) => {
  const trimmedValue = value.trim();
  return HTML_DOCUMENT_PATTERN.test(trimmedValue) || COMPLETE_HTML_TAG_PATTERN.test(trimmedValue);
};

const normalizeMarkdownContent = (value: string) => {
  if (!isHtmlCodeContent(value) || FENCED_CODE_BLOCK_PATTERN.test(value)) {
    return value;
  }

  return `\`\`\`html\n${value.trimEnd()}\n\`\`\``;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
                                                                    content,
                                                                    className,
                                                                    style,
                                                                    showExpandButton = false,
                                                                    turn
                                                                  }) => {
  const showTestCaseTable = useSetAtom(showTestCaseTableAtom)

  // html edit
  const [editingCodeBlocks, setEditingCodeBlocks] = React.useState<Record<string, boolean>>({});
  const [editedCodeBlocks, setEditedCodeBlocks] = React.useState<Record<string, string>>({});
  const [savingCodeBlocks, setSavingCodeBlocks] = React.useState<Record<string, boolean>>({});
  const editingCodeDraftRef = React.useRef<Record<string, string>>({});
  const editingCodeOriginalRef = React.useRef<Record<string, string>>({});

  // html preview
  const showHtmlPreviewSidebar = useSetAtom(showHtmlPreviewSidebarAtom);
  const setHtmlPreviewTurnId = useSetAtom(htmlPreviewTurnIdAtom);
  const setHtmlPreviewContent = useSetAtom(htmlPreviewContentAtom);
  const setHtmlPreviewLiveMode = useSetAtom(htmlPreviewLiveModeAtom);
  const [isHtmlPreviewSidebarVisible] = useAtom(htmlPreviewSidebarVisibleAtom);
  const handleHtmlPreview =  (id: string, content: string) => {
    setHtmlPreviewTurnId(turn.id);
    setHtmlPreviewContent(content);
    showHtmlPreviewSidebar();
  };
  const syncLivePreviewForEditing = React.useCallback((previewContent: string, ensureOpen: boolean = false) => {
    if (!isHtmlPreviewSidebarVisible && !ensureOpen) {
      return;
    }
    setHtmlPreviewTurnId(turn.id);
    setHtmlPreviewContent(previewContent);
    setHtmlPreviewLiveMode(true);
    if (ensureOpen) {
      showHtmlPreviewSidebar();
    }
  }, [
    isHtmlPreviewSidebarVisible,
    setHtmlPreviewContent,
    setHtmlPreviewLiveMode,
    setHtmlPreviewTurnId,
    showHtmlPreviewSidebar,
    turn.id
  ]);

  const [activeConversationId] = useAtom(activeConversationIdAtom);
  const setConversationState = useSetAtom(setConversationStateAtom);

  const markdownContent = React.useMemo(() => normalizeMarkdownContent(content), [content]);

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
            code: ({ node, inline, className, children, ...props }) => {
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
              const blockKey = `${turn.id}-${markdownNode?.position?.start?.offset ?? 0}-${language}`;
              const turnWithEditedCodeBlocks = turn as ConversationTurn & {
                editedCodeBlocks?: Record<string, string>;
              };
              const savedCodeContent = turnWithEditedCodeBlocks.editedCodeBlocks?.[blockKey];
              const isEditingCurrentBlock = !!editingCodeBlocks[blockKey];
              const isSavingCurrentBlock = !!savingCodeBlocks[blockKey];
              const currentCodeContent = editedCodeBlocks[blockKey] ?? savedCodeContent ?? codeContent;

              console.log('language', language);
              console.log('raw node', markdownNode);
              console.log('codeContent', currentCodeContent);

              // 处理 copydeck 格式
              if (language === 'copydeck') {
                return <CopyDeckRenderer />;
              }

              // 处理 pptGenerator 格式（不区分大小写）
              if (language.toLowerCase() === 'pptgenerator') {
                console.log('渲染 PptGeneratorRenderer');
                return <PptGeneratorRenderer />;
              }

              if (inline) {
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
              const isHtml = language === 'html' || language === 'htm' || language === 'xhtml';
              const isAIResponseCompleted = turn?.aiResponse.status === 'completed';
              const displayLanguage = `${language.charAt(0).toUpperCase()}${language.slice(1)}`;
              const lineCount = currentCodeContent ? currentCodeContent.replace(/\n$/, '').split('\n').length : 0;

              return !inline && language ? (

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
                        {isHtml && isAIResponseCompleted && <>
                          <div className={'inline-block'}>
                            <Tooltip title="Download">
                              <Button
                                type="text"
                                size="small"
                                icon={<DownloadOutlined />}
                                disabled={isEditingCurrentBlock}
                                onClick={() => downloadHtmlFile(currentCodeContent)}
                                aria-label="Download"
                              />
                            </Tooltip>
                          </div>
                          <div className={'inline-block'}>
                            <Tooltip title="Preview">
                              <Button
                                type="text"
                                size="small"
                                icon={<EyeOutlined />}
                                disabled={isEditingCurrentBlock}
                                onClick={() => handleHtmlPreview('turn_123', currentCodeContent)}
                                aria-label="Preview"
                              />
                            </Tooltip>
                          </div>
                          <div className={'inline-block'}>
                            <Tooltip title={isEditingCurrentBlock ? 'Save' : 'Edit'}>
                              <Button
                                type="text"
                                size="small"
                                loading={isEditingCurrentBlock && isSavingCurrentBlock}
                                icon={isEditingCurrentBlock ? <SaveOutlined /> : <EditOutlined />}
                                onClick={async () => {
                                  if (!isEditingCurrentBlock) {
                                    editingCodeDraftRef.current[blockKey] = currentCodeContent;
                                    editingCodeOriginalRef.current[blockKey] = currentCodeContent;
                                    setEditingCodeBlocks((prev) => ({ ...prev, [blockKey]: true }));
                                    syncLivePreviewForEditing(editingCodeDraftRef.current[blockKey], true);
                                    return;
                                  }

                                  if (isSavingCurrentBlock) {
                                    return;
                                  }

                                  if (!activeConversationId) {
                                    console.error('activeConversationId is required for save code content');
                                    return;
                                  }

                                  const nextContent = editingCodeDraftRef.current[blockKey] ?? currentCodeContent;
                                  setSavingCodeBlocks((prev) => ({ ...prev, [blockKey]: true }));
                                  try {
                                    await createHtmlPreviewApi({
                                      conversationId: activeConversationId,
                                      turnId: turn.id,
                                      htmlContent: nextContent
                                    });
                                  } catch (error) {
                                    console.error('Failed to persist HTML preview content', error);
                                    message.error('Save failed: backend preview API error');
                                    return;
                                  } finally {
                                    setSavingCodeBlocks((prev) => ({ ...prev, [blockKey]: false }));
                                  }
                                  setConversationState(
                                    prevState => ({
                                      ...prevState,
                                      turns: prevState.turns.map(conversationTurn => {
                                        if (conversationTurn.id !== turn.id) {
                                          return conversationTurn;
                                        }

                                        const turnWithUpdatedCodeBlocks = conversationTurn as typeof conversationTurn & {
                                          editedCodeBlocks?: Record<string, string>;
                                        };
                                        const nextEditedCodeBlocks = { ...(turnWithUpdatedCodeBlocks.editedCodeBlocks ?? {}) };

                                        if (nextContent === codeContent) {
                                          delete nextEditedCodeBlocks[blockKey];
                                        } else {
                                          nextEditedCodeBlocks[blockKey] = nextContent;
                                        }

                                        if (Object.keys(nextEditedCodeBlocks).length === 0) {
                                          return {
                                            ...turnWithUpdatedCodeBlocks,
                                            editedCodeBlocks: undefined
                                          } as typeof conversationTurn;
                                        }

                                        return {
                                          ...turnWithUpdatedCodeBlocks,
                                          editedCodeBlocks: nextEditedCodeBlocks
                                        } as typeof conversationTurn;
                                      })
                                    }),
                                    activeConversationId,
                                    true
                                  );

                                  setEditedCodeBlocks((prev) => {
                                    const nextEditedCodeBlocks = { ...prev };
                                    if (nextContent === codeContent) {
                                      delete nextEditedCodeBlocks[blockKey];
                                    } else {
                                      nextEditedCodeBlocks[blockKey] = nextContent;
                                    }
                                    return nextEditedCodeBlocks;
                                  });

                                  delete editingCodeDraftRef.current[blockKey];
                                  delete editingCodeOriginalRef.current[blockKey];
                                  setEditingCodeBlocks((prev) => ({ ...prev, [blockKey]: false }));
                                }}
                                aria-label={isEditingCurrentBlock ? 'Save' : 'Edit'}
                              />
                            </Tooltip>
                          </div>
                          {isEditingCurrentBlock && (
                            <div className={'inline-block'}>
                              <Tooltip title="Undo">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<RollbackOutlined />}
                                  disabled={isSavingCurrentBlock}
                                  onClick={() => {
                                    const originalCodeContent = editingCodeOriginalRef.current[blockKey] ?? currentCodeContent;
                                    syncLivePreviewForEditing(originalCodeContent);
                                    delete editingCodeDraftRef.current[blockKey];
                                    delete editingCodeOriginalRef.current[blockKey];
                                    setEditingCodeBlocks((prev) => ({ ...prev, [blockKey]: false }));
                                  }}
                                  aria-label="Undo"
                                />
                              </Tooltip>
                            </div>
                          )}
                        </>}
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
                  {isEditingCurrentBlock ? (
                    <CodeEditor
                      language={language}
                      value={editingCodeDraftRef.current[blockKey] ?? currentCodeContent}
                      onChange={(value) => {
                        editingCodeDraftRef.current[blockKey] = value;
                        syncLivePreviewForEditing(value);
                      }}
                    />
                  ) : (
                    <SyntaxHighlighter
                      showLineNumbers
                      style={oneLight}
                      language={language}
                      PreTag={'div'}
                      className={'rounded-lg'}
                      customStyle={{
                        marginTop: 0,
                        marginBottom: '0.5rem',
                        background: '#fff',
                        padding: '1rem',
                        borderRadius: 0,
                        border: '1px solid #e5e5e5'
                      }}
                    >
                      {currentCodeContent}
                    </SyntaxHighlighter>
                  )}
                </div>
              ): (
                <code>
                  {children}
                </code>
              )

              return (
                <pre style={{
                  backgroundColor: '#f6f8fa',
                  padding: '16px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  fontSize: '14px',
                  border: '1px solid #e1e4e8',
                  position: 'relative'
                }}>
                {isHtml && (
                  <div>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => handleHtmlPreview('turn_123', codeContent)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        zIndex: 1,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        border: '1px solid #d9d9d9'
                      }}
                    >Preview</Button>
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => downloadHtmlFile(currentCodeContent)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '70px',
                        zIndex: 1,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        border: '1px solid #d9d9d9'
                      }}
                    >Download</Button>
                  </div>

                )}
                  <code className={className} {...props}>
                  {children}
                </code>
              </pre>
              );
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
