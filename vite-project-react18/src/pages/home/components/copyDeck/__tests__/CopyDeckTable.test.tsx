import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const hoisted = vi.hoisted(() => {
  const atoms = {
    copyDeckConfluenceInfoAtom: Symbol('copyDeckConfluenceInfoAtom'),
    copyDeckRenderTableDataAtom: Symbol('copyDeckRenderTableDataAtom'),
    copyDeckOriginalTableDataAtom: Symbol('copyDeckOriginalTableDataAtom'),
    copyDeckValuesArrayAtom: Symbol('copyDeckValuesArrayAtom'),
    copyDeckCurrentViewAtom: Symbol('copyDeckCurrentViewAtom'),
    copyDeckSelectedLanguageAtom: Symbol('copyDeckSelectedLanguageAtom'),
    copyDeckShowUncomparedAtom: Symbol('copyDeckShowUncomparedAtom'),
    copyDeckSelectedRowsAtom: Symbol('copyDeckSelectedRowsAtom'),
    hideCopyDeckSidebarAtom: Symbol('hideCopyDeckSidebarAtom'),
    copyDeckGroupTableDataAtom: Symbol('copyDeckGroupTableDataAtom'),
    copyDeckStorageHtmlAtom: Symbol('copyDeckStorageHtmlAtom'),
    copyDeckExpandFailedPanelsAtom: Symbol('copyDeckExpandFailedPanelsAtom'),
  };

  const atomStore = new Map<unknown, unknown>();
  const atomListeners = new Map<unknown, Set<(value: unknown) => void>>();
  const atomSetterSpies = new Map<unknown, ReturnType<typeof vi.fn>>();

  const setAtomValue = (atom: unknown, value: unknown) => {
    atomStore.set(atom, value);
    atomListeners.get(atom)?.forEach((listener) => listener(value));
  };

  const getAtomSetter = (atom: unknown) => {
    if (!atomSetterSpies.has(atom)) {
      atomSetterSpies.set(
        atom,
        vi.fn((next: unknown) => {
          const prev = atomStore.get(atom);
          const value = typeof next === 'function' ? (next as (prevValue: unknown) => unknown)(prev) : next;
          setAtomValue(atom, value);
        }),
      );
    }

    return atomSetterSpies.get(atom)!;
  };

  return {
    atoms,
    atomStore,
    atomListeners,
    atomSetterSpies,
    setAtomValue,
    getAtomSetter,
    useRequestMode: {
      current: 'idle' as 'idle' | 'success' | 'error' | 'service-error' | 'service-success' | 'mount-service',
    },
    autoConfirm: { current: true },
    currentResultIndexMode: { current: 'new' as 'new' | 'existing' },
    comparisonPayload: {
      current: {
        comparisonData: [{ customId: 'row-1' }],
        referenceLanguageCode: 'en',
        targetLanguageCode: 'fr',
      },
    },
    uploadStorageApiMock: vi.fn(() => {
      throw new Error('upload failed');
    }),
    languageCompareApiMock: vi.fn(() => {
      throw new Error('compare failed');
    }),
    replaceTableInStorageMock: vi.fn((html: string, tableIndex: number, tableHtml: string) =>
      `${html}<!--${tableIndex}:${tableHtml.length}-->`,
    ),
    extractOriginalTestColumnsMock: vi.fn(() => [
      { language: 'fr', hasResult: true, hasEvidence: true },
      { language: 'es', hasResult: false, hasEvidence: true },
    ]),
    processLanguageForExistingColumnsMock: vi.fn(),
    processLanguageForNewColumnsMock: vi.fn(),
    updateCopyColumnFailedMarkersInConfluenceMock: vi.fn(),
    applyComparisonResultsMock: vi.fn((data) => data),
    extractComparisonDataMock: vi.fn(),
    getLanguageDisplayNameMock: vi.fn((language: string) => language.toUpperCase()),
  };
});

const {
  atoms,
  atomStore,
  atomSetterSpies,
  setAtomValue,
  getAtomSetter,
  useRequestMode,
  autoConfirm,
  currentResultIndexMode,
  comparisonPayload,
  uploadStorageApiMock,
  languageCompareApiMock,
  replaceTableInStorageMock,
  extractOriginalTestColumnsMock,
  processLanguageForExistingColumnsMock,
  processLanguageForNewColumnsMock,
  updateCopyColumnFailedMarkersInConfluenceMock,
  applyComparisonResultsMock,
  extractComparisonDataMock,
  getLanguageDisplayNameMock,
} = hoisted;

const defaultConfluenceInfo = {
  confluenceUrl: 'https://example.com/page',
  tableName: 'CopyDeck',
  confluenceTitle: 'Copy Deck Page',
  tableIndex: 0,
};

const cell = (value: string, extra: Record<string, unknown> = {}) => ({
  value,
  rowspan: 1,
  colspan: 1,
  isSpanned: false,
  attributes: undefined as Record<string, string> | undefined,
  ...extra,
});

const exportHeader = [
  cell('COPYDECK_CUSTOM_ID'),
  cell('Copy|values=fr|'),
  cell('TestResult|values=fr|', { attributes: { 'data-head': 'result-fr' } }),
  cell('Test Evidence|values=fr|', { colspan: 2 }),
  cell('Copy|values=es|'),
  cell('Test Result|values=es|'),
  cell('TestEvidence|values=es|'),
];

const exportRows = [
  [
    cell('row-1'),
    cell('Bonjour'),
    cell('[{"fileName":"img-1.png","passed":false,"discrepancies":["diff"]}]', {
      attributes: { 'data-cell': 'result-1' },
    }),
    cell('[{"fileName":"img-1.png","base64":"abc","displayName":"Image 1"}]', {
      rowspan: 2,
    }),
    cell('Hola'),
    cell('{"PASS":[{"filename":"img-1.png","displayName":"Image 1"}],"FAILED":[]}'),
    cell('not-json'),
  ],
  [
    cell('row-2'),
    cell('Salut'),
    cell('{"PASS":[{"filename":"img-1.png","displayName":"Image 1"}],"FAILED":[]}'),
    cell('[{"fileName":"img-1.png","base64":"abc","displayName":"Image 1"}]', { isSpanned: true }),
    cell('Adios'),
    cell(''),
    cell('', { isSpanned: true }),
  ],
  [
    cell('row-3'),
    cell('Plain copy'),
    cell('plain text'),
    cell(''),
    cell('Vacio'),
    cell(''),
    cell(''),
  ],
];

const exportTableData = [exportHeader, ...exportRows];

const groupTableData = [
  [
    {
      customId: 'row-1',
      customGroup: 'Group A',
      copy: 'Bonjour',
      result: '[{"fileName":"img-1.png","passed":false,"discrepancies":["diff"]}]',
      evidence: '[{"fileName":"img-1.png","base64":"abc","displayName":"Image 1"}]',
      evidenceCell: { rowspan: 2, isSpanned: false },
    },
    {
      customId: 'row-2',
      customGroup: 'Group A',
      copy: 'Salut',
      result: '{"PASS":[{"filename":"img-1.png","displayName":"Image 1"}],"FAILED":[]}',
      evidence: '',
      evidenceCell: { rowspan: 1, isSpanned: true },
    },
  ],
  [
    {
      customId: 'row-3',
      customGroup: '',
      copy: 'Plain copy',
      result: 'plain text',
      evidence: 'not-json',
      evidenceCell: { rowspan: 1, isSpanned: false },
    },
  ],
];

const storageHtml = `
  <html>
    <body>
      <table>
        <thead>
          <tr>
            <th>COPYDECK_CUSTOM_ID</th>
            <th>Copy|values=fr|</th>
            <th>TestResult|values=fr|</th>
            <th>Test Evidence|values=fr|</th>
            <th>Copy|values=es|</th>
            <th>Test Result|values=es|</th>
            <th>TestEvidence|values=es|</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>row-1</td><td>Bonjour</td><td>x</td><td>y</td><td>Hola</td><td>a</td><td>b</td></tr>
          <tr><td>row-2</td><td>Salut</td><td>x</td><td>y</td><td>Adios</td><td>a</td><td>b</td></tr>
          <tr><td>row-3</td><td>Plain copy</td><td>x</td><td>y</td><td>Vacio</td><td>a</td><td>b</td></tr>
          <tr><td>row-4</td><td>Extra</td><td>x</td><td>y</td><td>Extra</td><td>a</td><td>b</td></tr>
        </tbody>
      </table>
    </body>
  </html>
`;

vi.mock('jotai', () => ({
  useAtom: (atom: unknown) => {
    const [value, setValue] = React.useState(hoisted.atomStore.get(atom));

    React.useEffect(() => {
      if (!hoisted.atomListeners.has(atom)) {
        hoisted.atomListeners.set(atom, new Set());
      }
      const listeners = hoisted.atomListeners.get(atom)!;
      listeners.add(setValue);
      return () => {
        listeners.delete(setValue);
      };
    }, [atom]);

    return [value, hoisted.getAtomSetter(atom)] as const;
  },
}));

vi.mock('ahooks', () => ({
  useRequest: (service: () => unknown, options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => {
    if (hoisted.useRequestMode.current === 'mount-service') {
      const result = service() as { catch?: (callback: () => void) => void };
      result?.catch?.(() => {});
    }

    return {
      loading: false,
      run: () => {
      if (hoisted.useRequestMode.current === 'service-error') {
        const result = service() as { catch?: (callback: () => void) => void };
        result?.catch?.(() => {});
        options?.onError?.(new Error('upload failed'));
        return;
      }

      if (hoisted.useRequestMode.current === 'service-success') {
        const result = service() as { then?: (callback: () => void) => void; catch?: (callback: () => void) => void };
        result?.then?.(() => options?.onSuccess?.());
        result?.catch?.(() => {});
        return;
      }

      if (hoisted.useRequestMode.current === 'success') {
        options?.onSuccess?.();
        return;
      }

      if (hoisted.useRequestMode.current === 'error') {
        options?.onError?.(new Error('request failed'));
      }
    },
    };
  },
}));

vi.mock('@/assets/foundComparison.svg', () => ({
  default: 'found-comparison.svg',
}));

vi.mock('./copyDeckTableTheme', () => ({
  copyDeckTableTheme: {},
}));

vi.mock('@/utils/languageUtils', () => ({
  getLanguageDisplayName: hoisted.getLanguageDisplayNameMock,
}));

vi.mock('@/api/tool/copyDeckApi', () => ({
  uploadStorageApi: hoisted.uploadStorageApiMock,
  languageCompareApi: hoisted.languageCompareApiMock,
}));

vi.mock('../utils/compareLanguage', () => ({
  extractComparisonData: (...args: unknown[]) => {
    hoisted.extractComparisonDataMock(...args);
    return hoisted.comparisonPayload.current;
  },
  applyComparisonResults: hoisted.applyComparisonResultsMock,
  updateCopyColumnFailedMarkersInConfluence: hoisted.updateCopyColumnFailedMarkersInConfluenceMock,
}));

vi.mock('../utils/exportUtils', () => ({
  findResultColumnIndex: vi.fn((_headerRow: Array<{ value: string }>, language: string) =>
    hoisted.currentResultIndexMode.current === 'existing' ? (language === 'fr' ? 2 : 5) : -1,
  ),
  findEvidenceColumnIndex: vi.fn((_headerRow: Array<{ value: string }>, language: string) =>
    hoisted.currentResultIndexMode.current === 'existing' ? (language === 'fr' ? 3 : 6) : -1,
  ),
  processLanguageForExistingColumns: hoisted.processLanguageForExistingColumnsMock,
  processLanguageForNewColumns: hoisted.processLanguageForNewColumnsMock,
}));

vi.mock('../utils/confluenceStorageUtils', () => ({
  fixVoidElements: vi.fn((html: string) => html),
  isTestResultColumn: vi.fn((header: string) => header.toLowerCase().includes('testresult') || header.toLowerCase().includes('test result')),
  isTestEvidenceColumn: vi.fn((header: string) => header.toLowerCase().includes('testevidence') || header.toLowerCase().includes('test evidence')),
  formatTestResultToHtml: vi.fn((json: string, doc: Document) => {
    const fragment = doc.createDocumentFragment();
    const span = doc.createElement('span');
    span.textContent = `result:${json}`;
    fragment.appendChild(span);
    return fragment;
  }),
  formatTestEvidence: vi.fn((json: string, doc: Document) => {
    const fragment = doc.createDocumentFragment();
    const span = doc.createElement('span');
    span.textContent = `evidence:${json}`;
    fragment.appendChild(span);
    return fragment;
  }),
  replaceTableInStorage: hoisted.replaceTableInStorageMock,
  extractOriginalTestColumns: hoisted.extractOriginalTestColumnsMock,
}));

vi.mock('../UploadScreenshotsModal', () => ({
  default: ({ visible, onClose, initialFiles }: { visible: boolean; onClose: () => void; initialFiles: File[] }) =>
    visible ? (
      <div data-testid="upload-modal">
        <span>{initialFiles.length}</span>
        <button onClick={onClose}>close-upload</button>
      </div>
    ) : null,
}));

vi.mock('../CopyValueRenderer', () => ({
  CopyValueRenderer: ({ text, customId, groupName }: { text: string; customId: string; groupName: string }) => (
    <div data-testid={`copy-${customId}`}>{`${groupName}:${text}`}</div>
  ),
}));

vi.mock('../CheckResultRenderer', () => ({
  CheckResultRenderer: ({
    text,
    evidenceData,
    customId,
  }: {
    text: string;
    evidenceData: string;
    customId: string;
  }) => <div data-testid={`check-result-${customId}`}>{`${text}|${evidenceData}`}</div>,
}));

vi.mock('../TestEvidenceRenderer', () => ({
  TestEvidenceRenderer: ({
    text,
    onDeleteImage,
  }: {
    text: string;
    onDeleteImage: (imageIndex: number) => void;
  }) => (
    <div>
      <span>{text || 'empty-evidence'}</span>
      <button onClick={() => onDeleteImage(0)}>delete-image</button>
    </div>
  ),
}));

vi.mock('@ant-design/icons', () => ({
  EditOutlined: () => <span aria-hidden="true">edit-icon</span>,
  UploadOutlined: () => <span aria-hidden="true">upload-icon</span>,
  QuestionCircleOutlined: () => <span aria-hidden="true">question-icon</span>,
}));

vi.mock('antd', () => {
  const message = {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  };

  const confirm = vi.fn((config: { onOk?: () => void }) => {
    config.footer?.(null, {
      OkBtn: () => <button>ok-footer</button>,
      CancelBtn: () => <button>cancel-footer</button>,
    });
    if (hoisted.autoConfirm.current) {
      config.onOk?.();
    }
    return {};
  });

  const Button = ({
    children,
    disabled,
    icon,
    loading,
    onClick,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    icon?: React.ReactNode;
    loading?: boolean;
    onClick?: () => void;
  }) => (
    <button
      aria-disabled={disabled ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      data-loading={loading ? 'true' : 'false'}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );

  const Checkbox = ({
    checked,
    children,
    onChange,
  }: {
    checked?: boolean;
    children?: React.ReactNode;
    onChange?: (event: { target: { checked: boolean } }) => void;
  }) => (
    <label>
      <input
        checked={checked}
        type="checkbox"
        onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
      />
      {children}
    </label>
  );

  const Table = ({
    columns,
    dataSource,
    rowKey,
    rowSelection,
  }: {
    columns: Array<{
      key: string;
      dataIndex: string;
      render?: (text: string, record: Record<string, unknown>) => React.ReactNode;
      onCell?: (record: Record<string, unknown>) => { rowSpan?: number };
    }>;
    dataSource: Array<Record<string, unknown>>;
    rowKey: string | ((record: Record<string, unknown>) => React.Key);
    rowSelection?: {
      selectedRowKeys: React.Key[];
      onChange: (selectedKeys: React.Key[]) => void;
    };
  }) => (
    <table data-testid="mock-table">
      <tbody>
        {rowSelection && dataSource.length > 0 ? (
          <tr>
            <td colSpan={columns.length + 1}>
              <button
                aria-label="duplicate-select"
                onClick={() => {
                  const firstRecord = dataSource[0];
                  const firstKey =
                    typeof rowKey === 'function' ? rowKey(firstRecord) : (firstRecord[rowKey] as React.Key);
                  rowSelection.onChange([firstKey, firstKey]);
                }}
              >
                duplicate-select
              </button>
            </td>
          </tr>
        ) : null}
        {dataSource.map((record) => {
          const key = typeof rowKey === 'function' ? rowKey(record) : (record[rowKey] as React.Key);
          return (
            <tr key={String(key)}>
              {rowSelection ? (
                <td>
                  <input
                    aria-label={`select-${key}`}
                    checked={rowSelection.selectedRowKeys.includes(key)}
                    type="checkbox"
                    onChange={(event) => {
                      const nextKeys = event.target.checked
                        ? [...rowSelection.selectedRowKeys, key]
                        : rowSelection.selectedRowKeys.filter((selectedKey) => selectedKey !== key);
                      rowSelection.onChange(nextKeys);
                    }}
                  />
                </td>
              ) : null}
              {columns.map((column) => {
                const cellProps = column.onCell?.(record) || {};
                const content = column.render
                  ? column.render((record[column.dataIndex] as string) || '', record)
                  : (record[column.dataIndex] as React.ReactNode);
                return (
                  <td data-rowspan={cellProps.rowSpan ?? ''} key={column.key}>
                    {content}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const Tabs = ({
    activeKey,
    items,
    onChange,
  }: {
    activeKey: string;
    items: Array<{ key: string; label: string }>;
    onChange: (key: string) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button
          aria-selected={item.key === activeKey}
          key={item.key}
          role="tab"
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  const Text = ({ children }: { children?: React.ReactNode }) => <span>{children}</span>;
  const Title = ({ children }: { children?: React.ReactNode }) => <h5>{children}</h5>;

  return {
    Button,
    Checkbox,
    ConfigProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Modal: { confirm },
    Table,
    Tabs,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Typography: { Text, Title },
    message,
  };
});

vi.mock('../copyDeckAtom', () => {
  const getColumnIndexes = (headerRow: Array<{ value: string }>, language: string) => ({
    customId: headerRow.findIndex((cellInfo) => cellInfo.value === 'COPYDECK_CUSTOM_ID'),
    customGroup: headerRow.findIndex((cellInfo) => cellInfo.value === 'COPYDECK_CUSTOM_GROUP'),
    copy: headerRow.findIndex((cellInfo) => cellInfo.value === `Copy|values=${language}|`),
    result: headerRow.findIndex((cellInfo) => {
      const normalized = cellInfo.value.toLowerCase().replace(/\s+/g, '');
      return normalized === `testresult|values=${language}|`;
    }),
    evidence: headerRow.findIndex((cellInfo) => {
      const normalized = cellInfo.value.toLowerCase().replace(/\s+/g, '');
      return normalized === `testevidence|values=${language}|`;
    }),
  });

  return {
    ...hoisted.atoms,
    getColumnIndexes: vi.fn(getColumnIndexes),
    parseEvidenceData: vi.fn((value: string) => {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }),
    parseResultJSON: vi.fn((value: string) => {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            PASS: parsed.PASS || [],
            FAILED: parsed.FAILED || [],
          };
        }
      } catch {
        return { PASS: [], FAILED: [] };
      }
      return { PASS: [], FAILED: [] };
    }),
    getRowIndexByCustomId: vi.fn((tableData: Array<Array<{ value: string }>>, customId: string) =>
      tableData.findIndex((row, index) => index > 0 && row[0]?.value === customId),
    ),
    updateCellData: vi.fn(
      (
        tableData: Array<Array<{ value: string }>>,
        rowIndex: number,
        columnIndex: number,
        newValue: string,
      ) => {
        const next = tableData.map((row) => row.map((item) => ({ ...item })));
        next[rowIndex][columnIndex] = { ...next[rowIndex][columnIndex], value: newValue };
        return next;
      },
    ),
    updateResultJSON: vi.fn((resultJSON: { PASS: Array<{ filename?: string; displayName?: string }>; FAILED: Array<{ filename?: string; displayName?: string }> }, _operation: string, imageData: { filename?: string; displayName?: string }) => ({
      PASS: resultJSON.PASS.filter(
        (item) => item.filename !== imageData.filename && item.displayName !== imageData.displayName,
      ),
      FAILED: resultJSON.FAILED.filter(
        (item) => item.filename !== imageData.filename && item.displayName !== imageData.displayName,
      ),
    })),
  };
});

import { message, Modal } from 'antd';
import CopyDeckTable from '../CopyDeckTable';
import {
  copyDeckConfluenceInfoAtom,
  copyDeckCurrentViewAtom,
  copyDeckExpandFailedPanelsAtom,
  copyDeckGroupTableDataAtom,
  copyDeckOriginalTableDataAtom,
  copyDeckRenderTableDataAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckSelectedRowsAtom,
  copyDeckShowUncomparedAtom,
  copyDeckStorageHtmlAtom,
  copyDeckValuesArrayAtom,
  hideCopyDeckSidebarAtom,
} from '../copyDeckAtom';
import { uploadStorageApi } from '@/api/tool/copyDeckApi';
import { extractComparisonData, updateCopyColumnFailedMarkersInConfluence } from '../utils/compareLanguage';
import {
  processLanguageForExistingColumns,
  processLanguageForNewColumns,
} from '../utils/exportUtils';
import {
  extractOriginalTestColumns,
  formatTestResultToHtml,
  isTestEvidenceColumn,
  isTestResultColumn,
  replaceTableInStorage,
} from '../utils/confluenceStorageUtils';

const resetAtoms = () => {
  atomStore.clear();
  hoisted.atomListeners.clear();
  hoisted.atomSetterSpies.clear();

  setAtomValue(copyDeckConfluenceInfoAtom, { ...defaultConfluenceInfo });
  setAtomValue(copyDeckRenderTableDataAtom, exportTableData.map((row) => row.map((item) => ({ ...item }))));
  setAtomValue(copyDeckOriginalTableDataAtom, exportTableData.map((row) => row.map((item) => ({ ...item }))));
  setAtomValue(copyDeckValuesArrayAtom, ['fr', 'en']);
  setAtomValue(copyDeckCurrentViewAtom, 'table');
  setAtomValue(copyDeckSelectedLanguageAtom, 'fr');
  setAtomValue(copyDeckShowUncomparedAtom, false);
  setAtomValue(copyDeckSelectedRowsAtom, []);
  setAtomValue(hideCopyDeckSidebarAtom, undefined);
  setAtomValue(copyDeckGroupTableDataAtom, groupTableData);
  setAtomValue(copyDeckStorageHtmlAtom, storageHtml);
  setAtomValue(copyDeckExpandFailedPanelsAtom, { expanded: false, version: 0 });
};

const renderSubject = () => render(<CopyDeckTable />);

describe('CopyDeckTable', () => {
  beforeEach(() => {
    resetAtoms();
    useRequestMode.current = 'idle';
    autoConfirm.current = true;
    currentResultIndexMode.current = 'new';
    comparisonPayload.current = {
      comparisonData: [{ customId: 'row-1' }],
      referenceLanguageCode: 'en',
      targetLanguageCode: 'fr',
    };
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders base content and updates tab, checkbox, selection, and expand controls', () => {
    renderSubject();

    expect(screen.getByText('Copy validation')).toBeInTheDocument();
    expect(screen.getByText('Copy deck')).toBeInTheDocument();
    expect(screen.getByText('Copy Deck Page')).toBeInTheDocument();
    expect(screen.getByText('https://example.com/page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload screenshot' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('0 items selected')).toBeInTheDocument();
    expect(screen.getByText('Group A')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'FR' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
    expect(atomStore.get(copyDeckSelectedLanguageAtom)).toBe('en');
    expect(screen.queryByText('Check definition')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'FR' }));
    expect(screen.getByText('Check definition')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Show un-compared items'));
    expect(atomStore.get(copyDeckShowUncomparedAtom)).toBe(true);

    fireEvent.click(screen.getByText('Expand all'));
    expect(atomStore.get(copyDeckExpandFailedPanelsAtom)).toEqual({ expanded: true, version: 1 });

    fireEvent.click(screen.getByText('Collapse all'));
    expect(atomStore.get(copyDeckExpandFailedPanelsAtom)).toEqual({ expanded: false, version: 2 });

    fireEvent.click(screen.getByLabelText('select-row-1'));
    expect(atomStore.get(copyDeckSelectedRowsAtom)).toEqual([
      { customId: 'row-1', language: 'fr', groupName: 'Group A' },
    ]);
    expect(screen.getByText('1 item selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload screenshot' })).toHaveAttribute('aria-disabled', 'false');

    fireEvent.click(screen.getByLabelText('select-row-2'));
    expect(screen.getByText('2 items selected')).toBeInTheDocument();
  });

  it('handles edit and cancel confirmations by resetting atom state', () => {
    setAtomValue(copyDeckSelectedRowsAtom, [{ customId: 'row-1', language: 'fr', groupName: 'Group A' }]);
    renderSubject();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(Modal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm change data source?',
      }),
    );
    expect(atomStore.get(copyDeckCurrentViewAtom)).toBe('input');
    expect(atomStore.get(copyDeckRenderTableDataAtom)).toEqual([]);
    expect(atomStore.get(copyDeckOriginalTableDataAtom)).toEqual([]);
    expect(atomStore.get(copyDeckStorageHtmlAtom)).toBe('');
    expect(atomStore.get(copyDeckSelectedLanguageAtom)).toBe('');
    expect(atomStore.get(copyDeckSelectedRowsAtom)).toEqual([]);

    setAtomValue(copyDeckRenderTableDataAtom, exportTableData.map((row) => row.map((item) => ({ ...item }))));
    setAtomValue(copyDeckOriginalTableDataAtom, exportTableData.map((row) => row.map((item) => ({ ...item }))));
    setAtomValue(copyDeckStorageHtmlAtom, storageHtml);
    setAtomValue(copyDeckSelectedLanguageAtom, 'fr');
    setAtomValue(copyDeckSelectedRowsAtom, [{ customId: 'row-1', language: 'fr', groupName: 'Group A' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(Modal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm exit',
      }),
    );
    expect(getAtomSetter(hideCopyDeckSidebarAtom)).toHaveBeenCalledTimes(1);
  });

  it('opens and closes the upload modal from the hidden file input', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    setAtomValue(copyDeckSelectedRowsAtom, [{ customId: 'row-1', language: 'fr', groupName: 'Group A' }]);
    const view = renderSubject();

    fireEvent.click(screen.getByRole('button', { name: 'Upload screenshot' }));
    expect(clickSpy).toHaveBeenCalled();

    const fileInput = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['a'], 'proof.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByTestId('upload-modal')).toHaveTextContent('1');
    expect(fileInput.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'close-upload' }));
    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument();
  });

  it('renders copy, result, evidence cells and deletes images across merged rows', () => {
    renderSubject();

    expect(screen.getByTestId('copy-row-1')).toHaveTextContent('Group A:Bonjour');
    expect(screen.getByTestId('check-result-row-1')).toHaveTextContent('img-1.png');
    expect(screen.getByTestId('check-result-row-2')).toHaveTextContent('[{"fileName":"img-1.png","base64":"abc","displayName":"Image 1"}]');
    expect(screen.getByText('plain text')).toBeInTheDocument();

    const groupTable = screen.getAllByTestId('mock-table')[0];
    fireEvent.click(within(groupTable).getAllByRole('button', { name: 'delete-image' })[1]);

    expect(getAtomSetter(copyDeckRenderTableDataAtom)).toHaveBeenCalled();
    const nextTableData = atomStore.get(copyDeckRenderTableDataAtom) as Array<Array<{ value: string }>>;
    expect(nextTableData[2][3].value).toBe('[]');
    expect(nextTableData[1][2].value).toBe('');
    expect(nextTableData[2][2].value).toBe('');
  });

  it('covers export guard branches and fallback cell rendering', () => {
    useRequestMode.current = 'mount-service';
    renderSubject().unmount();

    const selected = [{ customId: 'row-1', language: 'fr', groupName: 'Group A' }];
    const renderExportCase = (overrides: {
      storage?: string;
      renderData?: Array<Array<ReturnType<typeof cell>>>;
      originalData?: Array<Array<ReturnType<typeof cell>>>;
      tableIndex?: number;
    } = {}) => {
      resetAtoms();
      useRequestMode.current = 'service-error';
      setAtomValue(copyDeckSelectedRowsAtom, selected);
      if (overrides.storage !== undefined) {
        setAtomValue(copyDeckStorageHtmlAtom, overrides.storage);
      }
      if (overrides.renderData) {
        setAtomValue(copyDeckRenderTableDataAtom, overrides.renderData);
      }
      if (overrides.originalData) {
        setAtomValue(copyDeckOriginalTableDataAtom, overrides.originalData);
      }
      if (overrides.tableIndex !== undefined) {
        setAtomValue(copyDeckConfluenceInfoAtom, { ...defaultConfluenceInfo, tableIndex: overrides.tableIndex });
      }
      return renderSubject();
    };

    resetAtoms();
    useRequestMode.current = 'service-error';
    let view = renderSubject();
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(message.warning).toHaveBeenCalledWith('Please select rows to export first');
    view.unmount();

    view = renderExportCase({ storage: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    view.unmount();

    view = renderExportCase({
      renderData: [[cell('Copy|values=fr|')], [cell('Bonjour')]],
      originalData: [[cell('Copy|values=fr|')], [cell('Bonjour')]],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    view.unmount();

    view = renderExportCase({
      renderData: exportTableData.map((row) => row.map((item) => ({ ...item }))),
      originalData: exportTableData.map((row) => row.map((item) => ({ ...item }))),
      tableIndex: -1,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    view.unmount();

    view = renderExportCase({
      renderData: exportTableData.map((row) => row.map((item) => ({ ...item }))),
      originalData: exportTableData.map((row) => row.map((item) => ({ ...item }))),
      tableIndex: 9,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    view.unmount();

    view = renderExportCase({ storage: '<html><body><table></table></body></html>', tableIndex: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    view.unmount();

    const raggedData = [
      [cell('COPYDECK_CUSTOM_ID'), cell('Copy|values=fr|'), cell('TestResult|values=fr|')],
      [cell('row-1'), cell('Bonjour')],
      [cell('row-2'), cell('Salut'), cell('[{"fileName":"img-2.png","passed":true}]')],
    ];

    vi.mocked(isTestResultColumn).mockReturnValue(false);
    vi.mocked(isTestEvidenceColumn).mockReturnValue(false);
    vi.mocked(formatTestResultToHtml).mockImplementation((_json: string, doc: Document) => doc.createDocumentFragment());

    view = renderExportCase({
      storage: `
        <html><body><table><thead><tr><th>ID</th><th>Copy</th><th>TestResult|values=fr|</th></tr></thead>
        <tbody><tr><td>row-1</td><td>Bonjour</td></tr><tr><td>row-2</td><td>Salut</td></tr></tbody></table></body></html>
      `,
      renderData: raggedData,
      originalData: raggedData,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    view.unmount();

    vi.mocked(isTestResultColumn).mockImplementation(
      (header: string) => header.toLowerCase().includes('testresult') || header.toLowerCase().includes('test result'),
    );
    vi.mocked(isTestEvidenceColumn).mockImplementation(
      (header: string) => header.toLowerCase().includes('testevidence') || header.toLowerCase().includes('test evidence'),
    );
    vi.mocked(formatTestResultToHtml).mockImplementation((json: string, doc: Document) => {
      const fragment = doc.createDocumentFragment();
      const span = doc.createElement('span');
      span.textContent = `result:${json}`;
      fragment.appendChild(span);
      return fragment;
    });

    view.unmount();
  });

  it('covers empty-group keys and duplicate row selection dedupe', () => {
    setAtomValue(copyDeckGroupTableDataAtom, [[]]);
    renderSubject().unmount();

    resetAtoms();
    renderSubject();

    fireEvent.click(screen.getAllByRole('button', { name: 'duplicate-select' })[0]);
    expect(atomStore.get(copyDeckSelectedRowsAtom)).toEqual([
      { customId: 'row-1', language: 'fr', groupName: 'Group A' },
    ]);
  });

  it('covers delete guard branches and alternate result updates', () => {
    const deleteData = [
      [cell('COPYDECK_CUSTOM_ID'), cell('Copy|values=fr|'), cell('TestResult|values=fr|'), cell('TestEvidence|values=fr|')],
      [
        cell('row-a'),
        cell('A'),
        cell('[{"fileName":"a1.png","passed":true},{"fileName":"a2.png","passed":false}]'),
        cell('[{"fileName":"a1.png","base64":"1","displayName":"A1"},{"fileName":"a2.png","base64":"2","displayName":"A2"}]'),
      ],
      [
        cell('row-b'),
        cell('B'),
        cell('{"PASS":[{"filename":"b1.png"},{"filename":"b2.png"}],"FAILED":[]}'),
        cell('[{"fileName":"b1.png","base64":"1"},{"fileName":"b2.png","base64":"2"}]'),
      ],
      [cell('row-c'), cell('C'), cell('plain-text'), cell('[{"fileName":"c1.png","base64":"1","displayName":"C1"}]')],
      [cell('row-d'), cell('D'), cell('[]'), cell('[{"fileName":"d1.png","base64":"1"},{"fileName":"d2.png","base64":"2"}]', { rowspan: 3 })],
      [cell('row-e'), cell('E'), cell('[]'), cell('[{"fileName":"d1.png","base64":"1"},{"fileName":"d2.png","base64":"2"}]', { isSpanned: true })],
      [cell('row-f'), cell('F'), cell('{"PASS":[{"filename":"d1.png"}],"FAILED":[{"filename":"d2.png"}]}'), cell('[{"fileName":"d1.png","base64":"1"},{"fileName":"d2.png","base64":"2"}]', { isSpanned: true })],
      [cell('row-g'), cell('G'), cell(''), cell('[]')],
    ];

    const deleteGroups = [[
      { customId: 'row-a', customGroup: 'Delete', copy: 'A', result: deleteData[1][2].value, evidence: deleteData[1][3].value, evidenceCell: { rowspan: 1, isSpanned: false } },
      { customId: 'row-b', customGroup: 'Delete', copy: 'B', result: deleteData[2][2].value, evidence: deleteData[2][3].value, evidenceCell: { rowspan: 1, isSpanned: false } },
      { customId: 'row-c', customGroup: 'Delete', copy: 'C', result: deleteData[3][2].value, evidence: deleteData[3][3].value, evidenceCell: { rowspan: 1, isSpanned: false } },
      { customId: 'row-d', customGroup: 'Delete', copy: 'D', result: deleteData[4][2].value, evidence: deleteData[4][3].value, evidenceCell: { rowspan: 3, isSpanned: false } },
      { customId: 'row-e', customGroup: 'Delete', copy: 'E', result: deleteData[5][2].value, evidence: deleteData[5][3].value, evidenceCell: { rowspan: 1, isSpanned: true } },
      { customId: 'row-f', customGroup: 'Delete', copy: 'F', result: deleteData[6][2].value, evidence: deleteData[6][3].value, evidenceCell: { rowspan: 1, isSpanned: true } },
      { customId: 'row-g', customGroup: 'Delete', copy: 'G', result: deleteData[7][2].value, evidence: deleteData[7][3].value, evidenceCell: { rowspan: 1, isSpanned: false } },
    ]];

    setAtomValue(copyDeckRenderTableDataAtom, deleteData);
    setAtomValue(copyDeckOriginalTableDataAtom, deleteData);
    setAtomValue(copyDeckGroupTableDataAtom, deleteGroups);
    let view = renderSubject();

    const deleteButtons = within(screen.getAllByTestId('mock-table')[0]).getAllByRole('button', { name: 'delete-image' });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(deleteButtons[1]);
    fireEvent.click(deleteButtons[2]);
    fireEvent.click(deleteButtons[5]);
    fireEvent.click(deleteButtons[6]);

    const nextTableData = atomStore.get(copyDeckRenderTableDataAtom) as Array<Array<{ value: string }>>;
    expect(nextTableData[1][2].value).toContain('a2.png');
    expect(nextTableData[2][2].value).toBe('{"PASS":[],"FAILED":[]}');
    expect(nextTableData[3][2].value).toBe('');
    expect(nextTableData[6][2].value).toBe('{"PASS":[],"FAILED":[]}');

    view.unmount();
    resetAtoms();
    setAtomValue(copyDeckRenderTableDataAtom, []);
    setAtomValue(copyDeckGroupTableDataAtom, [[{
      customId: 'row-z',
      customGroup: 'Guard',
      copy: 'Z',
      result: '',
      evidence: '[{"fileName":"z.png"}]',
      evidenceCell: { rowspan: 1, isSpanned: false },
    }]]);
    view = renderSubject();
    fireEvent.click(screen.getByRole('button', { name: 'delete-image' }));

    view.unmount();
    resetAtoms();
    setAtomValue(copyDeckRenderTableDataAtom, [[cell('Copy|values=fr|')], [cell('Only copy')]]);
    setAtomValue(copyDeckGroupTableDataAtom, [[{
      customId: 'row-z',
      customGroup: 'Guard',
      copy: 'Z',
      result: '',
      evidence: '[{"fileName":"z.png"}]',
      evidenceCell: { rowspan: 1, isSpanned: false },
    }]]);
    view = renderSubject();
    fireEvent.click(screen.getByRole('button', { name: 'delete-image' }));

    view.unmount();
    resetAtoms();
    setAtomValue(copyDeckRenderTableDataAtom, [[cell('COPYDECK_CUSTOM_ID'), cell('Copy|values=fr|'), cell('TestResult|values=fr|'), cell('TestEvidence|values=fr|')], [cell('other-row'), cell('x'), cell(''), cell('[{"fileName":"z.png"}]')]]);
    setAtomValue(copyDeckGroupTableDataAtom, [[{
      customId: 'row-z',
      customGroup: 'Guard',
      copy: 'Z',
      result: '',
      evidence: '[{"fileName":"z.png"}]',
      evidenceCell: { rowspan: 1, isSpanned: false },
    }]]);
    view = renderSubject();
    fireEvent.click(screen.getByRole('button', { name: 'delete-image' }));
  });

  it('handles compare validation branches synchronously', () => {
    renderSubject();

    comparisonPayload.current = {
      comparisonData: [{ customId: 'row-1' }],
      referenceLanguageCode: '',
      targetLanguageCode: 'fr',
    };
    fireEvent.click(screen.getByText('Check definition'));
    expect(message.error).toHaveBeenCalledWith('Reference language (gl or en) not found');

    comparisonPayload.current = {
      comparisonData: [],
      referenceLanguageCode: 'en',
      targetLanguageCode: 'fr',
    };
    fireEvent.click(screen.getByText('Check definition'));
    expect(message.warning).toHaveBeenCalledWith('No data to compare');

    comparisonPayload.current = {
      comparisonData: [{ customId: 'row-1' }],
      referenceLanguageCode: 'en',
      targetLanguageCode: 'fr',
    };
    fireEvent.click(screen.getByText('Check definition'));
    expect(extractComparisonDataMock).toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith('Comparison failed, please try again');
    expect(atomStore.get(copyDeckExpandFailedPanelsAtom)).toEqual({ expanded: false, version: 1 });
    expect(screen.getByText('Check definition')).toBeInTheDocument();
  });

  it('runs the export conversion path and reports uncovered request errors', () => {
    useRequestMode.current = 'service-error';
    setAtomValue(copyDeckSelectedRowsAtom, [
      { customId: 'row-1', language: 'fr', groupName: 'Group A' },
      { customId: 'row-2', language: 'es', groupName: 'Group A' },
    ]);

    renderSubject();

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(Modal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Confirm export',
      }),
    );
    expect(extractOriginalTestColumns).toHaveBeenCalledWith(storageHtml, 'CopyDeck');
    expect(processLanguageForNewColumns).toHaveBeenCalledTimes(2);
    expect(replaceTableInStorage).toHaveBeenCalled();
    expect(updateCopyColumnFailedMarkersInConfluence).toHaveBeenCalled();
    expect(uploadStorageApi).toHaveBeenCalledWith(
      expect.objectContaining({
        confluenceUrl: 'https://example.com/page',
      }),
    );
    expect(message.error).toHaveBeenCalledWith('upload failed');
  });

  it('runs the existing-column export branch and the manual success callback branch', () => {
    currentResultIndexMode.current = 'existing';
    useRequestMode.current = 'service-error';
    setAtomValue(copyDeckSelectedRowsAtom, [
      { customId: 'row-1', language: 'fr', groupName: 'Group A' },
      { customId: 'row-2', language: 'fr', groupName: 'Group A' },
    ]);

    renderSubject();

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(processLanguageForExistingColumns).toHaveBeenCalledWith(
      'fr',
      false,
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
    );

    useRequestMode.current = 'success';
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(atomStore.get(copyDeckSelectedRowsAtom)).toEqual([]);
    expect(screen.getByText('0 items selected')).toBeInTheDocument();
  });

});
