import { describe, expect, it } from 'vitest';
import * as componentExports from '../index';

describe('copyTest component exports', () => {
  it('exports all display components', () => {
    expect(componentExports.CopyTestImportBar).toBeTruthy();
    expect(componentExports.CopyTestLoadingBlock).toBeTruthy();
    expect(componentExports.CopyTestSelectors).toBeTruthy();
    expect(componentExports.EvidenceImagePreview).toBeTruthy();
    expect(componentExports.TablePreview).toBeTruthy();
    expect(componentExports.UploadScreenshotModal).toBeTruthy();
  });
});
