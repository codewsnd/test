import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyDeckTable from '../CopyDeckTable';

type CellInfo = {
  value: string;
  rowspan: number;
  colspan: number;
  isSpanned: boolean;
  attributes?: Record<string, string>;
};

const mockEnv = vi.hoisted(() => {
  const atomKeys = {
    confluenceInfo: 'confluenceInfo',
    renderTableData: 'renderTableData',
    originalTableData: 'originalTableData',
    valuesArray: 'valuesArray',
    currentView: 'currentView',
    selectedLanguage: 'selectedLanguage',
    showUncompared: 'showUncompared',
    selectedRows: 'selectedRows',
    hideSidebar: 'hideSidebar',
    groupTableData: 'groupTableData',
    storageHtml: 'storageHtml',
    expandFailedPanels: 'expandFailedPanels',
  };

  const h = (type: unknown, props: Record<string, unknown> | null = null, ...children: unknown[]) => {
    const sourceProps = props || {};
    const { key, ref, ...restProps } = sourceProps;
    const elementProps: Record<string, unknown> = { ...restProps };
    if (children.length === 1) {
      elementProps.children = children[0];
    }
    if (children.length > 1) {
      elementProps.children = children;
    }

    return {
      $$typeof: Symbol.for('react.element'),
      type,
      key: key == null ? null : String(key),
      ref: ref ?? null,
      props: elementProps,
      _owner: null,
    };
  };

  return {
    atomKeys,
    atomState: new Map<string, unknown>(),
    h,
    confirm: vi.fn(),
    message: {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    },
    uploadStorageApi: vi.fn(),
    languageCompareApi: vi.fn(),
    extractComparisonData: vi.fn(),
    applyComparisonResults: vi.fn(),
    updateCopyColumnFailedMarkersInConfluence: vi.fn(),
    extractOriginalTestColumns: vi.fn(),
    processLanguageForExistingColumns: vi.fn(),
    processLanguageForNewColumns: vi.fn(),
  };
});

vi.mock('antd', () => {
  const getRecordKey = (rowKey: unknown, record: Record<string, unknown>) => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    if (typeof rowKey === 'string') {
      return record[rowKey];
    }
    return record.key;
  };

  const IconSlot = ({ children }: { children?: unknown }) => mockEnv.h('span', { 'aria-hidden': 'true' }, children);

  const Button = ({ children, icon, onClick, disabled, loading }: Record<string, unknown>) =>
    mockEnv.h(
      'button',
      {
        type: 'button',
        onClick,
        'data-disabled': disabled ? 'true' : 'false',
        'data-loading': loading ? 'true' : 'false',
      },
      icon,
      children
    );

  const Checkbox = ({ children, checked, onChange }: Record<string, unknown>) =>
    mockEnv.h(
      'label',
      null,
      mockEnv.h('input', {
        type: 'checkbox',
        checked,
        onChange: (event: { currentTarget: { checked: boolean } }) => {
          if (typeof onChange === 'function') {
            onChange({ target: { checked: event.currentTarget.checked } });
          }
        },
      }),
      children
    );

  const Tabs = ({ activeKey, items, onChange }: Record<string, unknown>) => {
    const tabItems = Array.isArray(items) ? items : [];
    return mockEnv.h(
      'div',
      { 'data-active-key': activeKey, 'data-testid': 'mock-tabs' },
      tabItems.map((item: Record<string, string>) =>
        mockEnv.h(
          'button',
          {
            key: item.key,
            type: 'button',
            onClick: () => {
              if (typeof onChange === 'function') {
                onChange(item.key);
              }
            },
          },
          item.label
        )
      )
    );
  };

  const Table = ({ columns, dataSource, rowSelection, rowKey }: Record<string, unknown>) => {
    const tableColumns = Array.isArray(columns) ? columns : [];
    const rows = Array.isArray(dataSource) ? dataSource : [];
    const selection = rowSelection as { selectedRowKeys?: unknown[]; onChange?: (keys: unknown[]) => void } | undefined;
    const selectedKeys = selection?.selectedRowKeys || [];
    const allKeys = rows.map((record) => getRecordKey(rowKey, record as Record<string, unknown>));
    const groupLabel = String((rows[0] as { customGroup?: string; customId?: string } | undefined)?.customGroup || allKeys[0] || 'empty');

    const renderedRows = rows.map((record, rowIndex) => {
      const typedRecord = record as Record<string, unknown>;
      const key = getRecordKey(rowKey, typedRecord);
      const cells = tableColumns.map((column, columnIndex) => {
        const typedColumn = column as {
          key?: string;
          dataIndex?: string;
          render?: (text: unknown, record: Record<string, unknown>, index: number) => unknown;
          onCell?: (record: Record<string, unknown>) => { rowSpan?: number };
        };
        const cellProps = typedColumn.onCell ? typedColumn.onCell(typedRecord) : {};
        const text = typedColumn.dataIndex ? typedRecord[typedColumn.dataIndex] : undefined;
        const content = typedColumn.render ? typedColumn.render(text, typedRecord, rowIndex) : text;
        return mockEnv.h(
          'div',
          {
            key: `cell-${String(typedColumn.key || columnIndex)}`,
            'data-rowspan': cellProps.rowSpan ?? '',
          },
          content
        );
      });

      return mockEnv.h(
        'div',
        { key: String(key), 'data-testid': `row-${String(key)}` },
        mockEnv.h('input', {
          'aria-label': `select ${String(key)}`,
          checked: selectedKeys.includes(key),
          type: 'checkbox',
          onChange: (event: { currentTarget: { checked: boolean } }) => {
            const nextKeys = event.currentTarget.checked
              ? [...selectedKeys, key]
              : selectedKeys.filter((item) => item !== key);
            selection?.onChange?.(nextKeys);
          },
        }),
        cells
      );
    });

    return mockEnv.h(
      'section',
      { 'data-testid': 'mock-table' },
      mockEnv.h(
        'button',
        {
          type: 'button',
          onClick: () => {
            selection?.onChange?.(allKeys);
          },
        },
        `select-${groupLabel}`
      ),
      renderedRows
    );
  };

  return {
    Typography: {
      Title: ({ children }: { children?: unknown }) => mockEnv.h('h5', null, children),
      Text: ({ children }: { children?: unknown }) => mockEnv.h('span', null, children),
    },
    Button,
    Checkbox,
    ConfigProvider: ({ children }: { children?: unknown }) => mockEnv.h('div', null, children),
    Modal: { confirm: mockEnv.confirm },
    Table,
    Tabs,
    Tooltip: ({ children, title }: { children?: unknown; title?: string }) => mockEnv.h('span', { title }, children),
    message: mockEnv.message,
    IconSlot,
  };
});

vi.mock('@ant-design/icons', () => ({
  EditOutlined: () => mockEnv.h('span', null, 'edit'),
  QuestionCircleOutlined: () => mockEnv.h('span', null, '?'),
  UploadOutlined: () => mockEnv.h('span', null, 'upload'),
}));

vi.mock('ahooks', () => ({
  useRequest: (service: () => unknown, options?: { onSuccess?: (value: unknown) => void; onError?: (error: Error) => void }) => ({
    loading: false,
    run: () => {
      try {
        const value = service();
        options?.onSuccess?.(value);
        return value;
      } catch (error) {
        options?.onError?.(error as Error);
        return undefined;
      }
    },
  }),
}));

vi.mock('jotai', () => ({
  useAtom: (atomKey: string) => {
    const setAtom = (nextValue: unknown) => {
      const currentValue = mockEnv.atomState.get(atomKey);
      const value = typeof nextValue === 'function'
        ? (nextValue as (previous: unknown) => unknown)(currentValue)
        : nextValue;
      mockEnv.atomState.set(atomKey, value);
    };
    return [mockEnv.atomState.get(atomKey), setAtom];
  },
}));

vi.mock('../copyDeckAtom', () => {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '');

  const findHeaderIndex = (
    headerRow: Array<{ value: string }>,
    predicate: (value: string) => boolean
  ) => headerRow.findIndex((cell) => predicate(cell.value));

  const parseEvidenceData = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      void error;
      return [];
    }
  };

  const parseResultJSON = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return {
          PASS: parsed.filter((item) => item.passed).map((item) => ({ filename: item.fileName, displayName: item.displayName })),
          FAILED: parsed.filter((item) => !item.passed).map((item) => ({ filename: item.fileName, displayName: item.displayName })),
        };
      }
      if (parsed && typeof parsed === 'object') {
        return {
          PASS: parsed.PASS || [],
          FAILED: parsed.FAILED || [],
        };
      }
    } catch (error) {
      void error;
    }
    return { PASS: [], FAILED: [] };
  };

  const updateCellData = (tableData: CellInfo[][], rowIndex: number, columnIndex: number, value: string) =>
    tableData.map((row, currentRowIndex) =>
      currentRowIndex === rowIndex
        ? row.map((cell, currentColumnIndex) => (currentColumnIndex === columnIndex ? { ...cell, value } : cell))
        : row
    );

  return {
    copyDeckConfluenceInfoAtom: mockEnv.atomKeys.confluenceInfo,
    copyDeckCurrentViewAtom: mockEnv.atomKeys.currentView,
    copyDeckExpandFailedPanelsAtom: mockEnv.atomKeys.expandFailedPanels,
    copyDeckGroupTableDataAtom: mockEnv.atomKeys.groupTableData,
    copyDeckOriginalTableDataAtom: mockEnv.atomKeys.originalTableData,
    copyDeckRenderTableDataAtom: mockEnv.atomKeys.renderTableData,
    copyDeckSelectedLanguageAtom: mockEnv.atomKeys.selectedLanguage,
    copyDeckSelectedRowsAtom: mockEnv.atomKeys.selectedRows,
    copyDeckShowUncomparedAtom: mockEnv.atomKeys.showUncompared,
    copyDeckStorageHtmlAtom: mockEnv.atomKeys.storageHtml,
    copyDeckValuesArrayAtom: mockEnv.atomKeys.valuesArray,
    hideCopyDeckSidebarAtom: mockEnv.atomKeys.hideSidebar,
    getColumnIndexes: (headerRow: Array<{ value: string }>, language: string) => ({
      customId: findHeaderIndex(headerRow, (value) => value.includes('COPYDECK_CUSTOM_ID')),
      customGroup: findHeaderIndex(headerRow, (value) => value.includes('COPYDECK_CUSTOM_GROUP')),
      copy: findHeaderIndex(headerRow, (value) => {
        const normalized = normalize(value);
        return normalized.includes(`|values=${language.toLowerCase()}|`) &&
          !normalized.includes('testresult') &&
          !normalized.includes('evidence') &&
          !normalized.includes('copydeck_custom');
      }),
      result: findHeaderIndex(headerRow, (value) => normalize(value).includes(`testresult|values=${language.toLowerCase()}|`)),
      evidence: findHeaderIndex(headerRow, (value) => normalize(value).includes(`testevidence|values=${language.toLowerCase()}|`) ||
        normalize(value).includes(`testevidence|values=${language.toLowerCase()}|`)),
    }),
    getRowIndexByCustomId: (tableData: CellInfo[][], customId: string) =>
      tableData.findIndex((row, index) => index > 0 && row[0]?.value === customId),
    parseEvidenceData,
    parseResultJSON,
    updateCellData,
    updateResultJSON: (
      resultJSON: { PASS: Array<{ filename: string }>; FAILED: Array<{ filename: string }> },
      operation: string,
      imageData: { filename: string }
    ) => {
      void operation;
      return {
        PASS: resultJSON.PASS.filter((item) => item.filename !== imageData.filename),
        FAILED: resultJSON.FAILED.filter((item) => item.filename !== imageData.filename),
      };
    },
  };
});

vi.mock('../utils/confluenceStorageUtils', () => {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '');
  const textFragment = (value: string, doc: Document) => {
    const fragment = doc.createDocumentFragment();
    fragment.appendChild(doc.createTextNode(value));
    return fragment;
  };

  return {
    extractOriginalTestColumns: (...args: unknown[]) => mockEnv.extractOriginalTestColumns(...args),
    fixVoidElements: (html: string) => html,
    formatTestEvidence: (value: string, doc: Document) => textFragment(`evidence:${value}`, doc),
    formatTestResultToHtml: (value: string, doc: Document) => textFragment(`result:${value}`, doc),
    isTestEvidenceColumn: (value: string) => normalize(value).includes('testevidence') || normalize(value).includes('test evidence'),
    isTestResultColumn: (value: string) => normalize(value).includes('testresult'),
    replaceTableInStorage: (storageHtml: string, _tableIndex: number, tableHtml: string) =>
      storageHtml.replace(/<table[\s\S]*<\/table>/, tableHtml),
  };
});

vi.mock('../utils/exportUtils', () => {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '');
  const findResultColumnIndex = (headerRow: CellInfo[], language: string) =>
    headerRow.findIndex((cell) => normalize(cell.value).includes(`testresult|values=${language.toLowerCase()}|`));
  const findEvidenceColumnIndex = (headerRow: CellInfo[], language: string) =>
    headerRow.findIndex((cell) => normalize(cell.value).includes(`testevidence|values=${language.toLowerCase()}|`) ||
      normalize(cell.value).includes(`testevidence|values=${language.toLowerCase()}|`));
  const makeCell = (value: string): CellInfo => ({
    value,
    rowspan: 1,
    colspan: 1,
    isSpanned: false,
  });

  return {
    findEvidenceColumnIndex,
    findResultColumnIndex,
    processLanguageForExistingColumns: (...args: unknown[]) => mockEnv.processLanguageForExistingColumns(...args),
    processLanguageForNewColumns: (
      language: string,
      isSingleTableMode: boolean,
      updatedOriginalTableData: CellInfo[][]
    ) => {
      mockEnv.processLanguageForNewColumns(language, isSingleTableMode, updatedOriginalTableData);
      updatedOriginalTableData[0].push(makeCell(`Test Result|values=${language}|`), makeCell(`Test Evidence|values=${language}|`));
      updatedOriginalTableData.slice(1).forEach((row) => {
        row.push(makeCell(''), makeCell(''));
      });
    },
  };
});

vi.mock('../utils/compareLanguage', () => ({
  applyComparisonResults: (...args: unknown[]) => mockEnv.applyComparisonResults(...args),
  extractComparisonData: (...args: unknown[]) => mockEnv.extractComparisonData(...args),
  updateCopyColumnFailedMarkersInConfluence: (...args: unknown[]) => mockEnv.updateCopyColumnFailedMarkersInConfluence(...args),
}));

vi.mock('@/api/tool/copyDeckApi', () => ({
  languageCompareApi: (...args: unknown[]) => mockEnv.languageCompareApi(...args),
  uploadStorageApi: (...args: unknown[]) => mockEnv.uploadStorageApi(...args),
}));

vi.mock('@/utils/languageUtils', () => ({
  getLanguageDisplayName: (code: string) => `Language ${code}`,
}));

vi.mock('../UploadScreenshotsModal', () => ({
  default: ({ visible, onClose, initialFiles }: { visible: boolean; onClose: () => void; initialFiles?: File[] }) => {
    if (!visible) {
      return null;
    }
    return mockEnv.h(
      'div',
      { 'data-testid': 'upload-modal' },
      `files:${initialFiles?.length || 0}`,
      mockEnv.h('button', { type: 'button', onClick: onClose }, 'close-upload')
    );
  },
}));

vi.mock('../TestEvidenceRenderer', () => ({
  TestEvidenceRenderer: ({ text, onDeleteImage }: { text: string; onDeleteImage?: (index: number) => void }) =>
    mockEnv.h(
      'button',
      {
        type: 'button',
        onClick: () => {
          onDeleteImage?.(0);
        },
      },
      `evidence:${text || 'empty'}`
    ),
}));

vi.mock('../CheckResultRenderer', () => ({
  CheckResultRenderer: ({ text, evidenceData, customId }: { text: string; evidenceData?: string; customId: string }) =>
    mockEnv.h('span', null, `check:${customId}:${text}:${evidenceData || ''}`),
}));

vi.mock('../CopyValueRenderer', () => ({
  CopyValueRenderer: ({ text, customId, groupName }: { text: string; customId: string; groupName: string }) =>
    mockEnv.h('span', null, `copy:${groupName}:${customId}:${text}`),
}));

const cell = (value: string, overrides: Partial<CellInfo> = {}): CellInfo => ({
  value,
  rowspan: 1,
  colspan: 1,
  isSpanned: false,
  ...overrides,
});

const images = [
  { fileName: 'screen-one.png', base64: 'data:image/png;base64,one', displayName: 'Screen One' },
  { fileName: 'screen-two.png', base64: 'data:image/png;base64,two', displayName: 'Screen Two' },
];

const evidenceText = JSON.stringify(images);
const resultText = JSON.stringify([
  { fileName: 'screen-one.png', passed: false, discrepancies: [{ expected: 'hello', found: 'bonjour' }] },
  { fileName: 'screen-two.png', passed: true },
]);
const legacyResultText = JSON.stringify({
  PASS: [{ filename: 'screen-one.png', displayName: 'Screen One' }],
  FAILED: [{ filename: 'screen-two.png', displayName: 'Screen Two' }],
});

const buildTableData = (): CellInfo[][] => [
  [
    cell('COPYDECK_CUSTOM_ID'),
    cell('COPYDECK_CUSTOM_GROUP'),
    cell('Copy|values=fr|'),
    cell('Test Result|values=fr|', { attributes: { 'data-header': 'result' } }),
    cell('Test Evidence|values=fr|', { attributes: { 'data-header': 'evidence' } }),
    cell('Copy|values=gl|'),
  ],
  [
    cell('row-1'),
    cell('Group A'),
    cell('Bonjour'),
    cell(resultText, { attributes: { 'data-cell': 'result-one' } }),
    cell(evidenceText, { rowspan: 2, attributes: { 'data-cell': 'evidence-one' } }),
    cell('Hello'),
  ],
  [
    cell('row-2'),
    cell('Group A'),
    cell('Salut'),
    cell(legacyResultText),
    cell(evidenceText, { isSpanned: true, rowspan: 0, colspan: 0 }),
    cell('Hi'),
  ],
  [
    cell('row-3'),
    cell(''),
    cell('Au revoir'),
    cell('Plain result'),
    cell(''),
    cell('Bye'),
  ],
];

const buildGroups = () => [
  [
    {
      customId: 'row-1',
      customGroup: 'Group A',
      copy: 'Bonjour',
      result: resultText,
      evidence: evidenceText,
      evidenceCell: cell(evidenceText, { rowspan: 2 }),
    },
    {
      customId: 'row-2',
      customGroup: 'Group A',
      copy: 'Salut',
      result: legacyResultText,
      evidence: evidenceText,
      evidenceCell: cell(evidenceText, { isSpanned: true, rowspan: 0, colspan: 0 }),
    },
  ],
  [
    {
      customId: 'row-3',
      customGroup: '',
      copy: 'Au revoir',
      result: 'Plain result',
      evidence: '',
      evidenceCell: cell(''),
    },
  ],
];

const storageHtml = `
  <main>
    <table>
      <thead>
        <tr>
          <th>COPYDECK_CUSTOM_ID</th>
          <th>Copy|values=fr|</th>
          <th>Test Result|values=fr|</th>
          <th>Test Evidence|values=fr|</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>row-1</td><td>Bonjour</td><td>old</td><td>old evidence</td></tr>
        <tr><td>row-2</td><td>Salut</td><td>old</td><td>old evidence</td></tr>
        <tr><td>row-3</td><td>Au revoir</td><td>old</td><td>old evidence</td></tr>
        <tr><td>row-4</td><td>Extra</td><td>old</td><td>old evidence</td></tr>
      </tbody>
    </table>
  </main>
`;

const seedAtoms = (overrides: Record<string, unknown> = {}) => {
  const keys = mockEnv.atomKeys;
  mockEnv.atomState.clear();
  mockEnv.atomState.set(keys.confluenceInfo, {
    confluenceTitle: 'Copy Deck Page',
    confluenceUrl: 'https://example.test/wiki',
    tableIndex: 0,
    tableName: 'Main table',
  });
  mockEnv.atomState.set(keys.currentView, 'table');
  mockEnv.atomState.set(keys.expandFailedPanels, { expanded: false, version: 0 });
  mockEnv.atomState.set(keys.groupTableData, buildGroups());
  mockEnv.atomState.set(keys.originalTableData, buildTableData());
  mockEnv.atomState.set(keys.renderTableData, buildTableData());
  mockEnv.atomState.set(keys.selectedLanguage, 'fr');
  mockEnv.atomState.set(keys.selectedRows, [
    { customId: 'row-1', language: 'fr', groupName: 'Group A' },
    { customId: 'row-2', language: 'de', groupName: 'Group A' },
  ]);
  mockEnv.atomState.set(keys.showUncompared, false);
  mockEnv.atomState.set(keys.storageHtml, storageHtml);
  mockEnv.atomState.set(keys.valuesArray, ['fr', 'gl']);
  Object.entries(overrides).forEach(([key, value]) => {
    mockEnv.atomState.set(key, value);
  });
};

const renderSubject = () => render(<CopyDeckTable />);

const runLastConfirmOk = () => {
  const calls = mockEnv.confirm.mock.calls;
  const lastCall = calls[calls.length - 1]?.[0] as { onOk?: () => void } | undefined;
  lastCall?.onOk?.();
};

describe('CopyDeckTable', () => {
  beforeEach(() => {
    seedAtoms();
    mockEnv.confirm.mockReset();
    mockEnv.message.success.mockReset();
    mockEnv.message.warning.mockReset();
    mockEnv.message.error.mockReset();
    mockEnv.uploadStorageApi.mockReset();
    mockEnv.languageCompareApi.mockReset();
    mockEnv.extractComparisonData.mockReset();
    mockEnv.applyComparisonResults.mockReset();
    mockEnv.updateCopyColumnFailedMarkersInConfluence.mockReset();
    mockEnv.extractOriginalTestColumns.mockReset();
    mockEnv.processLanguageForExistingColumns.mockReset();
    mockEnv.processLanguageForNewColumns.mockReset();

    mockEnv.uploadStorageApi.mockReturnValue({ ok: true });
    mockEnv.languageCompareApi.mockReturnValue({ differences: [] });
    mockEnv.extractComparisonData.mockReturnValue({
      comparisonData: [{ customId: 'row-1', reference: 'Hello', target: 'Bonjour' }],
      referenceLanguageCode: 'gl',
      targetLanguageCode: 'fr',
    });
    mockEnv.applyComparisonResults.mockImplementation((tableData) => tableData);
    mockEnv.extractOriginalTestColumns.mockReturnValue([{ language: 'fr', hasResult: true, hasEvidence: true }]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders table controls and updates synchronous view state', () => {
    renderSubject();

    expect(screen.getByText('Copy validation')).toBeTruthy();
    expect(screen.getByText('Copy Deck Page')).toBeTruthy();
    expect(screen.getByText('Group A')).toBeTruthy();
    expect(screen.getByText('2 items selected')).toBeTruthy();

    fireEvent.click(screen.getByText('Language gl'));
    expect(mockEnv.atomState.get(mockEnv.atomKeys.selectedLanguage)).toBe('gl');

    fireEvent.click(screen.getByLabelText('Show un-compared items'));
    expect(mockEnv.atomState.get(mockEnv.atomKeys.showUncompared)).toBe(true);

    fireEvent.click(screen.getByText('select-Group A'));
    expect(mockEnv.atomState.get(mockEnv.atomKeys.selectedRows)).toEqual([
      { customId: 'row-2', language: 'de', groupName: 'Group A' },
      { customId: 'row-1', language: 'fr', groupName: 'Group A' },
      { customId: 'row-2', language: 'fr', groupName: 'Group A' },
    ]);

    fireEvent.click(screen.getByText('Expand all'));
    expect(mockEnv.atomState.get(mockEnv.atomKeys.expandFailedPanels)).toEqual({ expanded: true, version: 1 });

    fireEvent.click(screen.getByText('Collapse all'));
    expect(mockEnv.atomState.get(mockEnv.atomKeys.expandFailedPanels)).toEqual({ expanded: false, version: 2 });
  });

  it('resets table data from edit and cancel confirmations', () => {
    renderSubject();

    fireEvent.click(screen.getByText('Edit'));
    runLastConfirmOk();

    expect(mockEnv.atomState.get(mockEnv.atomKeys.renderTableData)).toEqual([]);
    expect(mockEnv.atomState.get(mockEnv.atomKeys.originalTableData)).toEqual([]);
    expect(mockEnv.atomState.get(mockEnv.atomKeys.storageHtml)).toBe('');
    expect(mockEnv.atomState.get(mockEnv.atomKeys.currentView)).toBe('input');

    cleanup();
    seedAtoms();
    renderSubject();

    fireEvent.click(screen.getByText('Cancel'));
    runLastConfirmOk();

    expect(mockEnv.atomState.get(mockEnv.atomKeys.selectedRows)).toEqual([]);
    expect(mockEnv.atomState.get(mockEnv.atomKeys.showUncompared)).toBe(false);
  });

  it('opens upload modal from a file input change and closes it', () => {
    renderSubject();

    fireEvent.click(screen.getByText('Upload screenshot'));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image'], 'shot.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByTestId('upload-modal').textContent).toContain('files:1');

    fireEvent.click(screen.getByText('close-upload'));
    expect(screen.queryByTestId('upload-modal')).toBeNull();
  });

  it('confirms export and converts selected rows into storage html', () => {
    renderSubject();

    fireEvent.click(screen.getByText('Export'));
    runLastConfirmOk();

    expect(mockEnv.extractOriginalTestColumns).toHaveBeenCalledWith(storageHtml, 'Main table');
    expect(mockEnv.processLanguageForExistingColumns).toHaveBeenCalled();
    expect(mockEnv.processLanguageForNewColumns).toHaveBeenCalledWith('de', false, expect.any(Array));
    expect(mockEnv.updateCopyColumnFailedMarkersInConfluence).toHaveBeenCalled();
    expect(mockEnv.uploadStorageApi).toHaveBeenCalledWith(expect.objectContaining({
      confluenceUrl: 'https://example.test/wiki',
      images: [{ fileName: 'screen-one.png', base64: 'data:image/png;base64,one' }, { fileName: 'screen-two.png', base64: 'data:image/png;base64,two' }],
    }));
  });

  it('shows an export warning when no rows are selected', () => {
    seedAtoms({ [mockEnv.atomKeys.selectedRows]: [] });
    renderSubject();

    fireEvent.click(screen.getByText('Export'));

    expect(mockEnv.message.warning).toHaveBeenCalledWith('Please select rows to export first');
    expect(mockEnv.confirm).not.toHaveBeenCalled();
  });

  it('updates evidence and result data when deleting an image', () => {
    renderSubject();

    fireEvent.click(screen.getAllByText(/^evidence:/)[0]);
    runLastConfirmOk();

    const updatedTableData = mockEnv.atomState.get(mockEnv.atomKeys.renderTableData) as CellInfo[][];
    expect(JSON.parse(updatedTableData[1][4].value)).toEqual([images[1]]);
    expect(JSON.parse(updatedTableData[1][3].value)).toEqual([{ fileName: 'screen-two.png', passed: true }]);
    expect(JSON.parse(updatedTableData[2][3].value)).toEqual({
      PASS: [],
      FAILED: [{ filename: 'screen-two.png', displayName: 'Screen Two' }],
    });
  });

  it('updates a merged evidence group when deleting from a spanned row', () => {
    renderSubject();

    fireEvent.click(screen.getAllByText(/^evidence:/)[1]);
    runLastConfirmOk();

    const updatedTableData = mockEnv.atomState.get(mockEnv.atomKeys.renderTableData) as CellInfo[][];
    expect(JSON.parse(updatedTableData[2][4].value)).toEqual([images[1]]);
    expect(JSON.parse(updatedTableData[1][3].value)).toEqual([{ fileName: 'screen-two.png', passed: true }]);
  });

  it('handles compare guard branches and synchronous service errors', () => {
    mockEnv.extractComparisonData.mockReturnValueOnce({
      comparisonData: [{ customId: 'row-1' }],
      referenceLanguageCode: null,
      targetLanguageCode: 'fr',
    });
    renderSubject();

    fireEvent.click(screen.getByText('Check definition'));
    expect(mockEnv.message.error).toHaveBeenCalledWith('Reference language (gl or en) not found');

    cleanup();
    seedAtoms();
    mockEnv.extractComparisonData.mockReturnValueOnce({
      comparisonData: [],
      referenceLanguageCode: 'gl',
      targetLanguageCode: 'fr',
    });
    renderSubject();

    fireEvent.click(screen.getByText('Check definition'));
    expect(mockEnv.message.warning).toHaveBeenCalledWith('No data to compare');

    cleanup();
    seedAtoms();
    mockEnv.extractComparisonData.mockReturnValue({
      comparisonData: [{ customId: 'row-1' }],
      referenceLanguageCode: 'gl',
      targetLanguageCode: 'fr',
    });
    mockEnv.languageCompareApi.mockImplementation(() => {
      throw new Error('compare failed');
    });
    renderSubject();

    fireEvent.click(screen.getByText('Check definition'));
    expect(mockEnv.message.error).toHaveBeenCalledWith('Comparison failed, please try again');
    expect(mockEnv.atomState.get(mockEnv.atomKeys.expandFailedPanels)).toEqual({ expanded: false, version: 1 });
  });

  it('starts a comparison request with differences', () => {
    mockEnv.languageCompareApi.mockReturnValue({
      differences: [{ customId: 'row-1', issues: [{ type: 'semantic', reason: 'Different meaning' }] }],
    });
    renderSubject();

    fireEvent.click(screen.getByText('Check definition'));

    expect(mockEnv.languageCompareApi).toHaveBeenCalledWith({
      referenceLanguage: 'gl',
      selectedLanguage: 'fr',
      comparisonData: [{ customId: 'row-1', reference: 'Hello', target: 'Bonjour' }],
    });
  });
});
