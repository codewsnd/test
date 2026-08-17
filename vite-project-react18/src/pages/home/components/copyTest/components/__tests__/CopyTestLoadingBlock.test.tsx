import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyTestLoadingBlock } from '../CopyTestLoadingBlock';

vi.mock('antd', () => ({
  Spin: () => <span>spinner</span>,
}));

describe('CopyTestLoadingBlock', () => {
  it('renders a spinner with an explicit loading stage', () => {
    render(<CopyTestLoadingBlock />);
    expect(screen.getByText('spinner')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Loading Confluence tables...');
  });

  it('describes Comparison Column attachment loading', () => {
    render(<CopyTestLoadingBlock label="Loading Test Evidence attachments..." />);
    expect(screen.getByRole('status').textContent).toContain(
      'Loading Test Evidence attachments...'
    );
  });
});
