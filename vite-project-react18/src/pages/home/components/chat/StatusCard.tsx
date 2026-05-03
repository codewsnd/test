import type { ReactNode } from 'react';
import { memo, useState } from 'react';
import { Card, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  RightOutlined
} from '@ant-design/icons';

import type { AiResponseStatus, ProcessStep, StepStatus } from './types';

interface StatusCardProps {
  steps: ProcessStep[];
  responseStatus: AiResponseStatus;
}

type StatusMeta = {
  label: string;
  icon: ReactNode;
};

const { Text } = Typography;

const STATUS_META: Record<StepStatus, StatusMeta> = {
  waiting: {
    label: 'Waiting',
    icon: <ClockCircleOutlined />
  },
  processing: {
    label: 'In progress',
    icon: <span className="chat-status-card__spinner" />
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircleOutlined />
  },
  error: {
    label: 'Error',
    icon: <ExclamationCircleOutlined />
  }
};

const getOverallStatus = (steps: ProcessStep[], responseStatus: AiResponseStatus): StepStatus => {
  if (responseStatus === 'error' || steps.some((step) => step.status === 'error')) {
    return 'error';
  }

  if (
    responseStatus === 'completed' &&
    steps.length > 0 &&
    steps.every((step) => step.status === 'completed')
  ) {
    return 'completed';
  }

  if (
    responseStatus === 'streaming' ||
    responseStatus === 'pending' ||
    steps.some((step) => step.status === 'processing')
  ) {
    return 'processing';
  }

  return 'waiting';
};

const getSummaryText = (status: StepStatus, steps: ProcessStep[]) => {
  const completedCount = steps.filter((step) => step.status === 'completed').length;

  switch (status) {
    case 'waiting':
      return '请求已建立，等待处理。';
    case 'processing':
      return `已完成 ${completedCount}/${steps.length}，正在继续处理。`;
    case 'completed':
      return `全部 ${steps.length} 个步骤已完成。`;
    case 'error':
      return '流程中断，请检查错误信息。';
    default:
      return '';
  }
};

const getFocusedStep = (steps: ProcessStep[]) => {
  const activeStep =
    steps.find((step) => step.status === 'processing') ||
    steps.find((step) => step.status === 'error') ||
    [...steps].reverse().find((step) => step.status === 'completed') ||
    steps[0];

  if (!activeStep) {
    return '';
  }

  return activeStep.tooltip || activeStep.content;
};

const StatusCardComponent = ({ steps, responseStatus }: StatusCardProps) => {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) {
    return null;
  }

  const overallStatus = getOverallStatus(steps, responseStatus);
  const overallMeta = STATUS_META[overallStatus];
  const completedCount = steps.filter((step) => step.status === 'completed').length;
  const summaryText = getSummaryText(overallStatus, steps);
  const focusedStep = getFocusedStep(steps);
  const ExpandIcon = expanded ? DownOutlined : RightOutlined;

  return (
    <Card
      size="small"
      className={`chat-status-card chat-status-card--${overallStatus} ${
        expanded ? 'chat-status-card--expanded' : 'chat-status-card--collapsed'
      }`}
    >
      <button
        type="button"
        className="chat-status-card__toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <div className="chat-status-card__header">
          <div className="chat-status-card__headline">
            <span
              className={`chat-status-card__headline-icon chat-status-card__headline-icon--${overallStatus}`}
            >
              {overallMeta.icon}
            </span>
              <span className="chat-status-card__headline-copy">
              <span className="chat-status-card__title">Steps</span>
              <span className="chat-status-card__summary">{summaryText}</span>
            </span>
          </div>

          <div className="chat-status-card__meta">
            <Text className="chat-status-card__count">
              {completedCount}/{steps.length}
            </Text>
            <Tag
              bordered={false}
              className={`chat-status-card__tag chat-status-card__tag--${overallStatus}`}
            >
              {overallMeta.label}
            </Tag>
            <span className="chat-status-card__expand-indicator">
              <ExpandIcon />
            </span>
          </div>
        </div>

        {!expanded && focusedStep && (
          <div className="chat-status-card__collapsed-text">
            {focusedStep}
          </div>
        )}
      </button>

      {expanded && (
        <div className="chat-status-card__steps">
          {steps.map((step, index) => {
            const meta = STATUS_META[step.status];

            return (
              <div
                key={step.id}
                className={`chat-status-card__step chat-status-card__step--${step.status}`}
              >
                <div className="chat-status-card__step-icon-column">
                  {index < steps.length - 1 && (
                    <span className="chat-status-card__step-connector" />
                  )}
                  <span
                    className={`chat-status-card__step-icon chat-status-card__step-icon--${step.status}`}
                  >
                    {meta.icon}
                  </span>
                </div>

                <div className="chat-status-card__step-main">
                  <div className="chat-status-card__step-row">
                    <Text className="chat-status-card__step-label">
                      {step.content}
                    </Text>
                    <Text
                      className={`chat-status-card__step-state chat-status-card__step-state--${step.status}`}
                    >
                      {meta.label}
                    </Text>
                  </div>

                  {step.tooltip && (
                    <div className="chat-status-card__step-tooltip">
                      {step.tooltip}
                    </div>
                  )}

                  {step.details?.length ? (
                    <div className="chat-status-card__step-details">
                      {step.details.map((detail) => (
                        <div
                          key={`${step.id}_${detail.label}`}
                          className="chat-status-card__step-detail"
                        >
                          <div className="chat-status-card__step-detail-label">
                            {detail.label}
                          </div>
                          <pre className="chat-status-card__step-detail-value">
                            {detail.value}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const StatusCard = memo(
  StatusCardComponent,
  (prevProps, nextProps) =>
    prevProps.steps === nextProps.steps &&
    prevProps.responseStatus === nextProps.responseStatus
);
