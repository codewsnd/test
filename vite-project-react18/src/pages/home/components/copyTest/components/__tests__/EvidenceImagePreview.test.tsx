import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvidenceImagePreview } from '../EvidenceImagePreview';

vi.mock('antd', () => ({
  Image: ({ alt, preview, src }: { alt?: string; preview?: { onVisibleChange?: (visible: boolean) => void }; src?: string }) => (
    <button data-src={src} onClick={() => preview?.onVisibleChange?.(false)}>{alt}</button>
  ),
}));

describe('EvidenceImagePreview', () => {
  it('renders only when preview image exists and closes on visibility change', () => {
    const onClose = vi.fn();
    const { rerender } = render(<EvidenceImagePreview previewImage={null} onClose={onClose} />);
    expect(screen.queryByText('Screenshot preview')).toBeNull();
    rerender(<EvidenceImagePreview previewImage={{ alt: '', imageId: 'img', src: 'src' }} onClose={onClose} />);
    fireEvent.click(screen.getByText('Screenshot preview'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
