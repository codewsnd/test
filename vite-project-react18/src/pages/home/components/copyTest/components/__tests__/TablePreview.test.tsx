import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TablePreview from '../TablePreview';
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

const mergedTableHtml = [
  '<table><tr><th>Reference</th><th>Context A</th><th>Context B</th><th>Context C</th><th>Target</th>',
  `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"`,
  ` ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="4:Target">Test Result - Target</th>`,
  `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}"`,
  ` ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="4:Target">Test Evidence - Target</th></tr>`,
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
  { base64: BASE64_IMAGE, fileName: 'screen-a.png', md5: 'img-shared' },
  { base64: BASE64_IMAGE, fileName: 'screen-a-copy.png', md5: 'img-shared' },
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
  it('renders empty, full-table, and selected-column previews with merged row selection', () => {
    const handlers = createHandlers();
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
    expect(parseFrameDocument(iframe).querySelector(`[${SELECTION_CHECKBOX_ATTRIBUTE}]`)).toBeNull();

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
    expect(selectedSrcDoc).not.toBe(fullSrcDoc);
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
    }, '*');
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
      source: messageSource,
    }));
    expect(handlers.onPreview).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onRowsChange).not.toHaveBeenCalled();

    fireEvent(window, new MessageEvent('message', { data: previewMessage, source: messageSource }));
    fireEvent(window, new MessageEvent('message', {
      data: { action: 'selection', checked: true, rowIndexes: [4], type: PREVIEW_MESSAGE_TYPE },
      source: messageSource,
    }));
    fireEvent(window, new MessageEvent('message', {
      data: { action: 'selection', checked: false, rowIndexes: [0], type: PREVIEW_MESSAGE_TYPE },
      source: messageSource,
    }));
    fireEvent(window, new MessageEvent('message', {
      data: { action: 'delete', imageId: 'img-shared', instanceId: 'img-shared:0:1', type: PREVIEW_MESSAGE_TYPE },
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
    const { unmount } = render(
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

    fireEvent.mouseDown(thumb, { clientX: 10 });
    fireEvent(window, new MouseEvent('mousemove', { clientX: 20 }));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(3);
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
    installFrameScrollContent(iframe);
    fireEvent.load(iframe);
    iframe.contentDocument!.body.innerHTML = '';
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('scrollbar')).toBeTruthy();
  });
});
