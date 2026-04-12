import React, { useState } from 'react';
import { Form, Input, InputNumber, Button, Select, Card, message } from 'antd';
import { FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import { generatePptApi, downloadPptFromBase64 } from '@/api/tool/pptApi';

const { Option } = Select;

/**
 * PPT 生成器渲染组件
 * 在 markdown 代码块中渲染，当 language 为 pptGenerator 时显示
 */
export const PptGeneratorRenderer: React.FC = () => {
  const [form] = Form.useForm();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async (values: any) => {
    try {
      setGenerating(true);
      message.loading({ content: '正在生成 PPT，请稍候...', key: 'pptGen', duration: 0 });

      const { font, pageCount, title } = values;
      const response = await generatePptApi({
        font,
        pageCount,
        title: title || 'AI 生成的演示文稿'
      });

      message.destroy('pptGen');

      if (response.success && response.pptBase64 && response.fileName) {
        message.success('PPT 生成成功，正在下载...');
        downloadPptFromBase64(response.pptBase64, response.fileName);

        // 重置表单
        form.resetFields();
      } else {
        message.error(response.message || 'PPT 生成失败');
      }
    } catch (error: any) {
      console.error('生成 PPT 失败:', error);
      message.destroy('pptGen');
      message.error('生成 PPT 失败: ' + (error.message || '未知错误'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card
      style={{
        margin: '16px 0',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        border: 'none',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
      }}
      bodyStyle={{ padding: '24px' }}
    >
      <div style={{
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'white'
      }}>
        <FileTextOutlined style={{ fontSize: '28px' }} />
        <div>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
            PPT 生成器
          </div>
          <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
            填写以下信息即可生成 PowerPoint 演示文稿
          </div>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleGenerate}
        initialValues={{
          font: 'Microsoft YaHei',
          pageCount: 5,
          title: 'AI 生成的演示文稿'
        }}
      >
        <Form.Item
          label={<span style={{ color: 'white', fontWeight: 500 }}>字体</span>}
          name="font"
          rules={[{ required: true, message: '请选择字体' }]}
          style={{ marginBottom: '16px' }}
        >
          <Select
            placeholder="选择字体"
            size="large"
            style={{ borderRadius: '8px' }}
          >
            <Option value="Microsoft YaHei">微软雅黑 (Microsoft YaHei)</Option>
            <Option value="SimSun">宋体 (SimSun)</Option>
            <Option value="SimHei">黑体 (SimHei)</Option>
            <Option value="KaiTi">楷体 (KaiTi)</Option>
            <Option value="Arial">Arial</Option>
            <Option value="Times New Roman">Times New Roman</Option>
            <Option value="Calibri">Calibri</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label={<span style={{ color: 'white', fontWeight: 500 }}>页数</span>}
          name="pageCount"
          rules={[
            { required: true, message: '请输入页数' },
            { type: 'number', min: 1, max: 100, message: '页数范围：1-100' }
          ]}
          style={{ marginBottom: '16px' }}
        >
          <InputNumber
            placeholder="输入页数 (1-100)"
            style={{ width: '100%', borderRadius: '8px' }}
            size="large"
            min={1}
            max={100}
          />
        </Form.Item>

        <Form.Item
          label={<span style={{ color: 'white', fontWeight: 500 }}>标题</span>}
          name="title"
          style={{ marginBottom: '20px' }}
        >
          <Input
            placeholder="输入 PPT 标题（可选）"
            size="large"
            style={{ borderRadius: '8px' }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={generating}
            block
            size="large"
            icon={<DownloadOutlined />}
            style={{
              height: '48px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              background: 'white',
              color: '#667eea',
              border: 'none',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
          >
            {generating ? '生成中...' : '生成 PPT'}
          </Button>
        </Form.Item>
      </Form>

      <div style={{
        marginTop: '16px',
        fontSize: '12px',
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center'
      }}>
        💡 生成的 PPT 将自动下载到本地
      </div>
    </Card>
  );
};

export default PptGeneratorRenderer;
