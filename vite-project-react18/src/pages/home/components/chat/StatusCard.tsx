import React from 'react';
import { Card, Spin,  } from 'antd';
import { ProcessStep, StepStatus } from './types';
import {ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined} from "@ant-design/icons";

interface StatusCardProps {
  steps: ProcessStep[];
}

const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case 'waiting':
      return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    case 'processing':
      return <Spin size="small" />;
    case 'completed':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    case 'error':
      return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    default:
      return null;
  }
};

const getStatusText = (status: StepStatus) => {
  switch (status) {
    case 'waiting':
      return 'Init';
    case 'processing':
      return 'Loading';
    case 'completed':
      return 'Completed';
    case 'error':
      return 'Error';
    default:
      return '';
  }
};

const getStatusColor = (status: StepStatus) => {
  switch (status) {
    case 'waiting':
      return '#faad14';
    case 'processing':
      return '#1890ff';
    case 'completed':
      return '#52c41a';
    case 'error':
      return '#ff4d4f';
    default:
      return '#d9d9d9';
  }
};

export const StatusCard: React.FC<StatusCardProps> = ({ steps }) => {
  if (steps.length === 0) {
    return null;
  }

  return (
    <Card
      size="small"
      style={{
        margin: '8px 0',
        background: '#fafafa',
        border: '1px solid #e8e8e8'
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
        Processing Steps
      </div>

      {steps.map((step, index) => (
        <div
          key={step.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 0',
            borderLeft: `3px solid ${getStatusColor(step.status)}`,
            paddingLeft: '8px',
            marginBottom: index < steps.length - 1 ? '4px' : '0'
          }}
        >
          <span style={{ marginRight: '8px' }}>
            {getStatusIcon(step.status)}
          </span>

          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '13px' }}>
              {step.content}
            </span>
            {step.tooltip && (
              <div style={{
                fontSize: '11px',
                color: '#999',
                marginTop: '2px'
              }}>
                {step.tooltip}
              </div>
            )}
          </div>

          <span style={{
            fontSize: '11px',
            color: getStatusColor(step.status),
            fontWeight: '500'
          }}>
            {getStatusText(step.status)}
          </span>
        </div>
      ))}
    </Card>
  );
};
