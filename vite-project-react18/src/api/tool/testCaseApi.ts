import axios from '../axios';
import {getEmployeeId} from "@/utils/userUtils";

const SPRINGBOOT3_API_URL = import.meta.env.VITE_API_SPRINGBOOT3_URL || 'http://localhost:8080';

// Jira Issue接口
export interface JiraIssue {
  testCaseId: string;
  description: string;
}

// 测试用例统计请求接口
export interface TestCaseStatisticsRequest {
  staffId: string;
  sessionId: string;
  generatedType: 'JIRA';
  uploadMode: 'SINGLE' | 'MULTIPLE';
  totalGeneratedCount: number;
  acceptedWithoutChangeCount: number;
  acceptedWithChangeCount: number;
  rejectedCount: number;
}

/**
 * 导出TestCase到JIRA的API (Mock实现)
 */
export const exportApi = async (): Promise<JiraIssue[]> => {
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 生成Mock数据
  const mockIssues: JiraIssue[] = [
    {
      testCaseId: 'TC-001',
      description: 'https://www.baiud.com/PHP-123'
    },
    {
      testCaseId: 'TC-002',
      description: 'https://www.baiud.com/JAVA-123'
    }
  ];

  return mockIssues;
};

/**
 * 保存测试用例统计数据
 */
export const saveTestCaseStatistics = async (data: TestCaseStatisticsRequest): Promise<void> => {
    await axios.post(`${SPRINGBOOT3_API_URL}/test-case/statistics`, data);
};

/**
 * 获取Issue标签列表（Mock数据）
 */
export const getIssueLabels = async (): Promise<{label: string, value: string}[]> => {
  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 200));

  // 返回Mock数据
  return [
    {
      value: 'bug',
      label: 'Bug',
    },
    {
      value: 'feature',
      label: 'Feature',
    },
    {
      value: 'enhancement',
      label: 'Enhancement',
    },
    {
      value: 'documentation',
      label: 'Documentation',
    },
    {
      value: 'testing',
      label: 'Testing',
    },
    {
      value: 'hotfix',
      label: 'Hotfix',
    },
    {
      value: 'refactor',
      label: 'Refactor',
    },
    {
      value: 'security',
      label: 'Security',
    }
  ];
};

export type IssueLabel = {label: string, value: string};


export const listJiraIssueLabels =
  async (almType: string, query: string): Promise<{label: string, value: string}[]> => {
  if(!almType) {
    return [];
  }

  try{
    const response = await axios.post<string[]>(`${SPRINGBOOT3_API_URL}/api/tolsquery/querylabels`, {
      almType,
      staffId: getEmployeeId(),
      query
    })
    const data = response;

    if(!Array.isArray(data)) {
      return [];
    }


    return data.map(item=> ({
      label: item,
      value: item,
    }))

  }catch (error) {
    console.error('Failed to query jira issue labels:', error)
    return [];
  }

}
