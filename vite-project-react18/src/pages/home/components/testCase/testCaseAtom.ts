import { atom } from 'jotai';
import type { JiraIssue } from '../../../../api/tool/testCaseApi';

export interface ReferencedDocument {
  id: string;
  name: string;
  externalType?: 'jira';
  jiraKey?: string[];
}

// 测试用例侧边栏显示状态
export const testCaseSidebarVisibleAtom = atom<boolean>(false);

// 测试用例全屏状态
export const testCaseFullscreenAtom = atom<boolean>(false);

// 测试用例流式数据状态
export const testCaseStreamingDataAtom = atom<string>('');

// 测试用例导出结果状态
export const testCaseExportResultAtom = atom<JiraIssue[]>([]);

// 测试用例当前视图状态：'form' | 'result' | 'table'
export const testCaseCurrentViewAtom = atom<'form' | 'result' | 'table'>('form');

export const testCaseJiraDocumentAom = atom<ReferencedDocument[]>([
  {
    id: '1',
    name: 'User Authentication Module',
    externalType: 'jira',
    jiraKey: ['HL-199', 'HL-200']
  },
  {
    id: '2',
    name: 'Password Management Feature',
    externalType: 'jira',
    jiraKey: ['HL-201']
  }
]);

export const testCaseMarkdownTableAom = atom<string>(`| Test Case ID | Test Case Description | Preconditions | Test Steps | Expected Results | Postconditions | Actual outcome | Assigned Person |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-001 | User Login with Valid Credentials | User has valid account and is not logged in | 1. Navigate to login page 2. Enter valid username 3. Enter valid password 4. Click Login button | User successfully logs in and redirects to dashboard | User session is active and authenticated | Pass | John Smith |
| TC-002 | User Login with Invalid Password | User has valid username but enters wrong password | 1. Navigate to login page 2. Enter valid username 3. Enter invalid password 4. Click Login button | Error message displays "Invalid credentials" and login fails | Login form remains visible with error message | Pass | Sarah Johnson |
| TC-003 | Password Reset Functionality | User has registered account and access to email | 1. Navigate to login page 2. Click "Forgot Password" link 3. Enter registered email address 4. Click Submit button 5. Check email inbox | Password reset email is sent and user receives reset link | Email contains valid reset token and instructions | Pending | Mike Davis |
| TC-004 | User Registration with Valid Data | Registration form is accessible and email service is working | 1. Navigate to registration page 2. Fill all required fields with valid data 3. Accept terms and conditions 4. Click Register button 5. Verify email confirmation | User account is created and confirmation email is sent | User can log in with new credentials after email verification | Pass | Lisa Wong |
| TC-005 | Profile Information Update | User is logged in and on profile page | 1. Navigate to profile settings 2. Update first name field 3. Update last name field 4. Click Save Changes button | Profile information is updated and success message appears | Updated information persists after page refresh | Fail | Alex Chen |`);

// 显示测试用例侧边栏的action
export const showTestCaseSidebarAtom = atom(
  null,
  (get, set) => {
    const currentView = get(testCaseCurrentViewAtom);
    const isVisible = get(testCaseSidebarVisibleAtom);

    // 如果已经显示侧边栏且当前视图是 form，则不做任何操作
    if (isVisible && currentView === 'form') {
      return;
    }

    set(testCaseSidebarVisibleAtom, true);
    set(testCaseFullscreenAtom, false); // 确保退出全屏模式

    // 如果当前显示的是 result 或 table，切换到 form
    if (currentView === 'result' || currentView === 'table') {
      set(testCaseCurrentViewAtom, 'form');
    }
  }
);

// 隐藏测试用例侧边栏的action
export const hideTestCaseSidebarAtom = atom(
  null,
  (_get, set) => {
    set(testCaseSidebarVisibleAtom, false);
    set(testCaseFullscreenAtom, false);
  }
);

// 切换全屏模式的action
export const toggleTestCaseFullscreenAtom = atom(
  null,
  (get, set) => {
    const isFullscreen = get(testCaseFullscreenAtom);
    set(testCaseFullscreenAtom, !isFullscreen);
    // 如果要全屏，确保侧边栏是显示的
    if (!isFullscreen) {
      set(testCaseSidebarVisibleAtom, true);
    }
  }
);

// 显示测试用例表格的action
export const showTestCaseTableAtom = atom(
  null,
  (get, set) => {
    const currentView = get(testCaseCurrentViewAtom);
    const isVisible = get(testCaseSidebarVisibleAtom);

    // 如果已经显示侧边栏且当前视图是 table，则不做任何操作
    if (isVisible && currentView === 'table') {
      return;
    }

    set(testCaseSidebarVisibleAtom, true); // 确保侧边栏显示

    // 切换到 table 视图
    set(testCaseCurrentViewAtom, 'table');
  }
);
