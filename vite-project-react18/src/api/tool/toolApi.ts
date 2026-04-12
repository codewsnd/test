import axios from "@/api/axios";
import {GET_TOOL_LIST} from "@/api/tool/api";

export interface GetAllToolsApiParameter {
  param_name: string
  param_description: string
  required: boolean
}

export interface GetAllToolsApiItem {
  tool_name: string
  tool_display_name: string
  mcp_server_name: string
  tool_full_name: string
  tool_category: string
  tool_description: string
  tag: string[]
  parameters: GetAllToolsApiParameter[]
  provider?: string
  icon?: string;
  is_hidden_in_tool?: boolean
}

const mockTools: GetAllToolsApiItem[] = [
  {
    tool_name: 'python_data_analysis',
    tool_display_name: 'Python data analysis',
    mcp_server_name: 'Python',
    provider: 'Python',
    is_hidden_in_tool: false,
    tool_full_name: 'python/python_data_analysis',
    tool_category: 'AI categories',
    'tool_description': 'Advanced data processing and insights with the pandas library.',
    tag: ['Tag 1', 'Tag 2', 'Tag 3'],
    parameters: [
      {
        param_name: 'dataset',
        param_description: 'Input dataset or uploaded source file.',
        required: true,
      },
      {
        param_name: 'instruction',
        param_description: 'Analysis instruction or transformation goal.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'scrape_web_page',
    tool_display_name: 'Scrape web page',
    mcp_server_name: 'Web',
    provider: 'Web',
    is_hidden_in_tool: false,
    tool_full_name: 'web/scrape_web_page',
    tool_category: 'Engineering & DevOps',
    'tool_description': 'Fetch raw HTML content from a provided public URL.',
    tag: [],
    parameters: [
      {
        param_name: 'url',
        param_description: 'Public page URL to fetch.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'crawl_site_map',
    tool_display_name: 'Crawl site map',
    mcp_server_name: 'Web',
    provider: 'Web',
    is_hidden_in_tool: false,
    tool_full_name: 'web/crawl_site_map',
    tool_category: 'Engineering & DevOps',
    'tool_description': 'Scan and collect accessible links from a site map entry point.',
    tag: ['Tag 1', 'Tag 2', 'Tag 3'],
    parameters: [
      {
        param_name: 'site_url',
        param_description: 'Root URL used to discover linked pages.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'read_api_contract',
    tool_display_name: 'Read API contract',
    mcp_server_name: 'Web',
    is_hidden_in_tool: false,
    tool_full_name: 'web/read_api_contract',
    tool_category: 'Engineering & DevOps',
    'tool_description': 'Inspect an API definition document and summarize endpoints and schemas.',
    tag: ['Tag 1', 'Tag 2', 'Tag 3'],
    parameters: [
      {
        param_name: 'spec_url',
        param_description: 'URL of the OpenAPI or contract file.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'search_knowledge_base',
    tool_display_name: 'Search knowledge base',
    mcp_server_name: 'Confluence',
    provider: 'Confluence',
    is_hidden_in_tool: false,
    tool_full_name: 'confluence/search_knowledge_base',
    tool_category: 'Productivity & Knowledge',
    'tool_description': 'Perform a fuzzy search across Confluence pages using keywords.',
    tag: ['Tag 1', 'Tag 2', 'Tag 3'],
    parameters: [
      {
        param_name: 'keyword',
        param_description: 'Search phrase to query the knowledge base.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'get_page_content',
    tool_display_name: 'Get page content',
    mcp_server_name: 'Confluence',
    provider: 'Confluence',
    is_hidden_in_tool: false,
    tool_full_name: 'confluence/get_page_content',
    tool_category: 'Productivity & Knowledge',
    'tool_description': 'Retrieve full content from a specific Confluence page URL.',
    tag: ['Tag 1', 'Tag 2', 'Tag 3'],
    parameters: [
      {
        param_name: 'page_url',
        param_description: 'Direct Confluence page URL.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'create_jira_ticket',
    tool_display_name: 'Create Jira ticket',
    mcp_server_name: 'JIRA',
    provider: 'JIRA',
    is_hidden_in_tool: false,
    tool_full_name: 'jira/create_jira_ticket',
    tool_category: 'Tasks & Project management',
    'tool_description': 'Create a Jira ticket in your epic, story, or task in the specified environment.',
    tag: ['Tag 1', 'Tag 2', 'Tag 3'],
    parameters: [
      {
        param_name: 'project_key',
        param_description: 'Jira project identifier.',
        required: true,
      },
      {
        param_name: 'issue_type',
        param_description: 'Requested Jira issue type.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'get_jira_ticket_details',
    tool_display_name: 'Get Jira ticket details',
    mcp_server_name: 'JIRA',
    is_hidden_in_tool: false,
    tool_full_name: 'jira/get_jira_ticket_details',
    tool_category: 'Tasks & Project management',
    'tool_description': 'Retrieve full details of a Jira ticket, including assignee, comments, description, change log, and more.',
    tag: ['Tag 1', 'Tag 2', 'Tag 3'],
    parameters: [
      {
        param_name: 'jira_key',
        param_description: 'Target issue identifier or exact issue key.',
        required: true,
      },
      {
        param_name: 'source',
        param_description: 'Target Jira environment.',
        required: true,
      },
    ],
  },
  {
    tool_name: 'generate_dummy_test_data',
    tool_display_name: 'Generate dummy test data (Demo)',
    mcp_server_name: 'Internal',
    provider: 'Internal',
    is_hidden_in_tool: true,
    tool_full_name: 'internal/generate_dummy_test_data',
    tool_category: 'Utilities',
    'tool_description': 'Generate data for demonstration and internal automations.',
    tag: [],
    parameters: [
      {
        param_name: 'volume',
        param_description: 'Number of mock records to generate.',
        required: true,
      },
    ],
  },
]

export const getAllToolsApi = async (): Promise<GetAllToolsApiItem[]> => {
  await new Promise((resolve) => setTimeout(resolve, 2000))

  return mockTools
}

export const getAllToolsApi2 = async (): Promise<GetAllToolsApiItem[]> => {
  return axios.get(`${GET_TOOL_LIST}?usecache=false`)
}
