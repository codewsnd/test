import React from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

const ONE_LIGHT_THEME = 'one-light';
let isOneLightThemeRegistered = false;

const defineOneLightTheme = (monaco: Monaco) => {
  if (isOneLightThemeRegistered) {
    return;
  }

  monaco.editor.defineTheme(ONE_LIGHT_THEME, {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '383A42', background: 'FFFFFF' },
      { token: 'comment', foreground: 'A0A1A7', fontStyle: 'italic' },
      { token: 'comment.doc', foreground: 'A0A1A7', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'A626A4' },
      { token: 'keyword.control', foreground: 'A626A4' },
      { token: 'storage', foreground: 'A626A4' },
      { token: 'string', foreground: '50A14F' },
      { token: 'string.escape', foreground: '50A14F' },
      { token: 'number', foreground: '986801' },
      { token: 'number.hex', foreground: '986801' },
      { token: 'constant', foreground: '986801' },
      { token: 'constant.language', foreground: '986801' },
      { token: 'type', foreground: '986801' },
      { token: 'type.identifier', foreground: '986801' },
      { token: 'entity.name.type', foreground: '986801' },
      { token: 'tag', foreground: 'E45649' },
      { token: 'tag.html', foreground: 'E45649' },
      { token: 'entity.name.tag', foreground: 'E45649' },
      { token: 'entity.name.tag.html', foreground: 'E45649' },
      { token: 'attribute.name', foreground: '986801' },
      { token: 'attribute.name.html', foreground: '986801' },
      { token: 'attribute.value', foreground: '50A14F' },
      { token: 'attribute.value.html', foreground: '50A14F' },
      { token: 'string.html', foreground: '50A14F' },
      { token: 'metatag', foreground: 'E45649' },
      { token: 'metatag.html', foreground: '383A42' },
      { token: 'metatag.content', foreground: '50A14F' },
      { token: 'metatag.content.html', foreground: '383A42' },
      { token: 'delimiter', foreground: '383A42' },
      { token: 'delimiter.html', foreground: '383A42' },
      { token: 'delimiter.bracket', foreground: '383A42' },
      { token: 'delimiter.angle', foreground: '383A42' },
      { token: 'punctuation', foreground: '383A42' },
      { token: 'punctuation.definition.tag', foreground: '383A42' },
      { token: 'punctuation.definition.tag.html', foreground: '383A42' },
      { token: 'operator', foreground: '4078F2' },
      { token: 'operator.html', foreground: '383A42' },
      { token: 'keyword.operator', foreground: 'A626A4' },
      { token: 'function', foreground: '4078F2' },
      { token: 'entity.name.function', foreground: '4078F2' },
      { token: 'variable', foreground: '383A42' },
      { token: 'variable.parameter', foreground: '383A42' }
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#383A42',
      'editor.lineHighlightBackground': '#00000000',
      'editorLineNumber.foreground': '#9D9DA0',
      'editorLineNumber.activeForeground': '#383A42',
      'editorCursor.foreground': '#383A42',
      'editor.selectionBackground': '#E5E5E6',
      'editor.inactiveSelectionBackground': '#E5E5E6',
      'editorIndentGuide.background1': '#ECECEE',
      'editorIndentGuide.activeBackground1': '#D4D4D8',
      'editorGutter.background': '#FFFFFF',
      'editorWhitespace.foreground': '#383A4233'
    }
  });

  isOneLightThemeRegistered = true;
};

const monacoLanguageMap: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  yml: 'yaml',
  sh: 'shell',
  bash: 'shell'
};

const normalizeLanguage = (language: string): string => {
  const lowerCaseLanguage = language.toLowerCase();
  return monacoLanguageMap[lowerCaseLanguage] ?? lowerCaseLanguage;
};

const CodeEditor: React.FC<CodeEditorProps> = ({ language, value, onChange, height = 360 }) => {
  const [editorValue, setEditorValue] = React.useState(value);

  React.useEffect(() => {
    setEditorValue(value);
  }, [value, language]);

  const beforeMount = React.useCallback((monaco: Monaco) => {
    defineOneLightTheme(monaco);
  }, []);

  return (
    <div
      style={{
        border: '1px solid #e5e5e5',
        marginBottom: '0.5rem'
      }}
    >
      <Editor
        beforeMount={beforeMount}
        theme={ONE_LIGHT_THEME}
        language={normalizeLanguage(language)}
        value={editorValue}
        height={height}
        onChange={(nextValue) => {
          const safeValue = nextValue ?? '';
          setEditorValue(safeValue);
          onChange(safeValue);
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineHeight: 21,
          fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
          fontLigatures: false,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: 'off',
          tabSize: 2,
          renderLineHighlight: 'none',
          overviewRulerLanes: 0,
          folding: true,
          padding: {
            top: 16,
            bottom: 16
          }
        }}
      />
    </div>
  );
};

export default CodeEditor;
