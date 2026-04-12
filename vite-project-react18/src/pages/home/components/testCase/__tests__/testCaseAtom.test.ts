import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  testCaseSidebarVisibleAtom,
  testCaseFullscreenAtom,
  testCaseStreamingDataAtom,
  testCaseExportResultAtom,
  testCaseCurrentViewAtom,
  testCaseJiraDocumentAom,
  testCaseMarkdownTableAom,
  showTestCaseSidebarAtom,
  hideTestCaseSidebarAtom,
  toggleTestCaseFullscreenAtom,
  showTestCaseTableAtom,
  type ReferencedDocument,
} from '../testCaseAtom';
import type { JiraIssue } from '../../../../../api/tool/testCaseApi';

describe('testCaseAtom', () => {
  describe('Primitive Atoms', () => {
    it('testCaseSidebarVisibleAtom should initialize with false', () => {
      const store = createStore();
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);
    });

    it('testCaseFullscreenAtom should initialize with false', () => {
      const store = createStore();
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
    });

    it('testCaseStreamingDataAtom should initialize with empty string', () => {
      const store = createStore();
      expect(store.get(testCaseStreamingDataAtom)).toBe('');
    });

    it('testCaseExportResultAtom should initialize with empty array', () => {
      const store = createStore();
      expect(store.get(testCaseExportResultAtom)).toEqual([]);
    });

    it('testCaseCurrentViewAtom should initialize with "form"', () => {
      const store = createStore();
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');
    });

    it('testCaseJiraDocumentAom should initialize with default documents', () => {
      const store = createStore();
      const documents = store.get(testCaseJiraDocumentAom);

      expect(documents).toHaveLength(2);
      expect(documents[0]).toEqual({
        id: '1',
        name: 'User Authentication Module',
        externalType: 'jira',
        jiraKey: ['HL-199', 'HL-200']
      });
      expect(documents[1]).toEqual({
        id: '2',
        name: 'Password Management Feature',
        externalType: 'jira',
        jiraKey: ['HL-201']
      });
    });

    it('testCaseMarkdownTableAom should initialize with default table', () => {
      const store = createStore();
      const table = store.get(testCaseMarkdownTableAom);

      expect(table).toContain('| Test Case ID | Test Case Description |');
      expect(table).toContain('| TC-001 | User Login with Valid Credentials |');
      expect(table).toContain('| TC-005 | Profile Information Update |');
    });
  });

  describe('Primitive Atom Updates', () => {
    it('should update testCaseSidebarVisibleAtom', () => {
      const store = createStore();

      store.set(testCaseSidebarVisibleAtom, true);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);

      store.set(testCaseSidebarVisibleAtom, false);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);
    });

    it('should update testCaseFullscreenAtom', () => {
      const store = createStore();

      store.set(testCaseFullscreenAtom, true);
      expect(store.get(testCaseFullscreenAtom)).toBe(true);

      store.set(testCaseFullscreenAtom, false);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
    });

    it('should update testCaseStreamingDataAtom', () => {
      const store = createStore();

      store.set(testCaseStreamingDataAtom, 'streaming data');
      expect(store.get(testCaseStreamingDataAtom)).toBe('streaming data');
    });

    it('should update testCaseExportResultAtom', () => {
      const store = createStore();
      const mockJiraIssues: JiraIssue[] = [
        { id: '1', key: 'TEST-1', summary: 'Test Issue' } as JiraIssue,
      ];

      store.set(testCaseExportResultAtom, mockJiraIssues);
      expect(store.get(testCaseExportResultAtom)).toEqual(mockJiraIssues);
    });

    it('should update testCaseCurrentViewAtom to different views', () => {
      const store = createStore();

      store.set(testCaseCurrentViewAtom, 'result');
      expect(store.get(testCaseCurrentViewAtom)).toBe('result');

      store.set(testCaseCurrentViewAtom, 'table');
      expect(store.get(testCaseCurrentViewAtom)).toBe('table');

      store.set(testCaseCurrentViewAtom, 'form');
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');
    });

    it('should update testCaseJiraDocumentAom', () => {
      const store = createStore();
      const newDocuments: ReferencedDocument[] = [
        {
          id: '3',
          name: 'New Feature',
          externalType: 'jira',
          jiraKey: ['HL-300']
        }
      ];

      store.set(testCaseJiraDocumentAom, newDocuments);
      expect(store.get(testCaseJiraDocumentAom)).toEqual(newDocuments);
    });

    it('should update testCaseMarkdownTableAom', () => {
      const store = createStore();
      const newTable = '| ID | Description |\n| --- | --- |\n| 1 | Test |';

      store.set(testCaseMarkdownTableAom, newTable);
      expect(store.get(testCaseMarkdownTableAom)).toBe(newTable);
    });
  });

  describe('showTestCaseSidebarAtom', () => {
    it('should show sidebar and switch to form view when current view is result', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseCurrentViewAtom, 'result');
      store.set(testCaseSidebarVisibleAtom, false);

      // Execute action
      store.set(showTestCaseSidebarAtom);

      // Assert results
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');
    });

    it('should show sidebar and switch to form view when current view is table', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseCurrentViewAtom, 'table');
      store.set(testCaseSidebarVisibleAtom, false);

      // Execute action
      store.set(showTestCaseSidebarAtom);

      // Assert results
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');
    });

    it('should do nothing when sidebar is visible and current view is form', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseCurrentViewAtom, 'form');
      store.set(testCaseSidebarVisibleAtom, true);

      // Execute action
      store.set(showTestCaseSidebarAtom);

      // Assert state unchanged
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');
    });

    it('should show sidebar when hidden and current view is form', () => {
      const store = createStore();

      // Set initial state (form view, but sidebar hidden)
      store.set(testCaseCurrentViewAtom, 'form');
      store.set(testCaseSidebarVisibleAtom, false);

      // Execute action
      store.set(showTestCaseSidebarAtom);

      // Assert results
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');
    });

    it('should exit fullscreen mode when showing sidebar', () => {
      const store = createStore();

      // Set initial state with fullscreen enabled
      store.set(testCaseFullscreenAtom, true);
      store.set(testCaseCurrentViewAtom, 'result');

      // Execute action
      store.set(showTestCaseSidebarAtom);

      // Assert fullscreen is disabled
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
    });
  });

  describe('hideTestCaseSidebarAtom', () => {
    it('should hide sidebar and exit fullscreen mode', () => {
      const store = createStore();

      // Set initial state (sidebar visible, fullscreen enabled)
      store.set(testCaseSidebarVisibleAtom, true);
      store.set(testCaseFullscreenAtom, true);

      // Execute action
      store.set(hideTestCaseSidebarAtom);

      // Assert results
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
    });

    it('should hide sidebar when it is visible', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseSidebarVisibleAtom, true);

      // Execute action
      store.set(hideTestCaseSidebarAtom);

      // Assert results
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);
    });

    it('should work when sidebar is already hidden', () => {
      const store = createStore();

      // Initial state is already hidden (default)
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);

      // Execute action
      store.set(hideTestCaseSidebarAtom);

      // Assert state remains false
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
    });
  });

  describe('toggleTestCaseFullscreenAtom', () => {
    it('should toggle fullscreen from false to true', () => {
      const store = createStore();

      // Initial state
      expect(store.get(testCaseFullscreenAtom)).toBe(false);

      // Execute action
      store.set(toggleTestCaseFullscreenAtom);

      // Assert results
      expect(store.get(testCaseFullscreenAtom)).toBe(true);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
    });

    it('should toggle fullscreen from true to false', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseFullscreenAtom, true);
      store.set(testCaseSidebarVisibleAtom, true);

      // Execute action
      store.set(toggleTestCaseFullscreenAtom);

      // Assert results
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
      // sidebar visibility should not change when exiting fullscreen
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
    });

    it('should ensure sidebar is visible when entering fullscreen', () => {
      const store = createStore();

      // Set initial state (sidebar hidden)
      store.set(testCaseSidebarVisibleAtom, false);
      store.set(testCaseFullscreenAtom, false);

      // Execute action
      store.set(toggleTestCaseFullscreenAtom);

      // Assert sidebar is shown when entering fullscreen
      expect(store.get(testCaseFullscreenAtom)).toBe(true);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
    });

    it('should not change sidebar visibility when exiting fullscreen', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseFullscreenAtom, true);
      store.set(testCaseSidebarVisibleAtom, false);

      // Execute action (exit fullscreen)
      store.set(toggleTestCaseFullscreenAtom);

      // Assert sidebar visibility unchanged
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);
    });
  });

  describe('showTestCaseTableAtom', () => {
    it('should show sidebar and switch to table view', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseCurrentViewAtom, 'form');
      store.set(testCaseSidebarVisibleAtom, false);

      // Execute action
      store.set(showTestCaseTableAtom);

      // Assert results
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseCurrentViewAtom)).toBe('table');
    });

    it('should switch from form view to table view', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseCurrentViewAtom, 'form');
      store.set(testCaseSidebarVisibleAtom, true);

      // Execute action
      store.set(showTestCaseTableAtom);

      // Assert results
      expect(store.get(testCaseCurrentViewAtom)).toBe('table');
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
    });

    it('should switch from result view to table view', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseCurrentViewAtom, 'result');
      store.set(testCaseSidebarVisibleAtom, true);

      // Execute action
      store.set(showTestCaseTableAtom);

      // Assert results
      expect(store.get(testCaseCurrentViewAtom)).toBe('table');
    });

    it('should do nothing when sidebar is visible and current view is table', () => {
      const store = createStore();

      // Set initial state
      store.set(testCaseCurrentViewAtom, 'table');
      store.set(testCaseSidebarVisibleAtom, true);

      // Execute action
      store.set(showTestCaseTableAtom);

      // Assert state unchanged
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseCurrentViewAtom)).toBe('table');
    });

    it('should ensure sidebar is visible when switching to table view', () => {
      const store = createStore();

      // Set initial state (sidebar hidden)
      store.set(testCaseSidebarVisibleAtom, false);
      store.set(testCaseCurrentViewAtom, 'form');

      // Execute action
      store.set(showTestCaseTableAtom);

      // Assert sidebar is shown
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseCurrentViewAtom)).toBe('table');
    });
  });

  describe('Complex Interaction Scenarios', () => {
    it('should handle show sidebar -> toggle fullscreen -> hide sidebar flow', () => {
      const store = createStore();

      // Show sidebar
      store.set(showTestCaseSidebarAtom);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);

      // Toggle fullscreen
      store.set(toggleTestCaseFullscreenAtom);
      expect(store.get(testCaseFullscreenAtom)).toBe(true);

      // Hide sidebar
      store.set(hideTestCaseSidebarAtom);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(false);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);
    });

    it('should handle table view -> form view -> result view flow', () => {
      const store = createStore();

      // Show table
      store.set(showTestCaseTableAtom);
      expect(store.get(testCaseCurrentViewAtom)).toBe('table');

      // Show sidebar (form)
      store.set(showTestCaseSidebarAtom);
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');

      // Manually set to result
      store.set(testCaseCurrentViewAtom, 'result');
      expect(store.get(testCaseCurrentViewAtom)).toBe('result');

      // Show sidebar again should switch back to form
      store.set(showTestCaseSidebarAtom);
      expect(store.get(testCaseCurrentViewAtom)).toBe('form');
    });

    it('should handle multiple fullscreen toggles', () => {
      const store = createStore();

      // Toggle on
      store.set(toggleTestCaseFullscreenAtom);
      expect(store.get(testCaseFullscreenAtom)).toBe(true);
      expect(store.get(testCaseSidebarVisibleAtom)).toBe(true);

      // Toggle off
      store.set(toggleTestCaseFullscreenAtom);
      expect(store.get(testCaseFullscreenAtom)).toBe(false);

      // Toggle on again
      store.set(toggleTestCaseFullscreenAtom);
      expect(store.get(testCaseFullscreenAtom)).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should only accept valid view types', () => {
      const store = createStore();

      // Valid types
      store.set(testCaseCurrentViewAtom, 'form');
      store.set(testCaseCurrentViewAtom, 'result');
      store.set(testCaseCurrentViewAtom, 'table');

      // TypeScript should prevent invalid values at compile time
      // @ts-expect-error - invalid view type
      // store.set(testCaseCurrentViewAtom, 'invalid');
    });

    it('should work with ReferencedDocument type', () => {
      const store = createStore();

      const validDocument: ReferencedDocument = {
        id: '1',
        name: 'Test',
        externalType: 'jira',
        jiraKey: ['KEY-1']
      };

      store.set(testCaseJiraDocumentAom, [validDocument]);
      expect(store.get(testCaseJiraDocumentAom)).toEqual([validDocument]);
    });

    it('should allow ReferencedDocument without optional fields', () => {
      const store = createStore();

      const documentWithoutOptionals: ReferencedDocument = {
        id: '1',
        name: 'Test'
      };

      store.set(testCaseJiraDocumentAom, [documentWithoutOptionals]);
      expect(store.get(testCaseJiraDocumentAom)).toEqual([documentWithoutOptionals]);
    });
  });
});
