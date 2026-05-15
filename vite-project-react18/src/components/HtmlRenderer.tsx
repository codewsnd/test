import React from 'react';
import { Button, message, Tooltip } from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  RollbackOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { useAtom, useSetAtom } from 'jotai';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneLight from 'react-syntax-highlighter/dist/cjs/styles/prism/one-light';

import { createHtmlPreviewApi } from '@/api/conversationHtmlPreviewApi';
import CodeEditor from '@/components/editor/CodeEditor';
import {
  htmlPreviewContentAtom,
  htmlPreviewLiveModeAtom,
  htmlPreviewSidebarVisibleAtom,
  htmlPreviewTurnIdAtom,
  showHtmlPreviewSidebarAtom
} from '@/components/htmlPreview/htmlPreviewAtom';
import {
  activeConversationIdAtom,
  setConversationStateAtom
} from '@/pages/home/components/conversationHistory/conversationHistoryAtom';
import type { ConversationTurn } from '@/pages/home/components/chat/types';
import { downloadHtmlFile } from '@/utils/downloadUtils';

interface HtmlRendererProps {
  blockKey: string;
  codeContent: string;
  language: string;
  turn: ConversationTurn;
}

const STREAMING_COLLAPSED_LINE_COUNT = 10;
const HTML_FORMATTER_PROTECTED_BLOCK_PATTERN = /<(script|style|pre|textarea)\b[\s\S]*?<\/\1>/gi;
const HTML_FORMATTER_PLACEHOLDER_PREFIX = '___HTML_FORMATTER_BLOCK_';
const HTML_FORMATTER_PLACEHOLDER_PATTERN = /___HTML_FORMATTER_BLOCK_(\d+)___/g;
const HTML_DOCUMENT_PATTERN = /(?:<!doctype\s+html|<html[\s>])/i;
const COMPLETE_HTML_TAG_PATTERN = /^<[a-z][\w:-]*(?:\s|>|\/>)[\s\S]*<\/[a-z][\w:-]*>\s*$/i;
const HTML_INDENT = '  ';
const HTML_VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

const isHtmlCodeContent = (value: string) => {
  const trimmedValue = value.trim();
  return HTML_DOCUMENT_PATTERN.test(trimmedValue) || COMPLETE_HTML_TAG_PATTERN.test(trimmedValue);
};

const isHtmlLanguage = (language: string) =>
  ['html', 'htm', 'xhtml'].includes(language.toLowerCase());

const hasExistingHtmlIndentation = (value: string) => /\n[ \t]+\S/.test(value);

const getHtmlLineTagName = (line: string) =>
  /^<\/?([a-z][\w:-]*)\b/i.exec(line)?.[1]?.toLowerCase();

const isSingleLineHtmlElement = (line: string, tagName: string) =>
  new RegExp(`^<${tagName}\\b[\\s\\S]*<\\/${tagName}>\\s*$`, 'i').test(line);

const restoreProtectedHtmlBlocks = (value: string, protectedBlocks: string[]) =>
  value.replace(HTML_FORMATTER_PLACEHOLDER_PATTERN, (_, blockIndex: string) =>
    protectedBlocks[Number(blockIndex)] ?? ''
  );

const formatHtmlCodeForDisplay = (value: string, language: string) => {
  if (!isHtmlLanguage(language) || hasExistingHtmlIndentation(value) || !isHtmlCodeContent(value)) {
    return value;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return value;
  }

  const protectedBlocks: string[] = [];
  const valueWithPlaceholders = trimmedValue.replace(
    HTML_FORMATTER_PROTECTED_BLOCK_PATTERN,
    (block) => {
      const blockIndex = protectedBlocks.push(block) - 1;
      return `${HTML_FORMATTER_PLACEHOLDER_PREFIX}${blockIndex}___`;
    }
  );

  let indentLevel = 0;
  const formattedValue = valueWithPlaceholders
    .replace(/>\s*</g, '>\n<')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const tagName = getHtmlLineTagName(line);
      const isClosingTag = /^<\//.test(line);
      const isDeclaration = /^<!/.test(line);
      const isSelfClosingTag = /\/>$/.test(line);
      const shouldStayOnCurrentLine =
        !tagName ||
        isDeclaration ||
        isSelfClosingTag ||
        HTML_VOID_TAGS.has(tagName) ||
        isSingleLineHtmlElement(line, tagName);

      if (isClosingTag) {
        indentLevel = Math.max(indentLevel - 1, 0);
      }

      const indent = HTML_INDENT.repeat(indentLevel);
      const restoredLine = restoreProtectedHtmlBlocks(line, protectedBlocks);
      const formattedLine = restoredLine
        .split('\n')
        .map((blockLine) => `${indent}${blockLine}`)
        .join('\n');

      if (!isClosingTag && !shouldStayOnCurrentLine) {
        indentLevel += 1;
      }

      return formattedLine;
    })
    .join('\n');

  return value.endsWith('\n') ? `${formattedValue}\n` : formattedValue;
};

const getLineCount = (value: string) =>
  value ? value.replace(/\n$/, '').split('\n').length : 0;

const getFirstLines = (value: string, lineCount: number) =>
  value.replace(/\n$/, '').split('\n').slice(0, lineCount).join('\n');

const codeBlockStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: '0.5rem',
  background: '#fff',
  padding: '1rem',
  borderRadius: 0,
  border: '1px solid #e5e5e5',
  overflowX: 'auto',
  whiteSpace: 'pre'
};

const renderCodeBlock = (code: string, language: string, customStyle?: React.CSSProperties) => (
  <SyntaxHighlighter
    showLineNumbers
    style={oneLight}
    language={language}
    wrapLongLines={false}
    PreTag="div"
    className="rounded-lg"
    lineProps={{ style: { whiteSpace: 'pre' } }}
    customStyle={{
      ...codeBlockStyle,
      ...customStyle
    }}
  >
    {code}
  </SyntaxHighlighter>
);

const stopScrollPropagation = (event: React.UIEvent | React.WheelEvent | React.TouchEvent) => {
  event.stopPropagation();
};

const HtmlRenderer: React.FC<HtmlRendererProps> = ({
  blockKey,
  codeContent,
  language,
  turn
}) => {
  const [codeExpansionOverride, setCodeExpansionOverride] = React.useState<boolean | null>(null);
  const [isEditingCurrentBlock, setIsEditingCurrentBlock] = React.useState(false);
  const [editedCodeContent, setEditedCodeContent] = React.useState<string | undefined>();
  const [isSavingCurrentBlock, setIsSavingCurrentBlock] = React.useState(false);
  const editingCodeDraftRef = React.useRef<string>();
  const editingCodeOriginalRef = React.useRef<string>();

  const showHtmlPreviewSidebar = useSetAtom(showHtmlPreviewSidebarAtom);
  const setHtmlPreviewTurnId = useSetAtom(htmlPreviewTurnIdAtom);
  const setHtmlPreviewContent = useSetAtom(htmlPreviewContentAtom);
  const setHtmlPreviewLiveMode = useSetAtom(htmlPreviewLiveModeAtom);
  const [isHtmlPreviewSidebarVisible] = useAtom(htmlPreviewSidebarVisibleAtom);
  const [activeConversationId] = useAtom(activeConversationIdAtom);
  const setConversationState = useSetAtom(setConversationStateAtom);

  const turnWithEditedCodeBlocks = turn as ConversationTurn & {
    editedCodeBlocks?: Record<string, string>;
  };
  const savedCodeContent = turnWithEditedCodeBlocks.editedCodeBlocks?.[blockKey];
  const currentCodeContent = editedCodeContent ?? savedCodeContent ?? codeContent;
  const displayCodeContent = formatHtmlCodeForDisplay(currentCodeContent, language);
  const lineCount = getLineCount(displayCodeContent);
  const isAIResponseCompleted = turn.aiResponse.status === 'completed';
  const isAIResponseGenerating =
    turn.aiResponse.status === 'pending' || turn.aiResponse.status === 'streaming';
  const canUseHtmlActions = isAIResponseGenerating || isAIResponseCompleted;
  const areHtmlActionsDisabled = isAIResponseGenerating || isEditingCurrentBlock;
  const canToggleCodeExpansion =
    !isEditingCurrentBlock &&
    canUseHtmlActions &&
    lineCount > STREAMING_COLLAPSED_LINE_COUNT;
  const isCodeExpanded = canToggleCodeExpansion
    ? codeExpansionOverride ?? false
    : true;
  const visibleCodeContent = canToggleCodeExpansion && !isCodeExpanded
    ? getFirstLines(displayCodeContent, STREAMING_COLLAPSED_LINE_COUNT)
    : displayCodeContent;

  React.useEffect(() => {
    setCodeExpansionOverride(null);
  }, [blockKey]);

  const handleHtmlPreview = (content: string) => {
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

  const handleSaveCodeContent = async () => {
    if (isSavingCurrentBlock) {
      return;
    }

    if (!activeConversationId) {
      console.error('activeConversationId is required for save code content');
      return;
    }

    const nextContent = editingCodeDraftRef.current ?? currentCodeContent;
    setIsSavingCurrentBlock(true);

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
      setIsSavingCurrentBlock(false);
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

    setEditedCodeContent(nextContent === codeContent ? undefined : nextContent);
    editingCodeDraftRef.current = undefined;
    editingCodeOriginalRef.current = undefined;
    setIsEditingCurrentBlock(false);
  };

  const handleToggleEdit = () => {
    if (!isEditingCurrentBlock) {
      editingCodeDraftRef.current = currentCodeContent;
      editingCodeOriginalRef.current = currentCodeContent;
      setIsEditingCurrentBlock(true);
      syncLivePreviewForEditing(currentCodeContent, true);
      return;
    }

    void handleSaveCodeContent();
  };

  const handleUndoEdit = () => {
    const originalCodeContent = editingCodeOriginalRef.current ?? currentCodeContent;
    syncLivePreviewForEditing(originalCodeContent);
    editingCodeDraftRef.current = undefined;
    editingCodeOriginalRef.current = undefined;
    setIsEditingCurrentBlock(false);
  };

  return (
    <div className="relative group">
      <div
        style={{
          border: '1px solid #e5e5e5',
          marginBottom: '0.5rem',
          background: '#fff'
        }}
      >
        <div
          className="flex items-center justify-between px-3 h-10 bg-white"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            borderBottom: '1px solid #e5e5e5'
          }}
        >
          <div className="text-sm font-medium">
            <span>Html</span>
            <span style={{ color: '#ccc', marginLeft: '6px' }}>- {lineCount} lines</span>
          </div>
          <div className="flex items-center space-x-2">
            {canUseHtmlActions && (
              <>
                <div className="inline-block">
                  <Tooltip title="Download">
                    <Button
                      type="text"
                      size="small"
                      icon={<DownloadOutlined />}
                      disabled={areHtmlActionsDisabled}
                      onClick={() => downloadHtmlFile(currentCodeContent)}
                      aria-label="Download"
                    />
                  </Tooltip>
                </div>
                <div className="inline-block">
                  <Tooltip title="Preview">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      disabled={areHtmlActionsDisabled}
                      onClick={() => handleHtmlPreview(currentCodeContent)}
                      aria-label="Preview"
                    />
                  </Tooltip>
                </div>
                <div className="inline-block">
                  <Tooltip title={isEditingCurrentBlock ? 'Save' : 'Edit'}>
                    <Button
                      type="text"
                      size="small"
                      loading={isEditingCurrentBlock && isSavingCurrentBlock}
                      icon={isEditingCurrentBlock ? <SaveOutlined /> : <EditOutlined />}
                      disabled={isAIResponseGenerating}
                      onClick={handleToggleEdit}
                      aria-label={isEditingCurrentBlock ? 'Save' : 'Edit'}
                    />
                  </Tooltip>
                </div>
                {isEditingCurrentBlock && (
                  <div className="inline-block">
                    <Tooltip title="Undo">
                      <Button
                        type="text"
                        size="small"
                        icon={<RollbackOutlined />}
                        disabled={isSavingCurrentBlock}
                        onClick={handleUndoEdit}
                        aria-label="Undo"
                      />
                    </Tooltip>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {isEditingCurrentBlock ? (
          <CodeEditor
            language={language}
            value={editingCodeDraftRef.current ?? currentCodeContent}
            onChange={(value) => {
              editingCodeDraftRef.current = value;
              syncLivePreviewForEditing(value);
            }}
          />
        ) : (
          <>
            <div
              onScroll={stopScrollPropagation}
              onTouchMove={stopScrollPropagation}
              onWheel={stopScrollPropagation}
              style={{
                maxHeight: canToggleCodeExpansion && isCodeExpanded ? '360px' : 'none',
                overflow: canToggleCodeExpansion && isCodeExpanded ? 'auto' : 'hidden',
                overscrollBehavior: 'contain'
              }}
            >
              {renderCodeBlock(visibleCodeContent, language, {
                marginBottom: 0,
                border: 0
              })}
            </div>
            {canToggleCodeExpansion && (
              <Button
                type="text"
                block
                onClick={() => setCodeExpansionOverride((prevValue) => !(prevValue ?? false))}
                style={{
                  height: '38px',
                  borderTop: '1px solid #e5e5e5',
                  borderRadius: 0
                }}
              >
                {isCodeExpanded ? 'Show less' : 'Show More'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default HtmlRenderer;
