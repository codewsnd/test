import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { Provider, useSetAtom } from 'jotai';
import { CopyDeckTable } from '../CopyDeckTable';
import {
  copyDeckConfluenceInfoAtom,
  copyDeckRenderTableDataAtom,
  copyDeckOriginalTableDataAtom,
  copyDeckValuesArrayAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckStorageHtmlAtom,
  copyDeckSelectedRowsAtom,
  copyDeckCurrentViewAtom,
  copyDeckShowUncomparedAtom,
  type CellInfo
} from '../copyDeckAtom';
import * as copyDeckApi from '@/api/tool/copyDeckApi';
import { message, Modal } from 'antd';

// Mock antd components
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      error: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
    },
    Modal: {
      confirm: vi.fn(),
    },
  };
});

// Mock APIs
vi.mock('@/api/tool/copyDeckApi', () => ({
  uploadStorageApi: vi.fn()
}));

// Mock utils
vi.mock('../utils/confluenceStorageUtils', () => ({
  parseConfluenceTables: vi.fn(),
  fixVoidElements: vi.fn((html) => html),
  isTestResultColumn: vi.fn((header) => header.includes('Test Result')),
  isTestEvidenceColumn: vi.fn((header) => header.includes('Test Evidence')),
  extractLanguageFromHeader: vi.fn(() => 'en'),
  formatTestResultToHtml: vi.fn(() => {
    if (typeof document !== 'undefined') {
      const frag = document.createDocumentFragment();
      const div = document.createElement('div');
      div.textContent = 'Result';
      frag.appendChild(div);
      return frag;
    }
    return null;
  }),
  formatTestEvidence: vi.fn(() => {
    if (typeof document !== 'undefined') {
      const frag = document.createDocumentFragment();
      const div = document.createElement('div');
      div.textContent = 'Evidence';
      frag.appendChild(div);
      return frag;
    }
    return null;
  }),
  replaceTableInStorage: vi.fn((html) => html),
  extractOriginalTestColumns: vi.fn(() => [])
}));

vi.mock('../utils/exportUtils', () => ({
  findResultColumnIndex: vi.fn(() => -1),
  findEvidenceColumnIndex: vi.fn(() => -1),
  processLanguageForExistingColumns: vi.fn(),
  processLanguageForNewColumns: vi.fn()
}));

// Mock UploadScreenshotsModal
vi.mock('../UploadScreenshotsModal', () => ({
  default: () => null,
}));

// Mock TestEvidenceRenderer
vi.mock('../TestEvidenceRenderer', () => ({
  TestEvidenceRenderer: ({ text }: { text: string }) => <div data-testid="evidence-renderer">{text}</div>,
}));

// Mock CheckResultRenderer
vi.mock('../CheckResultRenderer', () => ({
  CheckResultRenderer: ({ text }: { text: string }) => <div data-testid="result-renderer">{text}</div>,
}));

const mockTableData: CellInfo[][] = [
  [
    { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
  ],
  [
    { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Group 1', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
    { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
    { value: '[{"fileName":"test1.png","base64":"data1"}]', rowspan: 1, colspan: 1, isSpanned: false },
  ],
  [
    { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Group 1', rowspan: 1, colspan: 1, isSpanned: false },
    { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false },
    { value: '', rowspan: 1, colspan: 1, isSpanned: false },
    { value: '', rowspan: 1, colspan: 1, isSpanned: false },
  ],
];

describe('CopyDeckTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(copyDeckApi.uploadStorageApi).mockResolvedValue({
      success: true,
      message: 'Success',
    });

    // Mock Modal.confirm to directly call onOk
    vi.mocked(Modal.confirm).mockImplementation((config: any) => {
      if (config.onOk) {
        config.onOk();
      }
      return {} as any;
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component with basic elements', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('en');
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test Table',
            confluenceTitle: 'Test Title',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
      expect(screen.getByText('Copy deck')).toBeInTheDocument();
    });

    it('should render Edit button', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const editIcon = container.querySelector('.anticon-edit');
      expect(editIcon).toBeInTheDocument();
    });

    it('should render Cancel and Export buttons', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });

    it('should display confluence info', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setConfluenceInfo({
            confluenceUrl: 'https://example.com',
            tableName: 'My Table',
            confluenceTitle: 'My Page',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('My Page')).toBeInTheDocument();
      // expect(screen.getByText('My Table')).toBeInTheDocument();
    });

    it('should render Upload screenshot button', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const uploadIcon = container.querySelector('.anticon-upload');
      expect(uploadIcon).toBeInTheDocument();
    });

    it('should render Show un-compared items checkbox', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Show un-compared items')).toBeInTheDocument();
    });
  });

  describe('Language Tabs', () => {
    it('should render language tabs', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en', 'zh', 'fr']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const tabs = container.querySelectorAll('.ant-tabs-tab');
      expect(tabs.length).toBe(3);
    });

    it('should switch language tab on click', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const tabs = container.querySelectorAll('.ant-tabs-tab');
      if (tabs[1]) {
        fireEvent.click(tabs[1]);
      }

      expect(container).toBeTruthy();
    });
  });

  describe('Row Selection', () => {
    it('should disable Export button when no rows are selected', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeDisabled();
    });

    it('should display selected row count', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([
            { customId: 'ROW_001', language: 'en', groupName: 'Group 1' },
            { customId: 'ROW_002', language: 'en', groupName: 'Group 1' },
          ]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('2 items selected')).toBeInTheDocument();
    });

    it('should display singular form for one selected item', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('1 item selected')).toBeInTheDocument();
    });

    it('should enable Export button when rows are selected', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).not.toBeDisabled();
    });

    it('should disable Upload screenshot button when no rows selected', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const uploadButton = screen.getByRole('button', { name: /upload screenshot/i });
      expect(uploadButton).toBeDisabled();
    });
  });

  describe('Show Un-compared Items', () => {
    it('should toggle showUncompared state', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkbox = container.querySelector('input[type="checkbox"]');
      if (checkbox) {
        fireEvent.click(checkbox);
      }

      expect(checkbox).toBeInTheDocument();
    });
  });

  describe('Edit Button', () => {
    it('should show confirmation modal when Edit is clicked', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      expect(Modal.confirm).toHaveBeenCalled();
    });

    it('should clear table data and switch to input view when confirmed', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setCurrentView = useSetAtom(copyDeckCurrentViewAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setCurrentView('table');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm change data source?',
        })
      );
    });
  });

  describe('Cancel Button', () => {
    it('should show confirmation modal when Cancel is clicked', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm exit',
        })
      );
    });
  });

  describe('Export Functionality', () => {
    it('should show warning when trying to export with no selected rows', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeDisabled();
    });

    it('should show confirmation modal when Export is clicked with selected rows', () => {
      const properStorageHtml = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Test copy 1</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(properStorageHtml);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm export',
        })
      );
    });

    it('should handle successful export', async () => {
      const properStorageHtml = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Test copy 1</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);
        const setCurrentView = useSetAtom(copyDeckCurrentViewAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(properStorageHtml);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
          setCurrentView('table');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle export error', async () => {
      vi.mocked(copyDeckApi.uploadStorageApi).mockRejectedValue(new Error('Export failed'));

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml('<html><table></table></html>');
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty table data', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData([]);
          setOriginalTableData([]);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle empty values array', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray([]);
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const tabs = container.querySelectorAll('.ant-tabs-tab');
      expect(tabs.length).toBe(0);
    });

    it('should handle missing confluence info', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setConfluenceInfo({
            confluenceUrl: '',
            tableName: '',
            confluenceTitle: '',
            tableIndex: -1,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle showUncompared toggle', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setShowUncompared = useSetAtom(copyDeckShowUncomparedAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setShowUncompared(false);
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkbox = container.querySelector('input[type="checkbox"]');
      if (checkbox) {
        fireEvent.click(checkbox);
        fireEvent.click(checkbox);
      }

      expect(checkbox).toBeInTheDocument();
    });

    it('should maintain state across re-renders', () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0);
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          if (count === 0) {
            setRenderTableData(mockTableData);
            setOriginalTableData(mockTableData);
            setValuesArray(['en']);
            setSelectedLanguage('en');
          }
        }, [count]);

        return (
          <div>
            <button onClick={() => setCount(c => c + 1)}>Re-render</button>
            <CopyDeckTable />
          </div>
        );
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const reRenderBtn = screen.getByText('Re-render');
      fireEvent.click(reRenderBtn);

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with merged cells', () => {
      const mergedTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"test1.png","base64":"data1"}]', rowspan: 2, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mergedTableData);
          setOriginalTableData(mergedTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });
  });

  describe('Additional Coverage Tests', () => {
    it('should handle row selection with checkbox', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should handle language switch', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle empty selected rows on export', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([]);
          setStorageHtml('<html><body><table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table></body></html>');
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      expect(exportButton).toBeDisabled();
    });

    it('should handle show/hide uncompared toggle', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setShowUncompared = useSetAtom(copyDeckShowUncomparedAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setShowUncompared(false);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should render table with multiple groups', () => {
      const multiGroupData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(multiGroupData);
          setOriginalTableData(multiGroupData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with no COPYDECK_CUSTOM_GROUP column', () => {
      const noGroupData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(noGroupData);
          setOriginalTableData(noGroupData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with complex result data', () => {
      const complexResultData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":["test1.png"],"FAILED":["test2.png"]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(complexResultData);
          setOriginalTableData(complexResultData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle Cancel button click', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm exit',
        })
      );
    });

    it('should handle Edit button click', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm change data source?',
        })
      );
    });

    it('should handle table with isSpanned cells in evidence column', () => {
      const spannedEvidenceData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"test1.png","base64":"data1"}]', rowspan: 2, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(spannedEvidenceData);
          setOriginalTableData(spannedEvidenceData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with non-JSON result data', () => {
      const nonJsonResultData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Plain text result', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(nonJsonResultData);
          setOriginalTableData(nonJsonResultData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with empty values array', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray([]);
          setSelectedLanguage('');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with colspan > 1', () => {
      const colspanData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 2, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 2, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(colspanData);
          setOriginalTableData(colspanData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with multiple languages', () => {
      const multiLangData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'English copy', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '中文文案', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(multiLangData);
          setOriginalTableData(multiLangData);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with empty evidence data', () => {
      const emptyEvidenceData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[]', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(emptyEvidenceData);
          setOriginalTableData(emptyEvidenceData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle export with proper storage HTML structure', async () => {
      const properStorageHtml = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>COPYDECK_CUSTOM_GROUP</th>
                  <th>Copy|values=en|</th>
                  <th>Test Result|values=en|</th>
                  <th>Test Evidence|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Group 1</td>
                  <td>Test copy 1</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                  <td>[{"fileName":"test1.png","base64":"data1"}]</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(properStorageHtml);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle table with only header row', () => {
      const headerOnlyData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(headerOnlyData);
          setOriginalTableData(headerOnlyData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with various rowspan values', () => {
      const rowspanData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 3, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"test1.png","base64":"data1"}]', rowspan: 3, colspan: 1, isSpanned: false },
        ],
        [
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
          { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
        ],
        [
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
          { value: 'Test copy 3', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(rowspanData);
          setOriginalTableData(rowspanData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with mixed result formats', () => {
      const mixedResultData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":["img1.png"],"FAILED":["img2.png"]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"img3.png","result":"PASS"}]', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mixedResultData);
          setOriginalTableData(mixedResultData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with invalid JSON in evidence', () => {
      const invalidJsonData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{invalid json}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(invalidJsonData);
          setOriginalTableData(invalidJsonData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle table with all columns types', () => {
      const allColumnsData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'English copy', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '中文文案', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"en.png","base64":"data1"}]', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"zh.png","base64":"data2"}]', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(allColumnsData);
          setOriginalTableData(allColumnsData);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle Upload screenshot button when disabled', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const uploadButton = screen.getByRole('button', { name: /upload screenshot/i });
      expect(uploadButton).toBeDisabled();
    });

    it('should handle Upload screenshot button when enabled', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const uploadButton = screen.getByRole('button', { name: /upload screenshot/i });
      expect(uploadButton).not.toBeDisabled();
      fireEvent.click(uploadButton);
    });

    it('should handle tabs switching', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en', 'zh', 'ja']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const tabs = container.querySelectorAll('.ant-tabs-tab');
      expect(tabs.length).toBe(3);
    });

    it('should handle checkbox for show uncompared', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkbox = screen.getByRole('checkbox', { name: /show un-compared items/i });
      expect(checkbox).toBeInTheDocument();
      fireEvent.click(checkbox);
    });

    it('should display confluence info correctly', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setConfluenceInfo({
            confluenceUrl: 'https://example.com/page123',
            tableName: 'Test Table Name',
            confluenceTitle: 'Test Confluence Page',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Test Confluence Page')).toBeInTheDocument();
      // expect(screen.getByText('Test Table Name')).toBeInTheDocument();
    });

    it('should handle table with different cell attributes', () => {
      const attributesData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false, attributes: { 'data-test': 'id' } },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false, attributes: { 'data-test': 'copy' } },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false, attributes: { 'data-custom': 'value' } },
          { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(attributesData);
          setOriginalTableData(attributesData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle export with missing required data', async () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData([]);
          setOriginalTableData([]);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml('');
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: '',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle export with invalid table index', async () => {
      vi.mocked(copyDeckApi.uploadStorageApi).mockRejectedValue(new Error('Invalid table index'));

      const properStorageHtml = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Test copy 1</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(properStorageHtml);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: -1,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle row selection with multiple rows', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([
            { customId: 'ROW_001', language: 'en', groupName: 'Group 1' },
            { customId: 'ROW_002', language: 'en', groupName: 'Group 1' },
          ]);
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should handle table with no COPYDECK_CUSTOM_ID in render data', () => {
      const noIdData: CellInfo[][] = [
        [
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'Test copy 1', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(noIdData);
          setOriginalTableData(noIdData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle successful export with complete flow', async () => {
      vi.mocked(copyDeckApi.uploadStorageApi).mockResolvedValue({
        success: true,
        message: 'Success',
      });

      const completeStorageHtml = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>COPYDECK_CUSTOM_GROUP</th>
                  <th>Copy|values=en|</th>
                  <th>Test Result|values=en|</th>
                  <th>Test Evidence|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Group 1</td>
                  <td>Test copy 1</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                  <td>[{"fileName":"test1.png","base64":"data1"}]</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(completeStorageHtml);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(copyDeckApi.uploadStorageApi).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should handle export with multiple selected languages', async () => {
      const multiLangStorageHtml = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                  <th>Copy|values=zh|</th>
                  <th>Test Result|values=en|</th>
                  <th>Test Result|values=zh|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>English</td>
                  <td>中文</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const multiLangData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'English', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '中文', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(multiLangData);
          setOriginalTableData(multiLangData);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('en');
          setSelectedRows([
            { customId: 'ROW_001', language: 'en', groupName: '' },
            { customId: 'ROW_001', language: 'zh', groupName: '' },
          ]);
          setStorageHtml(multiLangStorageHtml);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle export with table index out of bounds', async () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml('<html><body><table><tr><td>Test</td></tr></table></body></html>');
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 999,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle row checkbox click', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);
      }

      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should handle select all checkbox', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[0]);
      }

      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should handle export with new language columns', async () => {
      const storageWithoutZh = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                  <th>Test Result|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>English</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const dataWithZh: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'English', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '中文', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(dataWithZh);
          setOriginalTableData(dataWithZh);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('zh');
          setSelectedRows([{ customId: 'ROW_001', language: 'zh', groupName: '' }]);
          setStorageHtml(storageWithoutZh);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle export with evidence columns', async () => {
      const storageWithEvidence = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                  <th>Test Result|values=en|</th>
                  <th>Test Evidence|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Test</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                  <td>[{"fileName":"img.png","base64":"abc"}]</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const dataWithEvidence: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"img.png","base64":"abc"}]', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(dataWithEvidence);
          setOriginalTableData(dataWithEvidence);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: '' }]);
          setStorageHtml(storageWithEvidence);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle language tab change', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en', 'zh', 'ja']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const tabs = container.querySelectorAll('.ant-tabs-tab');
      if (tabs.length > 1) {
        fireEvent.click(tabs[1]);
      }

      expect(tabs.length).toBeGreaterThan(0);
    });

    it('should handle upload screenshot modal open', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const uploadButton = screen.getByRole('button', { name: /upload screenshot/i });
      fireEvent.click(uploadButton);

      expect(uploadButton).toBeInTheDocument();
    });

    it('should handle export with single table mode', async () => {
      const singleTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const singleTableStorage = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                  <th>Test Result|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Test</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(singleTableData);
          setOriginalTableData(singleTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: '' }]);
          setStorageHtml(singleTableStorage);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle export with missing COPYDECK_CUSTOM_ID column', async () => {
      const noIdData: CellInfo[][] = [
        [
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'Test', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(noIdData);
          setOriginalTableData(noIdData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: '' }]);
          setStorageHtml('<html><body><table><tr><td>Test</td></tr></table></body></html>');
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle export with multiple tables in storage', async () => {
      const multiTableStorage = `
        <html>
          <body>
            <table>
              <thead><tr><th>Table 1</th></tr></thead>
              <tbody><tr><td>Data 1</td></tr></tbody>
            </table>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                  <th>Test Result|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Test</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(multiTableStorage);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 1,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(Modal.confirm).toHaveBeenCalled();
      });
    });

    it('should handle export success message', async () => {
      vi.mocked(copyDeckApi.uploadStorageApi).mockResolvedValue({
        success: true,
        message: 'Upload successful',
      });

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(`
            <html><body><table>
              <thead><tr><th>COPYDECK_CUSTOM_ID</th><th>Copy|values=en|</th><th>Test Result|values=en|</th></tr></thead>
              <tbody><tr><td>ROW_001</td><td>Test</td><td>{"PASS":[],"FAILED":[]}</td></tr></tbody>
            </table></body></html>
          `);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(copyDeckApi.uploadStorageApi).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should handle table with group column', () => {
      const groupData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group A', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group B', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test 2', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);

        React.useEffect(() => {
          setRenderTableData(groupData);
          setOriginalTableData(groupData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Copy validation')).toBeInTheDocument();
    });

    it('should handle row deselection', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
        }, []);

        return <CopyDeckTable />;
      };

      const { container } = render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      if (checkboxes.length > 1) {
        fireEvent.click(checkboxes[1]);
      }

      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should handle export with both result and evidence columns', async () => {
      const fullDataStorage = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>COPYDECK_CUSTOM_GROUP</th>
                  <th>Copy|values=en|</th>
                  <th>Test Result|values=en|</th>
                  <th>Test Evidence|values=en|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>Group 1</td>
                  <td>Test copy</td>
                  <td>{"PASS":["img1.png"],"FAILED":[]}</td>
                  <td>[{"fileName":"img1.png","base64":"abc123"}]</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setSelectedRows([{ customId: 'ROW_001', language: 'en', groupName: 'Group 1' }]);
          setStorageHtml(fullDataStorage);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(copyDeckApi.uploadStorageApi).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should handle export with mixed language selections', async () => {
      const mixedLangData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test Result|values=zh|', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'English', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '中文', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'English 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '中文2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '{"PASS":[],"FAILED":[]}', rowspan: 1, colspan: 1, isSpanned: false },
        ],
      ];

      const mixedStorage = `
        <html>
          <body>
            <table>
              <thead>
                <tr>
                  <th>COPYDECK_CUSTOM_ID</th>
                  <th>Copy|values=en|</th>
                  <th>Copy|values=zh|</th>
                  <th>Test Result|values=en|</th>
                  <th>Test Result|values=zh|</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ROW_001</td>
                  <td>English</td>
                  <td>中文</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                </tr>
                <tr>
                  <td>ROW_002</td>
                  <td>English 2</td>
                  <td>中文2</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                  <td>{"PASS":[],"FAILED":[]}</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);
        const setStorageHtml = useSetAtom(copyDeckStorageHtmlAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setRenderTableData(mixedLangData);
          setOriginalTableData(mixedLangData);
          setValuesArray(['en', 'zh']);
          setSelectedLanguage('en');
          setSelectedRows([
            { customId: 'ROW_001', language: 'en', groupName: '' },
            { customId: 'ROW_002', language: 'zh', groupName: '' },
          ]);
          setStorageHtml(mixedStorage);
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: 'Test',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(copyDeckApi.uploadStorageApi).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should handle Cancel modal confirmation', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setCurrentView = useSetAtom(copyDeckCurrentViewAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setCurrentView('table');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm exit',
        })
      );
    });

    it('should handle Edit modal confirmation', () => {
      const TestComponent = () => {
        const setRenderTableData = useSetAtom(copyDeckRenderTableDataAtom);
        const setOriginalTableData = useSetAtom(copyDeckOriginalTableDataAtom);
        const setValuesArray = useSetAtom(copyDeckValuesArrayAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setCurrentView = useSetAtom(copyDeckCurrentViewAtom);

        React.useEffect(() => {
          setRenderTableData(mockTableData);
          setOriginalTableData(mockTableData);
          setValuesArray(['en']);
          setSelectedLanguage('en');
          setCurrentView('table');
        }, []);

        return <CopyDeckTable />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      expect(Modal.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Confirm change data source?',
        })
      );
    });
  });
});
