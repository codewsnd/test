import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CopyTestLoadingBlock } from '../CopyTestLoadingBlock';

vi.mock('antd', () => ({
  Spin: () => <span>spinner</span>,
}));

describe('CopyTestLoadingBlock', () => {
  it('renders spinner', () => {
    render(<CopyTestLoadingBlock />);
    expect(screen.getByText('spinner')).toBeTruthy();
  });
});
