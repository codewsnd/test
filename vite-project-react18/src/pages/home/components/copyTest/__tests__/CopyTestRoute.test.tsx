import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CopyTestRoute from '../CopyTestRoute';

const hoisted = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router', () => ({ useNavigate: () => hoisted.navigate }));
vi.mock('../CopyTest', () => ({
  default: ({ onClose, open }: { onClose: () => void; open: boolean }) => open ? <button onClick={onClose}>copy-test-modal</button> : null,
}));

describe('CopyTestRoute', () => {
  it('renders background text and navigates back to chat on close', () => {
    render(<CopyTestRoute />);
    expect(screen.getByText('Copy Test is open in the modal.')).toBeTruthy();
    fireEvent.click(screen.getByText('copy-test-modal'));
    expect(hoisted.navigate).toHaveBeenCalledWith('/chat');
  });
});
