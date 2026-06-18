import { describe, expect, it } from 'vitest';
import {
  COPY_TEST_EVIDENCE_IMAGE_HEIGHT,
  COPY_TEST_EVIDENCE_IMAGE_WIDTH,
} from '../tableConstants';
import { parseHtml } from '../tableModel';
import {
  applyConfluenceStorageTableImages,
  buildConfluenceStorageTableExportPayload,
  getConfluenceStorageTableImageFileNames,
  isStorageImageElement,
} from '../copyTestTableImages';

const IMAGE_BASE64 = 'data:image/png;base64,QUJD';
const images = [{ base64: IMAGE_BASE64, fileName: 'screen-a.png' }];

describe('copyTestTableImages', () => {
  it('applies attachment previews, extracts names, strips runtime attributes, and builds export payloads', () => {
    const html = [
      '<table><tr><td>',
      `<ac:image data-copy-test-evidence-image-src="${IMAGE_BASE64}" data-copy-test-preview-temp="x">`,
      '<ri:attachment ri:filename="screen-a.png" />',
      '</ac:image>',
      '</td></tr></table>',
    ].join('');
    expect(getConfluenceStorageTableImageFileNames(html)).toEqual(['screen-a.png']);
    const previewHtml = applyConfluenceStorageTableImages(html, images);
    expect(previewHtml).toContain('data-copy-test-evidence-image-id');
    const payload = buildConfluenceStorageTableExportPayload(previewHtml, images);
    expect(payload.images).toEqual(images);
    expect(payload.storageHtml).not.toContain('data-copy-test-preview-temp');
    expect(payload.storageHtml).not.toContain('data-copy-test-evidence-image-src');
    expect(payload.storageHtml).toContain(`ac:width="${COPY_TEST_EVIDENCE_IMAGE_WIDTH}"`);
    expect(payload.storageHtml).toContain(`ac:height="${COPY_TEST_EVIDENCE_IMAGE_HEIGHT}"`);

    const doc = parseHtml('<p></p><img alt="x" /><image><attachment filename="screen-c.png" /></image>');
    expect(isStorageImageElement(doc.querySelector('img') as Element)).toBe(true);
    expect(isStorageImageElement(doc.querySelector('p') as Element)).toBe(false);
    expect(getConfluenceStorageTableImageFileNames(doc.body.innerHTML)).toEqual(['screen-c.png']);
  });
});
