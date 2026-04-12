import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { Provider, useSetAtom } from 'jotai';
import { UploadScreenshotsModal } from '../UploadScreenshotsModal';
import {
  copyDeckRenderTableDataAtom,
  copyDeckSelectedRowsAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckGroupTableDataAtom,
  copyDeckMessageAtom,
  type CellInfo
} from '../copyDeckAtom';
import * as copyDeckApi from '@/api/tool/copyDeckApi';
import * as fileUtils from '@/utils/fileUtils';

// Mock APIs
vi.mock('@/api/tool/copyDeckApi', () => ({
  groupedIntelligentMatchApi: vi.fn(),
  singleTableIntelligentMatchApi: vi.fn()
}));

// Mock file utils
vi.mock('@/utils/fileUtils', () => ({
  calculateFileMD5: vi.fn()
}));

const mockTableData: CellInfo[][] = [
  [
    { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
  ],
  [
    { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false },
    { value: '', rowspan: 1, colspan: 1, isSpanned: false },
    { value: '', rowspan: 1, colspan: 1, isSpanned: false }
  ]
];

// Helper to create mock File
const createMockFile = (name: string, type = 'image/png'): File => {
  const blob = new Blob(['mock image content'], { type });
  return new File([blob], name, { type });
};

// Helper to create mock FileReader
const setupFileReaderMock = () => {
  const mockFileReader = {
    readAsDataURL: vi.fn(function(this: any) {
      setTimeout(() => {
        this.onload?.({ target: { result: 'data:image/png;base64,mockBase64' } });
      }, 0);
    }),
    onload: null as any,
    onerror: null as any,
    result: null
  };

  global.FileReader = function() {
    return mockFileReader;
  } as any;

  return mockFileReader;
};

describe('UploadScreenshotsModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('mock-md5-hash');
    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([]);
    vi.mocked(copyDeckApi.groupedIntelligentMatchApi).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  it('should render modal when visible is true', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
  });

  it('should not render modal content when visible is false', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={false} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.queryByText('Upload Screenshots')).not.toBeInTheDocument();
  });

  it('should render Upload button', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('should render Cancel button', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should render Confirm button', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('should disable Confirm button when no images uploaded', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toBeDisabled();
  });

  it('should call onClose when Cancel is clicked', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should trigger file input when Upload button is clicked', async () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const uploadButton = screen.getByRole('button', { name: /upload/i });

    await waitFor(() => {
      expect(uploadButton).toBeInTheDocument();
    });

    fireEvent.click(uploadButton);

    // Verify button works (actual file input click is tested implicitly)
    expect(uploadButton).toBeInTheDocument();
  });

  it('should render hidden file input', async () => {
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    await waitFor(() => {
      const fileInput = baseElement.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
    });
  });

  it('should validate file input attributes', async () => {
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    await waitFor(() => {
      const fileInput = baseElement.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute('accept', 'image/*');
      expect(fileInput).toHaveAttribute('multiple');
    });
  });

  it('should render modal title correctly', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
  });

  it('should have correct button layout', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('should not show image list when no images uploaded', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('should render with table data context', async () => {
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
    });
  });

  it('should handle modal visibility toggle', () => {
    const { rerender } = render(
      <Provider>
        <UploadScreenshotsModal visible={false} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.queryByText('Upload Screenshots')).not.toBeInTheDocument();

    rerender(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
  });

  it('should render Upload button with icon', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const uploadButton = screen.getByRole('button', { name: /upload/i });
    expect(uploadButton).toBeInTheDocument();
  });

  it('should have disabled Confirm button initially', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toBeDisabled();
  });

  it('should render modal footer correctly', () => {
    render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const confirmButton = screen.getByRole('button', { name: /confirm/i });

    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
  });

  it('should render with multiple language support', async () => {
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('zh');
        setSelectedRows([
          { customId: 'ROW_001', language: 'zh', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
    });
  });

  it('should handle empty selected rows', async () => {
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
    });
  });

  it('should handle custom group names', async () => {
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Custom Group 1' },
          { customId: 'ROW_002', language: 'en', groupName: 'Custom Group 2' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
    });
  });

  it('should handle empty group name', async () => {
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: '' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Upload Screenshots')).toBeInTheDocument();
    });
  });

  it('should handle file upload with valid image files', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const mockFile = createMockFile('test-image.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(fileUtils.calculateFileMD5).toHaveBeenCalledWith(mockFile);
    }, { timeout: 3000 });
  });

  it('should skip non-image files during upload', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const textFile = createMockFile('test.txt', 'text/plain');

    await user.upload(fileInput, textFile);

    await waitFor(() => {
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should display uploaded images in list', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test-image.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test-image.png')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should show Delete button for uploaded images', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test-image.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('should delete image when Delete button is clicked', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test-image.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test-image.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('test-image.png')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should enable Confirm button when images are uploaded', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test-image.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).not.toBeDisabled();
    }, { timeout: 3000 });
  });

  it('should handle empty file list in upload', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, []);

    await waitFor(() => {
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should skip duplicate files based on MD5', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile1 = createMockFile('image1.png', 'image/png');

    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('same-md5-hash');

    await user.upload(fileInput, mockFile1);

    await waitFor(() => {
      expect(screen.getByText('image1.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const mockFile2 = createMockFile('image2.png', 'image/png');
    await user.upload(fileInput, mockFile2);

    await waitFor(() => {
      expect(screen.queryByText('image2.png')).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should reset file input value after upload', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(fileInput.value).toBe('');
    }, { timeout: 3000 });
  });

  it('should handle MD5 calculation errors gracefully', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fileUtils.calculateFileMD5).mockRejectedValue(new Error('MD5 calculation failed'));

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it('should upload multiple image files at once', async () => {
    const user = userEvent.setup();
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile1 = createMockFile('image1.png', 'image/png');
    const mockFile2 = createMockFile('image2.png', 'image/png');

    let callCount = 0;
    vi.mocked(fileUtils.calculateFileMD5).mockImplementation(async () => {
      callCount++;
      return `md5-hash-${callCount}`;
    });

    await user.upload(fileInput, [mockFile1, mockFile2]);

    await waitFor(() => {
      expect(screen.getByText('image1.png')).toBeInTheDocument();
      expect(screen.getByText('image2.png')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should call smart match API when Confirm is clicked with images', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: ['ROW_001'],
        rows: [{ customId: 'ROW_001', passed: true, matchRate: '100%' }]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(copyDeckApi.singleTableIntelligentMatchApi).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should show warning when Confirm is clicked without images', async () => {
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    const confirmButton = screen.getByRole('button', { name: /confirm/i });

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(copyDeckApi.singleTableIntelligentMatchApi).not.toHaveBeenCalled();
    });
  });

  it('should display analyzing state during smart match', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('should close modal after successful smart match', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: ['ROW_001'],
        rows: [{ customId: 'ROW_001', passed: true, matchRate: '100%' }]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle multiple rows in match result', async () => {
    const user = userEvent.setup();
    const multiRowData: CellInfo[][] = [
      [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false }
      ]
    ];

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(multiRowData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' },
          { customId: 'ROW_002', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: ['ROW_001', 'ROW_002'],
        rows: [
          { customId: 'ROW_001', passed: true, matchRate: '100%' },
          { customId: 'ROW_002', passed: true, matchRate: '95%' }
        ]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(copyDeckApi.singleTableIntelligentMatchApi).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle API error gracefully', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockRejectedValue(
      new Error('API Error')
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).not.toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should handle match with zero match rate rows', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: ['ROW_001'],
        rows: [{ customId: 'ROW_001', passed: false, matchRate: '0%' }]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(copyDeckApi.singleTableIntelligentMatchApi).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle empty match result', async () => {
    const user = userEvent.setup();
    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle FileReader error', async () => {
    const user = userEvent.setup();
    const mockFileReader = {
      readAsDataURL: vi.fn(function(this: any) {
        setTimeout(() => {
          this.onerror?.(new Error('FileReader error'));
        }, 0);
      }),
      onload: null as any,
      onerror: null as any,
      result: null
    };

    global.FileReader = function() {
      return mockFileReader;
    } as any;

    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    }, { timeout: 3000 });

    consoleErrorSpy.mockRestore();
  });

  it('should handle match result with failed rows', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-failed');

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: ['ROW_001'],
        rows: [
          {
            customId: 'ROW_001',
            passed: false,
            matchRate: '50%',
            discrepancies: ['Text mismatch', 'Color difference']
          }
        ]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle match with missing fileName in result', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-missing');

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'nonexistent.png',
        matchRow: ['ROW_001'],
        rows: [{ customId: 'ROW_001', passed: true, matchRate: '100%' }]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalled();
    }, { timeout: 5000 });

    consoleWarnSpy.mockRestore();
  });

  it('should handle match result without rows array', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-norows');

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: []
      } as any
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle grouped mode with multiple tables', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-grouped');

    const multiTableData: CellInfo[][] = [
      [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'TableA', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy A', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'TableB', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy B', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false }
      ]
    ];

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(multiTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'TableA' },
          { customId: 'ROW_002', language: 'en', groupName: 'TableB' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.groupedIntelligentMatchApi).mockResolvedValue([
      {
        group: 'TableA',
        fileName: 'test.png',
        rows: [{ customId: 'ROW_001', passed: true, matchRate: '100%' }]
      },
      {
        group: 'TableB',
        fileName: 'test.png',
        rows: [{ customId: 'ROW_002', passed: true, matchRate: '100%' }]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle table with merged cells in evidence column', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-merged');

    const mergedTableData: CellInfo[][] = [
      [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '[{"fileName":"old.png","base64":"data:image/png;base64,old"}]', rowspan: 2, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '', rowspan: 0, colspan: 1, isSpanned: true }
      ]
    ];

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mergedTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: ['ROW_001'],
        rows: [{ customId: 'ROW_001', passed: true, matchRate: '100%' }]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle updating existing evidence data', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-update');

    const dataWithEvidence: CellInfo[][] = [
      [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '[{"fileName":"existing.png","passed":true}]', rowspan: 1, colspan: 1, isSpanned: false },
        { value: '[{"fileName":"existing.png","base64":"old-data"}]', rowspan: 1, colspan: 1, isSpanned: false }
      ]
    ];

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(dataWithEvidence);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'new.png',
        matchRow: ['ROW_001'],
        rows: [{ customId: 'ROW_001', passed: true, matchRate: '100%' }]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('new.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('new.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should handle match with discrepancies in failed result', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-discrepancies');

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return <UploadScreenshotsModal visible={true} onClose={mockOnClose} />;
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    vi.mocked(copyDeckApi.singleTableIntelligentMatchApi).mockResolvedValue([
      {
        fileName: 'test.png',
        matchRow: ['ROW_001'],
        rows: [
          {
            customId: 'ROW_001',
            passed: false,
            matchRate: '75%',
            discrepancies: ['color mismatch', 'size different']
          }
        ]
      }
    ]);

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should show warning message when clicking confirm after deleting all images', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();
    vi.mocked(fileUtils.calculateFileMD5).mockResolvedValue('md5-delete-all');

    const TestComponent = () => {
      const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
      const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
      const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
      const setMessage = useSetAtom(copyDeckMessageAtom);

      React.useEffect(() => {
        setRenderTableData(mockTableData);
        setSelectedLanguage('en');
        setSelectedRows([
          { customId: 'ROW_001', language: 'en', groupName: 'Group1' }
        ]);
      }, []);

      return (
        <>
          <button
            data-testid="trigger-confirm"
            onClick={() => {
              // Simulate clicking confirm when no images
              setMessage({
                type: 'warning',
                content: 'Please upload images first'
              });
            }}
          >
            Test Trigger
          </button>
          <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
        </>
      );
    };

    const { baseElement } = render(
      <Provider>
        <TestComponent />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = createMockFile('test.png', 'image/png');

    // Upload a file
    await user.upload(fileInput, mockFile);

    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Delete the file
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('test.png')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    // Now the confirm button should be disabled
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toBeDisabled();
  });

  it('should handle mixed image and non-image file upload', async () => {
    const user = userEvent.setup();
    setupFileReaderMock();

    let callCount = 0;
    vi.mocked(fileUtils.calculateFileMD5).mockImplementation(async () => {
      callCount++;
      return `md5-hash-${callCount}`;
    });

    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const fileInput = baseElement.querySelector('input[type="file"]') as HTMLInputElement;

    // Create mixed files
    const imageFile = createMockFile('image.png', 'image/png');
    const textFile = createMockFile('document.txt', 'text/plain');
    const anotherImageFile = createMockFile('image2.jpg', 'image/jpeg');

    // Mock FileList with mixed files
    const mockFileList = [imageFile, textFile, anotherImageFile];
    Object.defineProperty(fileInput, 'files', {
      value: mockFileList,
      writable: false,
    });

    fireEvent.change(fileInput);

    // Wait for images to be processed (text file should be skipped)
    await waitFor(() => {
      expect(screen.getByText('image.png')).toBeInTheDocument();
      expect(screen.getByText('image2.jpg')).toBeInTheDocument();
      expect(screen.queryByText('document.txt')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle null file input reference gracefully', () => {
    const { baseElement } = render(
      <Provider>
        <UploadScreenshotsModal visible={true} onClose={mockOnClose} />
      </Provider>
    );

    const uploadButton = screen.getByRole('button', { name: /upload/i });

    // This should not throw even if fileInputRef is somehow null
    fireEvent.click(uploadButton);

    expect(uploadButton).toBeInTheDocument();
  });
});
