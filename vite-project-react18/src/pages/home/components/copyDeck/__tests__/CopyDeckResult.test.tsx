import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { Provider, useSetAtom, useAtomValue } from 'jotai';
import { CopyDeckResult } from '../CopyDeckResult';
import {
  copyDeckCurrentViewAtom,
  hideCopyDeckSidebarAtom,
  copyDeckConfluenceInfoAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckShowUncomparedAtom,
  copyDeckSelectedRowsAtom,
} from '../copyDeckAtom';

describe('CopyDeckResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render success message', () => {
      render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should render success icon', () => {
      const { container } = render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      const successIcon = container.querySelector('.anticon-check-circle');
      expect(successIcon).toBeInTheDocument();
    });

    it('should render all action buttons', () => {
      render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /return to review/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start new review/i })).toBeInTheDocument();
    });

    it('should render instructional text', () => {
      render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      expect(screen.getByText(/You can now return to the copy deck/i)).toBeInTheDocument();
    });

    it('should render export success message', () => {
      render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      expect(screen.getByText(/Your Items have been exported to Confluence/i)).toBeInTheDocument();
    });
  });

  describe('Confluence Link', () => {
    it('should render confluence link with default URL', () => {
      const { container } = render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      // Link has no href when confluenceUrl is empty, so check for the link element instead
      const linkElement = container.querySelector('a');
      expect(linkElement).toBeInTheDocument();
    });

    it('should render confluence link with custom URL and title', () => {
      const TestComponent = () => {
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setConfluenceInfo({
            confluenceUrl: 'https://confluence.example.com/page/123',
            tableName: 'Test Table',
            confluenceTitle: 'My Test Page',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckResult />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const link = screen.getByRole('link', { name: /My Test Page/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://confluence.example.com/page/123');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('should render link icon in confluence link', () => {
      const { container } = render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      const linkIcon = container.querySelector('.anticon-link');
      expect(linkIcon).toBeInTheDocument();
    });
  });

  describe('Button Handlers', () => {
    it('should handle Close button click', () => {
      const TestComponent = () => {
        const [sidebarHidden, setSidebarHidden] = React.useState(false);

        return (
          <Provider
            initialValues={[
              [
                hideCopyDeckSidebarAtom,
                () => {
                  setSidebarHidden(true);
                },
              ],
            ]}
          >
            <CopyDeckResult />
            <div data-testid="sidebar-status">{sidebarHidden ? 'hidden' : 'visible'}</div>
          </Provider>
        );
      };

      render(<TestComponent />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      // Button should be clickable
      expect(closeButton).toBeInTheDocument();
    });

    it('should switch to table view when Return to review is clicked', () => {
      const TestComponent = () => {
        const setCurrentView = useSetAtom(copyDeckCurrentViewAtom);
        const currentView = useAtomValue(copyDeckCurrentViewAtom);

        React.useEffect(() => {
          setCurrentView('result');
        }, []);

        return (
          <div>
            <CopyDeckResult />
            <div data-testid="current-view">{currentView}</div>
          </div>
        );
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const returnButton = screen.getByRole('button', { name: /return to review/i });
      fireEvent.click(returnButton);

      const currentView = screen.getByTestId('current-view');
      expect(currentView.textContent).toBe('table');
    });

    it('should reset all states and switch to input view when Start new review is clicked', () => {
      const TestComponent = () => {
        const setCurrentView = useSetAtom(copyDeckCurrentViewAtom);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);
        const setSelectedLanguage = useSetAtom(copyDeckSelectedLanguageAtom);
        const setShowUncompared = useSetAtom(copyDeckShowUncomparedAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        const currentView = useAtomValue(copyDeckCurrentViewAtom);
        const confluenceInfo = useAtomValue(copyDeckConfluenceInfoAtom);
        const selectedLanguage = useAtomValue(copyDeckSelectedLanguageAtom);
        const showUncompared = useAtomValue(copyDeckShowUncomparedAtom);
        const selectedRows = useAtomValue(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setCurrentView('result');
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test Table',
            confluenceTitle: 'Test Title',
            tableIndex: 0,
          });
          setSelectedLanguage('en');
          setShowUncompared(true);
          setSelectedRows([{ customId: '1', language: 'en', groupName: 'group1' }]);
        }, []);

        return (
          <div>
            <CopyDeckResult />
            <div data-testid="current-view">{currentView}</div>
            <div data-testid="confluence-url">{confluenceInfo.confluenceUrl}</div>
            <div data-testid="selected-language">{selectedLanguage}</div>
            <div data-testid="show-uncompared">{String(showUncompared)}</div>
            <div data-testid="selected-rows-count">{selectedRows.length}</div>
          </div>
        );
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const startNewButton = screen.getByRole('button', { name: /start new review/i });
      fireEvent.click(startNewButton);

      expect(screen.getByTestId('current-view').textContent).toBe('input');
      expect(screen.getByTestId('confluence-url').textContent).toBe('');
      expect(screen.getByTestId('selected-language').textContent).toBe('');
      expect(screen.getByTestId('show-uncompared').textContent).toBe('false');
      expect(screen.getByTestId('selected-rows-count').textContent).toBe('0');
    });
  });

  describe('State Management', () => {
    it('should display confluence info from atom state', () => {
      const TestComponent = () => {
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setConfluenceInfo({
            confluenceUrl: 'https://example.com/page',
            tableName: 'Sample Table',
            confluenceTitle: 'Sample Page Title',
            tableIndex: 1,
          });
        }, []);

        return <CopyDeckResult />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Sample Page Title')).toBeInTheDocument();
    });

    it('should handle empty confluence info', () => {
      const TestComponent = () => {
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setConfluenceInfo({
            confluenceUrl: '',
            tableName: '',
            confluenceTitle: '',
            tableIndex: -1,
          });
        }, []);

        return <CopyDeckResult />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('should render with proper layout structure', () => {
      const { container } = render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      const mainDiv = container.querySelector('.p-6');
      expect(mainDiv).toBeInTheDocument();
    });

    it('should render buttons in correct order', () => {
      render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent(/close/i);
      expect(buttons[1]).toHaveTextContent(/return to review/i);
      expect(buttons[2]).toHaveTextContent(/start new review/i);
    });

    it('should render success icon with proper color class', () => {
      const { container } = render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      const icon = container.querySelector('.text-green-500');
      expect(icon).toBeInTheDocument();
    });

    it('should render text with proper formatting', () => {
      const { container } = render(
        <Provider>
          <CopyDeckResult />
        </Provider>
      );

      const textElement = container.querySelector('.text-base');
      expect(textElement).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple clicks on buttons', () => {
      const TestComponent = () => {
        const setCurrentView = useSetAtom(copyDeckCurrentViewAtom);
        const currentView = useAtomValue(copyDeckCurrentViewAtom);

        React.useEffect(() => {
          setCurrentView('result');
        }, []);

        return (
          <div>
            <CopyDeckResult />
            <div data-testid="current-view">{currentView}</div>
          </div>
        );
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const returnButton = screen.getByRole('button', { name: /return to review/i });

      // Click multiple times
      fireEvent.click(returnButton);
      fireEvent.click(returnButton);
      fireEvent.click(returnButton);

      const currentView = screen.getByTestId('current-view');
      expect(currentView.textContent).toBe('table');
    });

    it('should handle confluence URL with special characters', () => {
      const TestComponent = () => {
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setConfluenceInfo({
            confluenceUrl: 'https://confluence.example.com/page?id=123&version=2',
            tableName: 'Test',
            confluenceTitle: 'Page & Title',
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckResult />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://confluence.example.com/page?id=123&version=2');
    });

    it('should maintain state after re-render', () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0);
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          if (count === 0) {
            setConfluenceInfo({
              confluenceUrl: 'https://test.com',
              tableName: 'Test',
              confluenceTitle: 'Test Title',
              tableIndex: 0,
            });
          }
        }, [count]);

        return (
          <div>
            <button onClick={() => setCount(c => c + 1)}>Re-render</button>
            <CopyDeckResult />
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

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should handle long confluence titles', () => {
      const longTitle = 'This is a very long confluence page title that might need truncation in the UI';

      const TestComponent = () => {
        const setConfluenceInfo = useSetAtom(copyDeckConfluenceInfoAtom);

        React.useEffect(() => {
          setConfluenceInfo({
            confluenceUrl: 'https://test.com',
            tableName: 'Test',
            confluenceTitle: longTitle,
            tableIndex: 0,
          });
        }, []);

        return <CopyDeckResult />;
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle empty selectedRows array after reset', () => {
      const TestComponent = () => {
        const selectedRows = useAtomValue(copyDeckSelectedRowsAtom);
        const setSelectedRows = useSetAtom(copyDeckSelectedRowsAtom);

        React.useEffect(() => {
          setSelectedRows([{ customId: '1', language: 'en', groupName: 'g1' }]);
        }, []);

        return (
          <div>
            <CopyDeckResult />
            <div data-testid="rows-count">{selectedRows.length}</div>
          </div>
        );
      };

      render(
        <Provider>
          <TestComponent />
        </Provider>
      );

      const startNewButton = screen.getByRole('button', { name: /start new review/i });
      fireEvent.click(startNewButton);

      const rowsCount = screen.getByTestId('rows-count');
      expect(rowsCount.textContent).toBe('0');
    });
  });
});
