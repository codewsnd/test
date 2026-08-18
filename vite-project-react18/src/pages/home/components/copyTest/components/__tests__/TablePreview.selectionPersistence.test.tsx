import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TablePreview from '../TablePreview';
import { parseCopyTestStorageTables } from '../../table/copyTestTableParser';
import {
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
} from '../../table/tableConstants';
import {
  PREVIEW_MESSAGE_TYPE,
  SELECTION_CHECKBOX_ATTRIBUTE,
  SELECTION_ROW_INDEXES_ATTRIBUTE,
  SELECTION_SELECT_ALL_ATTRIBUTE,
} from '../tablePreview/tablePreviewConstants';

vi.mock('antd', () => ({
  Empty: ({ description }: { description?: string }) => <div>{description}</div>,
}));

const SOURCE_COLUMN_KEY = '1:Target';

/** 构建与 fresh Confluence import 一致的三行无空行表格。 */
const buildSelectionStorage = (persisted: boolean): string => {
  const generatedHeaders = persisted
    ? [
        `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"`,
        ` ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="${SOURCE_COLUMN_KEY}"`,
        ` data-copy-test-owner-id="${SOURCE_COLUMN_KEY}" data-copy-test-schema="2">`,
        'Test Result - Target</th>',
        `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"`,
        ` ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="${SOURCE_COLUMN_KEY}"`,
        ` data-copy-test-owner-id="${SOURCE_COLUMN_KEY}" data-copy-test-schema="2">`,
        'Test Evidence - Target</th>',
      ].join('')
    : '';
  const generatedRows = persisted
    ? [
        '<td data-copy-test-column-type="result" data-copy-test-source-column-key="1:Target"',
        ' data-copy-test-owner-id="1:Target" data-copy-test-schema="2"',
        ' data-copy-test-evidence-group-id="0"></td>',
      ].join('')
    : '';
  const firstEvidenceCell = persisted
    ? '<td data-copy-test-column-type="evidence" data-copy-test-source-column-key="1:Target"'
      + ' data-copy-test-owner-id="1:Target" data-copy-test-schema="2" rowspan="3"></td>'
    : '';

  return [
    '<table><tr><th>ID</th><th>Target</th>',
    generatedHeaders,
    '</tr>',
    '<tr><td>U-01</td><td>Country / Region</td>',
    generatedRows,
    firstEvidenceCell,
    '</tr>',
    '<tr><td>U-02</td><td>Country</td>',
    generatedRows,
    '</tr>',
    '<tr><td>U-03</td><td>Hong Kong SAR, China</td>',
    generatedRows,
    '</tr></table>',
  ].join('');
};

const atomicTable = parseCopyTestStorageTables(buildSelectionStorage(false))[0];
const persistedTable = parseCopyTestStorageTables(buildSelectionStorage(true))[0];

/** 读取预览内三个业务行 checkbox 的 payload。 */
const readRowSelectionPayloads = (doc: Document): string[] => {
  return Array.from(doc.querySelectorAll<HTMLInputElement>(
    `[${SELECTION_CHECKBOX_ATTRIBUTE}]:not([${SELECTION_SELECT_ALL_ATTRIBUTE}])`
  )).map(checkbox => checkbox.getAttribute(SELECTION_ROW_INDEXES_ATTRIBUTE) || '');
};

/** 把静态 srcDoc 内容安装到 happy-dom iframe，供局部 patch 路径测试。 */
const installFrameDocument = (iframe: HTMLIFrameElement): HTMLElement => {
  const sourceDocument = new DOMParser().parseFromString(
    iframe.getAttribute('srcdoc') || '',
    'text/html'
  );
  iframe.contentDocument!.body.innerHTML = sourceDocument.body.innerHTML;
  const scrollRoot = iframe.contentDocument!.querySelector<HTMLElement>(
    '.copy-test-preview-scroll-root'
  );
  if (!scrollRoot) {
    throw new Error('Expected CopyTest preview scroll root');
  }
  return scrollRoot;
};

const createProps = (onRowsChange: (value: number[]) => void) => ({
  onEvidenceImageDelete: vi.fn(),
  onEvidenceImagePreview: vi.fn(),
  onResultStatusChange: vi.fn(),
  onSelectedRowIndexesChange: onRowsChange,
});

beforeEach(() => {
  /** happy-dom 的 srcDoc window 使用 null origin，测试中只屏蔽底层发送实现。 */
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const iframeWindowPrototype = Object.getPrototypeOf(iframe.contentWindow) as Window;
  vi.spyOn(iframeWindowPrototype, 'postMessage').mockImplementation(() => undefined);
  iframe.remove();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TablePreview persisted Evidence selection', () => {
  it('renders every fresh imported row with the persisted dynamic group payload', () => {
    const props = createProps(vi.fn());
    render(
      <TablePreview
        {...props}
        previewRevision={1}
        selectedColumnIndex={1}
        selectedRowIndexes={[0, 1, 2]}
        table={persistedTable}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    const frameDocument = new DOMParser().parseFromString(
      iframe.getAttribute('srcdoc') || '',
      'text/html'
    );

    expect(readRowSelectionPayloads(frameDocument)).toEqual([
      '[0,1,2]',
      '[0,1,2]',
      '[0,1,2]',
    ]);
  });

  it('patches a frozen srcDoc to the fresh persisted group and toggles all linked rows', () => {
    const onRowsChange = vi.fn();
    const props = createProps(onRowsChange);
    const { rerender } = render(
      <TablePreview
        {...props}
        previewRevision={1}
        selectedColumnIndex={1}
        selectedRowIndexes={[0, 1, 2]}
        table={atomicTable}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    const initialSrcDoc = iframe.getAttribute('srcdoc');
    const initialFrameWindow = iframe.contentWindow;
    const scrollRoot = installFrameDocument(iframe);
    fireEvent.load(iframe);
    expect(readRowSelectionPayloads(iframe.contentDocument!)).toEqual(['[0]', '[1]', '[2]']);

    /** 同一 table/column key 下模拟 Validate/export 后 fresh persisted working table。 */
    rerender(
      <TablePreview
        {...props}
        previewRevision={2}
        selectedColumnIndex={1}
        selectedRowIndexes={[0, 1, 2]}
        table={persistedTable}
      />
    );

    expect(iframe.getAttribute('srcdoc')).toBe(initialSrcDoc);
    expect(iframe.contentWindow).toBe(initialFrameWindow);
    expect(iframe.contentDocument?.querySelector('.copy-test-preview-scroll-root')).toBe(scrollRoot);
    expect(readRowSelectionPayloads(iframe.contentDocument!)).toEqual([
      '[0,1,2]',
      '[0,1,2]',
      '[0,1,2]',
    ]);

    fireEvent(window, new MessageEvent('message', {
      data: {
        action: 'selection',
        checked: false,
        rowIndexes: [0, 1, 2],
        type: PREVIEW_MESSAGE_TYPE,
      },
      origin: window.location.origin,
      source: iframe.contentWindow,
    }));
    expect(onRowsChange).toHaveBeenCalledWith([]);
  });
});
