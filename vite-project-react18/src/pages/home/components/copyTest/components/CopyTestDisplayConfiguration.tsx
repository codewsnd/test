import React from 'react';
import { Radio, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { CopyTestDisplayConfiguration as DisplayConfiguration } from '../types';

interface Props {
  disabled: boolean;
  value: DisplayConfiguration;
  onChange: (value: DisplayConfiguration) => void;
}

/** 两组配置统一应用于匹配的 Evidence，Result 随 Evidence 自动生成。 */
export const CopyTestDisplayConfiguration: React.FC<Props> = ({ disabled, value, onChange }) => {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3 rounded border border-gray-200 bg-gray-50 p-3">
      <span className="inline-flex items-center gap-2 leading-[22px]">
        Display Configuration
        <Tooltip trigger={['hover', 'focus']} title="Both settings apply to matched Test Evidence. Add keeps existing evidence and appends new matched images. Replace replaces evidence only in matched rows. Single-image selects one matched image per group in this batch; Multi-images allows several. Test Result is generated from the resulting evidence. Unmatched rows remain unchanged.">
          <button type="button" aria-label="About display configuration" className="inline-flex border-0 bg-transparent p-0 text-gray-500">
            <QuestionCircleOutlined />
          </button>
        </Tooltip>
      </span>
      <div className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2">
        <span className="leading-[22px]">Test Result</span>
        <Radio.Group
          aria-label="Test Evidence update mode"
          disabled={disabled}
          value={value.evidenceUpdateMode}
          onChange={event => onChange({ ...value, evidenceUpdateMode: event.target.value })}
          options={[{ label: 'Add', value: 'add' }, { label: 'Replace', value: 'replace' }]}
        />
        <span className="leading-[22px]">Test Evidence</span>
        <Radio.Group
          aria-label="Test Evidence image count"
          disabled={disabled}
          value={value.evidenceMode}
          onChange={event => onChange({ ...value, evidenceMode: event.target.value })}
          options={[{ label: 'Single-image', value: 'single' }, { label: 'Multi-images', value: 'multiple' }]}
        />
      </div>
    </div>
  );
};
