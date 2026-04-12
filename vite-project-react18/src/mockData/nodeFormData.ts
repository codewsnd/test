export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'checkbox' | 'radio' | 'date';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  defaultValue?: any;
}

export interface NodeFormConfig {
  [nodeId: string]: {
    title: string;
    fields: FormField[];
  };
}

// 默认节点配置模板
export const defaultNodeConfigs = {
  input: {
    title: '开始节点配置',
    fields: [
      {
        id: 'name',
        label: '节点名称',
        type: 'text' as const,
        placeholder: '请输入节点名称',
        required: true,
        defaultValue: '开始',
      },
      {
        id: 'description',
        label: '节点描述',
        type: 'textarea' as const,
        placeholder: '请输入节点描述',
        defaultValue: '工作流开始节点',
      },
      {
        id: 'trigger',
        label: '触发方式',
        type: 'select' as const,
        options: [
          { label: '手动触发', value: 'manual' },
          { label: '定时触发', value: 'scheduled' },
          { label: '事件触发', value: 'event' },
        ],
        defaultValue: 'manual',
      },
    ],
  },
  output: {
    title: '结束节点配置',
    fields: [
      {
        id: 'name',
        label: '节点名称',
        type: 'text' as const,
        placeholder: '请输入节点名称',
        required: true,
        defaultValue: '结束',
      },
      {
        id: 'notification',
        label: '结束通知',
        type: 'checkbox' as const,
        defaultValue: true,
      },
      {
        id: 'notifyUsers',
        label: '通知人员',
        type: 'select' as const,
        options: [
          { label: '发起人', value: 'initiator' },
          { label: '所有参与人', value: 'all' },
          { label: '指定人员', value: 'specific' },
        ],
        defaultValue: 'initiator',
      },
      {
        id: 'summary',
        label: '结束总结',
        type: 'textarea' as const,
        placeholder: '请输入结束总结',
      },
    ],
  },
  default: {
    title: '节点配置',
    fields: [
      {
        id: 'name',
        label: '节点名称',
        type: 'text' as const,
        placeholder: '请输入节点名称',
        required: true,
        defaultValue: '处理节点',
      },
      {
        id: 'assignee',
        label: '负责人',
        type: 'select' as const,
        options: [
          { label: '张三', value: 'zhangsan' },
          { label: '李四', value: 'lisi' },
          { label: '王五', value: 'wangwu' },
        ],
        required: true,
      },
      {
        id: 'priority',
        label: '优先级',
        type: 'radio' as const,
        options: [
          { label: '高', value: 'high' },
          { label: '中', value: 'medium' },
          { label: '低', value: 'low' },
        ],
        defaultValue: 'medium',
      },
      {
        id: 'description',
        label: '描述',
        type: 'textarea' as const,
        placeholder: '请输入描述',
      },
    ],
  },
};

export const nodeFormMockData: NodeFormConfig = {
  '1': {
    title: '开始节点配置',
    fields: [
      {
        id: 'name',
        label: '节点名称',
        type: 'text',
        placeholder: '请输入节点名称',
        required: true,
        defaultValue: '开始',
      },
      {
        id: 'description',
        label: '节点描述',
        type: 'textarea',
        placeholder: '请输入节点描述',
        defaultValue: '工作流开始节点',
      },
      {
        id: 'trigger',
        label: '触发方式',
        type: 'select',
        options: [
          { label: '手动触发', value: 'manual' },
          { label: '定时触发', value: 'scheduled' },
          { label: '事件触发', value: 'event' },
        ],
        defaultValue: 'manual',
      },
    ],
  },
  '2': {
    title: '处理任务配置',
    fields: [
      {
        id: 'name',
        label: '任务名称',
        type: 'text',
        placeholder: '请输入任务名称',
        required: true,
        defaultValue: '处理任务',
      },
      {
        id: 'assignee',
        label: '负责人',
        type: 'select',
        options: [
          { label: '张三', value: 'zhangsan' },
          { label: '李四', value: 'lisi' },
          { label: '王五', value: 'wangwu' },
        ],
        required: true,
      },
      {
        id: 'priority',
        label: '优先级',
        type: 'radio',
        options: [
          { label: '高', value: 'high' },
          { label: '中', value: 'medium' },
          { label: '低', value: 'low' },
        ],
        defaultValue: 'medium',
      },
      {
        id: 'deadline',
        label: '截止日期',
        type: 'date',
      },
      {
        id: 'autoExecute',
        label: '自动执行',
        type: 'checkbox',
        defaultValue: false,
      },
    ],
  },
  '3': {
    title: '审核节点配置',
    fields: [
      {
        id: 'name',
        label: '节点名称',
        type: 'text',
        placeholder: '请输入节点名称',
        required: true,
        defaultValue: '审核',
      },
      {
        id: 'approver',
        label: '审批人',
        type: 'select',
        options: [
          { label: '经理', value: 'manager' },
          { label: '主管', value: 'supervisor' },
          { label: '总监', value: 'director' },
        ],
        required: true,
      },
      {
        id: 'approvalType',
        label: '审批类型',
        type: 'select',
        options: [
          { label: '或签（一人通过即可）', value: 'or' },
          { label: '会签（所有人通过）', value: 'and' },
        ],
        defaultValue: 'or',
      },
      {
        id: 'timeLimit',
        label: '审批时限（小时）',
        type: 'number',
        placeholder: '请输入审批时限',
        defaultValue: 24,
      },
    ],
  },
  '4': {
    title: '结束节点配置',
    fields: [
      {
        id: 'name',
        label: '节点名称',
        type: 'text',
        placeholder: '请输入节点名称',
        required: true,
        defaultValue: '结束',
      },
      {
        id: 'notification',
        label: '结束通知',
        type: 'checkbox',
        defaultValue: true,
      },
      {
        id: 'notifyUsers',
        label: '通知人员',
        type: 'select',
        options: [
          { label: '发起人', value: 'initiator' },
          { label: '所有参与人', value: 'all' },
          { label: '指定人员', value: 'specific' },
        ],
        defaultValue: 'initiator',
      },
      {
        id: 'summary',
        label: '结束总结',
        type: 'textarea',
        placeholder: '请输入结束总结',
      },
    ],
  },
};
