import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CopyTestRenderer from '../CopyTestRenderer';

vi.mock('antd', () => ({
  Card: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock('@ant-design/icons', () => ({
  ArrowRightOutlined: () => <span>arrow-icon</span>,
  CheckSquareOutlined: () => <span>check-icon</span>,
}));

vi.mock('@/pages/home/components/copyTest/CopyTest', () => ({
  COPY_TEST_TRIGGER_CLASS_NAME: 'copy-test-modal-trigger',
  default: () => <div>copy-test-modal</div>,
}));

describe('CopyTestRenderer', () => {
  it('renders the launcher and no longer requires a data attribute scope', () => {
    const { container } = render(<CopyTestRenderer />);

    expect(screen.getByText('Copy Test')).toBeTruthy();
    expect(screen.getByText('Confluence validation')).toBeTruthy();
    expect(screen.getByText('copy-test-modal')).toBeTruthy();
    expect(container.querySelector('[data-copy-test-renderer-scope]')).toBeNull();
  });
});
