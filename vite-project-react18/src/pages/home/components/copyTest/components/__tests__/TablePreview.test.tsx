import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TablePreview from '../TablePreview';
import {
  COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH,
  COPY_TEST_PREVIEW_HEADER_WIDTH,
  COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH,
} from '../../constants';
import { parseCopyTestStorageTables } from '../../table/copyTestTableParser';
import {
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
} from '../../table/tableConstants';

vi.mock('antd', () => ({
  Empty: ({ description }: { description?: string }) => <div>{description}</div>,
}));

const BASE64_IMAGE = 'data:image/png;base64,QUJD';
const PREVIEW_MESSAGE_TYPE = 'copy-test-preview-message';
const PREVIEW_COLUMN_ROLE_ATTRIBUTE = 'data-copy-test-preview-column-role';
const PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE = 'data-copy-test-preview-fixed-width-table';
const PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE = 'data-copy-test-preview-equal-width-table';
const PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH = 'calc((100% - 42px) / 3)';
/** Evidence 删除按钮的可访问选择器。 */
const EVIDENCE_DELETE_BUTTON_SELECTOR = 'button[aria-label="Delete evidence image"]';
const SELECTION_CHECKBOX_ATTRIBUTE = 'data-copy-test-selection-checkbox';
const SELECTION_ROW_INDEXES_ATTRIBUTE = 'data-copy-test-selection-row-indexes';
const SELECTION_SELECT_ALL_ATTRIBUTE = 'data-copy-test-selection-all';

/** 创建同一图片的不同 Evidence 实例。 */
const createEvidenceImage = (instanceId: string): string => {
  return [
    `<div data-copy-test-evidence-card="true"><strong>${instanceId}</strong>`,
    `<ac:image ${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="img-shared"`,
    ` ${COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE}="${instanceId}"`,
    ` ${COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE}="screen-a.png">`,
    '<ri:attachment ri:filename="screen-a.png" /></ac:image></div>',
  ].join('');
};

/** 包含旧列宽、合并行和严格 Test 双列 metadata 的预览表格。 */
const mergedTableHtml = [
  '<table style="width: 1660px; table-layout: auto;"><colgroup>',
  '<col style="width: 80px;" /><col style="width: 220px;" /><col style="width: 240px;" />',
  '<col style="width: 260px;" /><col style="width: 500px;" /><col style="width: 160px;" />',
  '<col style="width: 200px;" /></colgroup>',
  '<tr><th>Reference</th><th>Context A</th><th>Context B</th><th>Context C</th><th>Target</th>',
  `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"`,
  ` ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="4:Target" data-copy-test-owner-id="4:Target"`,
  ' data-copy-test-schema="2">Test Result - Target</th>',
  `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"`,
  ` ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="4:Target" data-copy-test-owner-id="4:Target"`,
  ' data-copy-test-schema="2">Test Evidence - Target</th></tr>',
  '<tr><td>Reference 1</td><td colspan="4" rowspan="4">',
  '<a href="javascript:unsafe()" onclick="unsafe()">Merged target</a><script>unsafeScript()</script></td>',
  `<td rowspan="4"><div ${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"><strong>Passed:</strong></div></td>`,
  `<td rowspan="4"><div ${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}">`,
  createEvidenceImage('img-shared:0:0'),
  createEvidenceImage('img-shared:0:1'),
  '</div></td></tr>',
  '<tr><td>Reference 2</td></tr>',
  '<tr><td>Reference 3</td></tr>',
  '<tr><td>Reference 4</td></tr>',
  '<tr><td>Reference 5</td><td>Context A</td><td>Context B</td><td>Context C</td><td>   </td><td></td><td></td></tr>',
  '</table>',
].join('');
const mergedTable = parseCopyTestStorageTables(mergedTableHtml)[0];

const sharedImages = [
  { base64: BASE64_IMAGE, fileName: 'img-shared', md5: 'img-shared' },
  { base64: BASE64_IMAGE, fileName: 'img-shared', md5: 'img-shared' },
  { base64: 'invalid-image-data', fileName: 'invalid.png', md5: 'img-invalid' },
];

/** 创建 TablePreview 回调。 */
const createHandlers = () => ({
  onDelete: vi.fn(),
  onPreview: vi.fn(),
  onRowsChange: vi.fn(),
});

/** 解析 iframe 的静态 srcDoc。 */
const parseFrameDocument = (iframe: HTMLIFrameElement): Document => {
  return new DOMParser().parseFromString(iframe.getAttribute('srcdoc') || '', 'text/html');
};

/** 读取顶层预览 colgroup 的角色与宽度表达式。 */
const readPreviewColumnLayout = (doc: Document) => {
  return Array.from(doc.querySelectorAll('table > colgroup > col')).map(column => ({
    role: column.getAttribute(PREVIEW_COLUMN_ROLE_ATTRIBUTE),
    width: column.getAttribute('width'),
  }));
};

/** 按行下标读取 iframe 选择框。 */
const findRowCheckbox = (doc: Document, rowIndexes: number[]): HTMLInputElement | undefined => {
  return Array.from(doc.querySelectorAll<HTMLInputElement>(`[${SELECTION_CHECKBOX_ATTRIBUTE}]`))
    .find(checkbox => !checkbox.hasAttribute(SELECTION_SELECT_ALL_ATTRIBUTE)
      && checkbox.getAttribute(SELECTION_ROW_INDEXES_ATTRIBUTE) === JSON.stringify(rowIndexes));
};

/** 给 happy-dom iframe 安装可测量的滚动内容。 */
const installFrameScrollContent = (iframe: HTMLIFrameElement) => {
  const frameDocument = iframe.contentDocument!;
  frameDocument.body.innerHTML = '<div class="copy-test-preview-scroll-root"><table><tbody><tr><td>wide</td></tr></tbody></table></div>';
  const scrollRoot = frameDocument.querySelector<HTMLElement>('.copy-test-preview-scroll-root')!;
  const frameTable = frameDocument.querySelector<HTMLElement>('table')!;
  Object.defineProperty(scrollRoot, 'clientWidth', { configurable: true, value: 100 });
  Object.defineProperty(scrollRoot, 'scrollWidth', { configurable: true, value: 320 });
  Object.defineProperty(frameTable, 'scrollWidth', { configurable: true, value: 320 });
  scrollRoot.scrollLeft = 20;
  return { frameTable, scrollRoot };
};

beforeEach(() => {
  let objectUrlIndex = 0;
  /** happy-dom 将 srcDoc iframe 建模为 null origin，统一替换底层发送实现以测试调用契约。 */
  const iframeForPrototype = document.createElement('iframe');
  document.body.appendChild(iframeForPrototype);
  const iframeWindowPrototype = Object.getPrototypeOf(iframeForPrototype.contentWindow) as Window;
  vi.spyOn(iframeWindowPrototype, 'postMessage').mockImplementation(() => undefined);
  iframeForPrototype.remove();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    objectUrlIndex += 1;
    return `blob:preview-${objectUrlIndex}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TablePreview', () => {
  it('defines configurable widths for normal, Result, and Evidence headers', () => {
    expect(COPY_TEST_PREVIEW_HEADER_WIDTH).toBe(200);
    expect(COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH).toBe(300);
    expect(COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH).toBe(300);
  });

  it('renders empty, full-table, and selected-column previews with merged row selection', () => {
    const handlers = createHandlers();
    const originalWorkingHtml = mergedTable.workingHtml;
    const emptyRender = render(
      <TablePreview
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedRowIndexes={[]}
      />
    );
    expect(screen.getByText('No table selected')).toBeTruthy();
    emptyRender.unmount();

    const { rerender, unmount } = render(
      <TablePreview
        images={sharedImages}
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedRowIndexes={[]}
        table={mergedTable}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    const fullSrcDoc = iframe.getAttribute('srcdoc');
    expect(fullSrcDoc).toContain('Reference');
    /** 未选择 Comparison Column 时也统一覆盖 Confluence 原始列宽。 */
    const fullDocument = parseFrameDocument(iframe);
    const fullTable = fullDocument.querySelector<HTMLTableElement>('table');
    expect(fullDocument.querySelector(`[${SELECTION_CHECKBOX_ATTRIBUTE}]`)).toBeNull();
    expect(fullDocument.querySelectorAll('img[src="blob:preview-1"]')).toHaveLength(2);
    expect(fullDocument.querySelector(EVIDENCE_DELETE_BUTTON_SELECTOR)).toBeNull();
    expect(fullTable?.getAttribute(PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE)).toBe('true');
    expect(fullTable?.getAttribute(PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE)).toBeNull();
    expect(fullTable?.style.width).toBe('1600px');
    expect(fullTable?.style.minWidth).toBe('1600px');
    expect(fullTable?.style.maxWidth).toBe('1600px');
    expect(readPreviewColumnLayout(fullDocument)).toEqual([
      { role: 'header', width: String(COPY_TEST_PREVIEW_HEADER_WIDTH) },
      { role: 'header', width: String(COPY_TEST_PREVIEW_HEADER_WIDTH) },
      { role: 'header', width: String(COPY_TEST_PREVIEW_HEADER_WIDTH) },
      { role: 'header', width: String(COPY_TEST_PREVIEW_HEADER_WIDTH) },
      { role: 'header', width: String(COPY_TEST_PREVIEW_HEADER_WIDTH) },
      { role: COPY_TEST_GENERATED_RESULT_TYPE, width: String(COPY_TEST_PREVIEW_RESULT_HEADER_WIDTH) },
      { role: COPY_TEST_GENERATED_EVIDENCE_TYPE, width: String(COPY_TEST_PREVIEW_EVIDENCE_HEADER_WIDTH) },
    ]);

    rerender(
      <TablePreview
        images={sharedImages}
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedColumnIndex={4}
        selectedRowIndexes={[0]}
        table={mergedTable}
      />
    );
    const selectedSrcDoc = iframe.getAttribute('srcdoc') || '';
    const selectedDocument = parseFrameDocument(iframe);
    const mergedCheckbox = findRowCheckbox(selectedDocument, [0]);
    const emptySourceCheckbox = findRowCheckbox(selectedDocument, [4]);
    const selectAll = selectedDocument.querySelector<HTMLInputElement>(`[${SELECTION_SELECT_ALL_ATTRIBUTE}]`);
    /** 选列后选择框保持固定宽度，来源列和 Test 双列等分剩余宽度。 */
    const selectedTable = selectedDocument.querySelector<HTMLTableElement>('table');
    expect(selectedSrcDoc).not.toBe(fullSrcDoc);
    expect(selectedTable?.getAttribute(PREVIEW_FIXED_WIDTH_TABLE_ATTRIBUTE)).toBe('true');
    expect(selectedTable?.getAttribute(PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE)).toBe('true');
    expect(selectedTable?.style.width).toBe('100%');
    expect(selectedTable?.style.minWidth).toBe('100%');
    expect(selectedTable?.style.maxWidth).toBe('100%');
    expect(selectedSrcDoc).toContain(`width: ${PREVIEW_EQUAL_BUSINESS_COLUMN_WIDTH} !important`);
    expect(readPreviewColumnLayout(selectedDocument)).toEqual([
      { role: 'selection', width: '42' },
      { role: 'header', width: null },
      { role: COPY_TEST_GENERATED_RESULT_TYPE, width: null },
      { role: COPY_TEST_GENERATED_EVIDENCE_TYPE, width: null },
    ]);
    expect(mergedCheckbox).toBeTruthy();
    expect(mergedCheckbox?.closest('td')?.getAttribute('rowspan')).toBe('4');
    expect(emptySourceCheckbox?.disabled).toBe(true);
    expect(selectAll?.getAttribute(SELECTION_ROW_INDEXES_ATTRIBUTE)).toBe('[0]');
    expect(selectedSrcDoc).not.toContain(BASE64_IMAGE);
    expect(selectedSrcDoc).not.toContain('unsafeScript');
    expect(selectedSrcDoc).not.toContain('javascript:unsafe');
    expect(selectedSrcDoc).not.toContain('onclick=');
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(selectedDocument.querySelectorAll('img[src="blob:preview-1"]')).toHaveLength(2);
    expect(selectedDocument.querySelectorAll(EVIDENCE_DELETE_BUTTON_SELECTOR)).toHaveLength(2);

    rerender(
      <TablePreview
        images={sharedImages}
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedRowIndexes={[]}
        table={mergedTable}
      />
    );
    const clearedDocument = parseFrameDocument(iframe);
    const clearedTable = clearedDocument.querySelector<HTMLTableElement>('table');
    expect(clearedDocument.querySelector(EVIDENCE_DELETE_BUTTON_SELECTOR)).toBeNull();
    expect(clearedTable?.getAttribute(PREVIEW_EQUAL_WIDTH_TABLE_ATTRIBUTE)).toBeNull();
    expect(clearedTable?.style.width).toBe('1600px');
    expect(clearedTable?.style.minWidth).toBe('1600px');
    expect(clearedTable?.style.maxWidth).toBe('1600px');
    expect(readPreviewColumnLayout(clearedDocument)).toEqual(readPreviewColumnLayout(fullDocument));
    expect(mergedTable.workingHtml).toBe(originalWorkingHtml);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('keeps srcDoc stable for selection and disabled changes while posting incremental state', () => {
    const handlers = createHandlers();
    const { rerender } = render(
      <TablePreview
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedColumnIndex={4}
        selectedRowIndexes={[0]}
        table={mergedTable}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    const initialSrcDoc = iframe.getAttribute('srcdoc');
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage');
    expect(iframe.contentWindow?.location.origin).toBe('null');

    rerender(
      <TablePreview
        disabled
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedColumnIndex={4}
        selectedRowIndexes={[]}
        table={mergedTable}
      />
    );

    expect(iframe.getAttribute('srcdoc')).toBe(initialSrcDoc);
    expect(postMessage).toHaveBeenCalledWith({
      disabled: true,
      selectedRowIndexes: [],
      type: 'copy-test-preview-state',
    }, window.location.origin);
    /** 增量状态消息实际使用的目标 origin。 */
    const targetOrigins = postMessage.mock.calls.map(([, targetOrigin]) => String(targetOrigin));
    expect(targetOrigins).not.toContain('null');
    expect(targetOrigins).not.toContain('*');
  });

  it('accepts valid iframe messages and ignores invalid data or the wrong source', () => {
    const handlers = createHandlers();
    render(
      <TablePreview
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedColumnIndex={4}
        selectedRowIndexes={[0]}
        table={mergedTable}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    const messageSource = iframe.contentWindow;
    const previewMessage = {
      action: 'preview',
      alt: 'screen',
      imageId: 'img-shared',
      src: 'blob:preview',
      type: PREVIEW_MESSAGE_TYPE,
    };

    fireEvent(window, new MessageEvent('message', { data: previewMessage, source: window }));
    fireEvent(window, new MessageEvent('message', { data: null, source: messageSource }));
    fireEvent(window, new MessageEvent('message', {
      data: { ...previewMessage, type: 'invalid-message' },
      origin: window.location.origin,
      source: messageSource,
    }));
    fireEvent(window, new MessageEvent('message', {
      data: previewMessage,
      origin: 'https://untrusted.example',
      source: messageSource,
    }));
    expect(handlers.onPreview).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onRowsChange).not.toHaveBeenCalled();

    fireEvent(window, new MessageEvent('message', {
      data: previewMessage,
      origin: window.location.origin,
      source: messageSource,
    }));
    fireEvent(window, new MessageEvent('message', {
      data: { action: 'selection', checked: true, rowIndexes: [4], type: PREVIEW_MESSAGE_TYPE },
      origin: window.location.origin,
      source: messageSource,
    }));
    fireEvent(window, new MessageEvent('message', {
      data: { action: 'selection', checked: false, rowIndexes: [0], type: PREVIEW_MESSAGE_TYPE },
      origin: window.location.origin,
      source: messageSource,
    }));
    fireEvent(window, new MessageEvent('message', {
      data: { action: 'delete', imageId: 'img-shared', instanceId: 'img-shared:0:1', type: PREVIEW_MESSAGE_TYPE },
      origin: window.location.origin,
      source: messageSource,
    }));

    expect(handlers.onPreview).toHaveBeenCalledWith({
      alt: 'screen',
      imageId: 'img-shared',
      src: 'blob:preview',
    });
    expect(handlers.onRowsChange).toHaveBeenNthCalledWith(1, [0, 4]);
    expect(handlers.onRowsChange).toHaveBeenNthCalledWith(2, []);
    expect(handlers.onDelete).toHaveBeenCalledWith({
      imageId: 'img-shared',
      instanceId: 'img-shared:0:1',
    });
  });

  it('binds ResizeObserver and coalesces thumb dragging into animation frames', () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    const animationFrames: FrameRequestCallback[] = [];
    let animationFrameId = 0;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      animationFrameId += 1;
      animationFrames.push(callback);
      return animationFrameId;
    });
    const cancelAnimationFrame = vi.fn();
    let resizeCallback: ResizeObserverCallback | undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      disconnect = disconnect;
      observe = observe;
      unobserve = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
    const handlers = createHandlers();
    /** 提供预览切换和卸载能力的组件渲染结果。 */
    const { rerender, unmount } = render(
      <TablePreview
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedColumnIndex={4}
        selectedRowIndexes={[0]}
        table={mergedTable}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    const { scrollRoot } = installFrameScrollContent(iframe);
    fireEvent.load(iframe);
    expect(observe).toHaveBeenCalledTimes(2);

    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });
    const scrollbar = screen.getByRole('scrollbar');
    const thumb = scrollbar.firstElementChild as HTMLElement;
    Object.defineProperty(scrollbar, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(thumb, 'offsetWidth', { configurable: true, value: 50 });
    fireEvent.mouseDown(thumb, { clientX: 10 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 30 }));
    fireEvent(window, new MouseEvent('mousemove', { clientX: 50 }));
    fireEvent(window, new MouseEvent('mousemove', { clientX: 70 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(scrollRoot.scrollLeft).toBe(20);

    act(() => {
      animationFrames.shift()?.(0);
    });
    expect(scrollRoot.scrollLeft).toBeCloseTo(108);
    const firstDraggedScrollLeft = scrollRoot.scrollLeft;
    expect(scrollbar.getAttribute('aria-valuenow')).toBe(String(firstDraggedScrollLeft));

    scrollRoot.scrollLeft = firstDraggedScrollLeft + 5;
    fireEvent.scroll(scrollRoot);
    expect(scrollbar.getAttribute('aria-valuenow')).toBe(String(firstDraggedScrollLeft));

    fireEvent(window, new MouseEvent('mousemove', { clientX: 80 }));
    fireEvent(window, new MouseEvent('mousemove', { clientX: 90 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    fireEvent(window, new MouseEvent('mouseup'));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(scrollRoot.scrollLeft).toBeCloseTo(137.333, 3);
    expect(scrollbar.getAttribute('aria-valuenow')).toBe(String(scrollRoot.scrollLeft));

    scrollRoot.scrollLeft = 40;
    fireEvent.scroll(scrollRoot);
    expect(scrollbar.getAttribute('aria-valuenow')).toBe('40');
    fireEvent(window, new Event('resize'));

    /** 浏览器失焦时应消费最终位置并结束拖拽。 */
    fireEvent.mouseDown(thumb, { clientX: 10 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 20 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
    fireEvent(window, new Event('blur'));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(3);
    expect(scrollRoot.scrollLeft).toBeCloseTo(54.667, 3);
    fireEvent(window, new MouseEvent('mousemove', { clientX: 30 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);

    /** srcDoc 变化时应取消尚未绘制的拖拽。 */
    fireEvent.mouseDown(thumb, { clientX: 10 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 20 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(4);
    rerender(
      <TablePreview
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedColumnIndex={3}
        selectedRowIndexes={[0]}
        table={mergedTable}
      />
    );
    expect(cancelAnimationFrame).toHaveBeenCalledWith(4);
    fireEvent(window, new MouseEvent('mousemove', { clientX: 30 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(4);

    /** 卸载时应取消尚未绘制的拖拽。 */
    /** srcDoc 更新后重新渲染的当前滑块节点。 */
    const currentThumb = screen.getByRole('scrollbar').firstElementChild as HTMLElement;
    fireEvent.mouseDown(currentThumb, { clientX: 10 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 20 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(5);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(5);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back safely when ResizeObserver or iframe scroll content is unavailable', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const handlers = createHandlers();
    render(
      <TablePreview
        onEvidenceImageDelete={handlers.onDelete}
        onEvidenceImagePreview={handlers.onPreview}
        onSelectedRowIndexesChange={handlers.onRowsChange}
        selectedColumnIndex={99}
        selectedRowIndexes={[]}
        table={mergedTable}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    const invalidSelectionDocument = parseFrameDocument(iframe);
    expect(invalidSelectionDocument.querySelector(EVIDENCE_DELETE_BUTTON_SELECTOR)).toBeNull();
    installFrameScrollContent(iframe);
    fireEvent.load(iframe);
    iframe.contentDocument!.body.innerHTML = '';
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('scrollbar')).toBeTruthy();
  });
});
