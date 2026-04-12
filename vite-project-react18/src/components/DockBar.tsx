import React from 'react';

export interface NodeTemplate {
  type: 'default' | 'input' | 'output';
  label: string;
  icon: string;
  description: string;
}

interface DockBarProps {
  onAddNode: (template: NodeTemplate) => void;
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'input',
    label: '开始节点',
    icon: '▶',
    description: '工作流开始',
  },
  {
    type: 'default',
    label: '处理节点',
    icon: '⚙',
    description: '处理任务',
  },
  {
    type: 'default',
    label: '审批节点',
    icon: '✓',
    description: '审批流程',
  },
  {
    type: 'default',
    label: '条件节点',
    icon: '◆',
    description: '条件判断',
  },
  {
    type: 'output',
    label: '结束节点',
    icon: '■',
    description: '工作流结束',
  },
];

const DockBar: React.FC<DockBarProps> = ({ onAddNode }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-300 shadow-lg z-10">
      <div className="px-6 py-3">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-gray-700 mr-2">添加节点：</span>
          <div className="flex space-x-2 overflow-x-auto">
            {nodeTemplates.map((template, index) => (
              <button
                key={index}
                onClick={() => onAddNode(template)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors duration-200 whitespace-nowrap"
                title={template.description}
              >
                <span className="text-lg">{template.icon}</span>
                <span className="text-sm font-medium text-gray-700">{template.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DockBar;
