import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CopyTestDisplayConfiguration } from '../CopyTestDisplayConfiguration';
import { DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION } from '../../types';

const Configuration = ({ disabled = false }: { disabled?: boolean }) => {
  const [value, onChange] = useState(DEFAULT_COPY_TEST_DISPLAY_CONFIGURATION);
  return <CopyTestDisplayConfiguration disabled={disabled} value={value} onChange={onChange} />;
};

describe('CopyTest display configuration controls', () => {
  it('defaults to Add and Single-image and allows independent changes', () => {
    render(<Configuration />);
    expect(screen.getByRole('radio', { name: 'Add' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Single-image' })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('radio', { name: 'Replace' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Multi-images' }));
    expect(screen.getByRole('radio', { name: 'Replace' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Multi-images' })).toHaveProperty('checked', true);
    expect(screen.getByRole('button', { name: 'About display configuration' })).toBeTruthy();
    expect(screen.getByLabelText('Test Evidence update mode').contains(screen.getByRole('radio', { name: 'Replace' }))).toBe(true);
    expect(screen.getByLabelText('Test Evidence image count').contains(screen.getByRole('radio', { name: 'Multi-images' }))).toBe(true);
  });

  it('locks both groups while preparing or validating', () => {
    render(<Configuration disabled />);
    screen.getAllByRole('radio').forEach(radio => expect(radio).toHaveProperty('disabled', true));
  });
});
