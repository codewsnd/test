import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TablePreview from '../TablePreview';
import { parseCopyTestStorageTables } from '../../table/copyTestTableParser';
import {
  COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE,
  COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE,
  COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE,
  COPY_TEST_GENERATED_CONTENT_ATTRIBUTE,
  COPY_TEST_GENERATED_EVIDENCE_TYPE,
  COPY_TEST_GENERATED_RESULT_TYPE,
  COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE,
} from '../../table/tableConstants';

vi.mock('antd', () => ({
  Empty: ({ description }: { description?: string }) => <div>{description}</div>,
}));

const tableHtml = [
  '<table><tr><th>Reference|values=hk_en|</th><th>Target</th>',
  `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}" ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="1:Target">Test Result - Target</th>`,
  `<th ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}" ${COPY_TEST_GENERATED_SOURCE_COLUMN_KEY_ATTRIBUTE}="1:Target">Test Evidence - Target</th></tr>`,
  '<tr><td>hello</td><td>你好</td>',
  `<td><div ${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_RESULT_TYPE}"><strong>Passed:</strong></div></td>`,
  `<td ${COPY_TEST_GENERATED_COLUMN_TYPE_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}">`,
  `<div ${COPY_TEST_GENERATED_CONTENT_ATTRIBUTE}="${COPY_TEST_GENERATED_EVIDENCE_TYPE}">`,
  '<div data-copy-test-evidence-card="true"><strong>Screen01</strong>',
  `<ac:image ${COPY_TEST_EVIDENCE_IMAGE_ID_ATTRIBUTE}="img-1" ${COPY_TEST_EVIDENCE_IMAGE_INSTANCE_ATTRIBUTE}="img-1:0:0" ${COPY_TEST_EVIDENCE_IMAGE_SRC_ATTRIBUTE}="data:image/png;base64,QUJD" ${COPY_TEST_EVIDENCE_IMAGE_ALT_ATTRIBUTE}="screen-a.png"><ri:attachment ri:filename="screen-a.png" /></ac:image>`,
  '</div></div></td></tr><tr><td>empty</td><td></td><td></td><td></td></tr></table>',
].join('');
const table = parseCopyTestStorageTables(tableHtml)[0];

describe('TablePreview', () => {
  it('renders srcDoc, handles iframe messages, and exercises scrollbar branch', () => {
    const onDelete = vi.fn();
    const onPreview = vi.fn();
    const onRowsChange = vi.fn();
    const { rerender } = render(
      <TablePreview onEvidenceImageDelete={onDelete} onEvidenceImagePreview={onPreview} onSelectedRowIndexesChange={onRowsChange} selectedRowIndexes={[]} />
    );
    expect(screen.getByText('No table selected')).toBeTruthy();
    rerender(
      <TablePreview
        disabled={false}
        onEvidenceImageDelete={onDelete}
        onEvidenceImagePreview={onPreview}
        onSelectedRowIndexesChange={onRowsChange}
        selectedColumnIndex={1}
        selectedRowIndexes={[0]}
        table={table}
      />
    );
    const iframe = screen.getByTitle('CopyTest table preview') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcdoc')).toContain('copy-test-preview-scroll-root');
    expect(iframe.getAttribute('srcdoc')).toContain('Delete evidence image');
    window.dispatchEvent(new MessageEvent('message', { data: { action: 'preview', alt: 'screen', imageId: 'img-1', src: 'blob:1', type: 'copy-test-preview-message' } }));
    window.dispatchEvent(new MessageEvent('message', { data: { action: 'selection', checked: false, rowIndexes: [0], type: 'copy-test-preview-message' } }));
    window.dispatchEvent(new MessageEvent('message', { data: { action: 'delete', imageId: 'img-1', instanceId: 'inst-1', type: 'copy-test-preview-message' } }));
    window.dispatchEvent(new MessageEvent('message', { data: { action: 'noop', type: 'other' } }));
    expect(onPreview).toHaveBeenCalledWith({ alt: 'screen', imageId: 'img-1', src: 'blob:1' });
    expect(onRowsChange).toHaveBeenCalledWith([]);
    expect(onDelete).toHaveBeenCalledWith({ imageId: 'img-1', instanceId: 'inst-1' });
    fireEvent.load(iframe);
    const scrollbar = screen.getByRole('scrollbar');
    fireEvent.mouseDown(scrollbar.firstElementChild as Element, { clientX: 10 });
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    expect(scrollbar).toBeTruthy();
  });
});
