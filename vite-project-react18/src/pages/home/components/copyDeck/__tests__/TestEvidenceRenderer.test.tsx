import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TestEvidenceRenderer } from '../TestEvidenceRenderer';

describe('TestEvidenceRenderer', () => {
  it('should return null for empty text', () => {
    const { container } = render(<TestEvidenceRenderer text="" />);
    expect(container.firstChild).toBeNull();
  });

  it('should return null for whitespace only text', () => {
    const { container } = render(<TestEvidenceRenderer text="   " />);
    expect(container.firstChild).toBeNull();
  });

  it('should render plain text for non-JSON input', () => {
    render(<TestEvidenceRenderer text="Plain text content" />);
    expect(screen.getByText('Plain text content')).toBeInTheDocument();
  });

  it('should render empty result for empty array', () => {
    const { container } = render(<TestEvidenceRenderer text="[]" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render images for valid JSON array', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      },
      {
        fileName: 'test2.png',
        base64: 'data:image/png;base64,test2'
      }
    ];

    render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    expect(screen.getByText('Screen 01')).toBeInTheDocument();
    expect(screen.getByText('Screen 02')).toBeInTheDocument();
  });

  it('should render images in grid layout', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);
    const grid = container.querySelector('.grid.grid-cols-2');
    expect(grid).toBeInTheDocument();
  });

  it('should call onDeleteImage when delete button is clicked', () => {
    const mockDelete = vi.fn();
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    render(
      <TestEvidenceRenderer
        text={JSON.stringify(imageData)}
        onDeleteImage={mockDelete}
      />
    );

    const moreButton = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreButton);

    const deleteMenuItem = screen.getByText('Delete');
    fireEvent.click(deleteMenuItem);

    expect(mockDelete).toHaveBeenCalledWith(0);
  });

  it('should display correct screen numbers with zero padding', () => {
    const imageData = Array.from({ length: 12 }, (_, i) => ({
      fileName: `test${i + 1}.png`,
      base64: `data:image/png;base64,test${i + 1}`
    }));

    render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    expect(screen.getByText('Screen 01')).toBeInTheDocument();
    expect(screen.getByText('Screen 09')).toBeInTheDocument();
    expect(screen.getByText('Screen 12')).toBeInTheDocument();
  });

  it('should render View button for each image', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      },
      {
        fileName: 'test2.png',
        base64: 'data:image/png;base64,test2'
      }
    ];

    render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const viewButtons = screen.getAllByText('View');
    expect(viewButtons).toHaveLength(2);
  });

  it('should render images with correct src', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,test1');
  });

  it('should set correct image dimensions', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('width', '100');
    expect(img).toHaveAttribute('height', '200');
  });

  it('should handle invalid JSON gracefully', () => {
    render(<TestEvidenceRenderer text="{invalid json}" />);
    expect(screen.getByText('{invalid json}')).toBeInTheDocument();
  });

  it('should handle JSON object (non-array) as plain text', () => {
    const jsonObj = { key: 'value' };
    render(<TestEvidenceRenderer text={JSON.stringify(jsonObj)} />);
    expect(screen.getByText(JSON.stringify(jsonObj))).toBeInTheDocument();
  });

  it('should handle array with invalid items gracefully', () => {
    const invalidData = [
      { invalidKey: 'value' }
    ];

    render(<TestEvidenceRenderer text={JSON.stringify(invalidData)} />);
    // Should render as plain text since items don't have required fields
    expect(screen.getByText(JSON.stringify(invalidData))).toBeInTheDocument();
  });

  it('should display fileName in title attribute', () => {
    const imageData = [
      {
        fileName: 'very-long-filename-test.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const nameDiv = container.querySelector('[title="very-long-filename-test.png"]');
    expect(nameDiv).toBeInTheDocument();
  });

  it('should handle multiple images correctly', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      },
      {
        fileName: 'test2.png',
        base64: 'data:image/png;base64,test2'
      },
      {
        fileName: 'test3.png',
        base64: 'data:image/png;base64,test3'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(3);
  });

  it('should handle image load error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);
    const img = container.querySelector('img');

    if (img) {
      fireEvent.error(img);
    }

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should handle View button click', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const viewButton = screen.getByText('View');
    fireEvent.click(viewButton);

    // View button should be clickable
    expect(viewButton).toBeInTheDocument();
  });

  it('should render without onDeleteImage prop', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const moreButton = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreButton);

    const deleteMenuItem = screen.getByText('Delete');
    fireEvent.click(deleteMenuItem);

    // Should not throw error even without onDeleteImage
    expect(deleteMenuItem).toBeInTheDocument();
  });

  it('should handle array with items missing fileName', () => {
    const incompleteData = [{"base64": "data"}];
    render(<TestEvidenceRenderer text={JSON.stringify(incompleteData)} />);
    expect(screen.getByText(JSON.stringify(incompleteData))).toBeInTheDocument();
  });

  it('should handle array with items missing base64', () => {
    const incompleteData = [{"fileName": "test.png"}];
    render(<TestEvidenceRenderer text={JSON.stringify(incompleteData)} />);
    expect(screen.getByText(JSON.stringify(incompleteData))).toBeInTheDocument();
  });

  it('should render More button with correct icon', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);
    const moreIcon = container.querySelector('.anticon-more');
    expect(moreIcon).toBeInTheDocument();
  });

  it('should render Delete icon in dropdown menu', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);

    const moreButton = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreButton);

    const deleteOption = screen.getByText('Delete');
    expect(deleteOption).toBeInTheDocument();
  });

  it('should handle array with null items', () => {
    const dataWithNull = '[null, {"fileName": "test.png", "base64": "data"}]';
    render(<TestEvidenceRenderer text={dataWithNull} />);
    expect(screen.getByText(dataWithNull)).toBeInTheDocument();
  });

  it('should render image with Image.PreviewGroup', () => {
    const imageData = [
      {
        fileName: 'test1.png',
        base64: 'data:image/png;base64,test1'
      }
    ];

    const { container } = render(<TestEvidenceRenderer text={JSON.stringify(imageData)} />);
    const previewGroup = container.querySelector('.ant-image-preview-root, .ant-image');
    expect(previewGroup).toBeTruthy();
  });
});
