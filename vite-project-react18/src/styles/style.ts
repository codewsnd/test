import type { ThemeConfig } from 'antd';

/**
 * Test Case 组件主题配置
 * 使用企业级标准设计规范
 */
export const testCaseTheme: ThemeConfig = {
  token: {
    colorPrimary: '#000000',         // 主题色设置为黑色
  },
  components: {
    // === Card 卡片组件 ===
    Card: {
      borderRadius: 0,                 // 卡片边框圆角为 0
      borderRadiusLG: 0,               // 大尺寸卡片边框圆角为 0
      borderRadiusSM: 0,               // 小尺寸卡片边框圆角为 0
      paddingLG: 20,                   // 卡片主体内边距
      padding: 16,                     // 卡片头部和其他区域内边距
      headerHeight: 56,                // 卡片头部高度
      headerFontSize: 16,              // 卡片标题字体大小
      headerBg: '#ffffff',             // 卡片头部背景色
    },

    // === Button 按钮组件 ===
    Button: {
      borderRadius: 0,                 // 按钮边框圆角为 0
      borderRadiusLG: 0,               // 大按钮边框圆角为 0
      borderRadiusSM: 0,               // 小按钮边框圆角为 0
      controlHeight: 32,               // 默认按钮高度
      controlHeightLG: 40,             // 大按钮高度
      controlHeightSM: 24,             // 小按钮高度
      paddingContentHorizontal: 15,    // 按钮水平内边距
      fontWeight: 400,                 // 按钮字体粗细
      primaryColor: '#ffffff',         // 主按钮文字颜色
      defaultBorderColor: '#d9d9d9',   // 默认按钮边框颜色
    },

    // === Input 输入框组件 ===
    Input: {
      borderRadius: 0,                 // 输入框边框圆角为 0
      borderRadiusLG: 0,               // 大输入框边框圆角为 0
      borderRadiusSM: 0,               // 小输入框边框圆角为 0
      controlHeight: 32,               // 默认输入框高度
      controlHeightLG: 40,             // 大输入框高度
      controlHeightSM: 24,             // 小输入框高度
      paddingBlock: 4,                 // 输入框垂直内边距
      paddingInline: 11,               // 输入框水平内边距
    },

    // === Select 选择框组件 ===
    Select: {
      borderRadius: 0,                 // 选择框边框圆角为 0
      borderRadiusLG: 0,               // 大选择框边框圆角为 0
      borderRadiusSM: 0,               // 小选择框边框圆角为 0
      controlHeight: 32,               // 默认选择框高度
      controlHeightLG: 40,             // 大选择框高度
      controlHeightSM: 24,             // 小选择框高度
    },

    // === Table 表格组件 ===
    Table: {
      borderRadius: 0,                 // 表格边框圆角为 0
      borderRadiusLG: 0,               // 大表格边框圆角为 0
      borderRadiusSM: 0,               // 小表格边框圆角为 0
      headerBg: '#fafafa',             // 表格头部背景色
      headerColor: 'rgba(0, 0, 0, 0.88)', // 表格头部文字颜色
      rowHoverBg: '#F3F3F3',           // 表格行悬停背景色
      rowSelectedBg: '#F3F3F3',        // 表格行选中背景色
      rowSelectedHoverBg: '#F3F3F3',   // 表格选中行悬停背景色
      cellPaddingBlock: 12,            // 单元格垂直内边距
      cellPaddingInline: 16,           // 单元格水平内边距
      headerSplitColor: '#f0f0f0',     // 表格头部分割线颜色
    },

    // === Form 表单组件 ===
    Form: {
      labelFontSize: 14,               // 表单标签字体大小
      labelColor: 'rgba(0, 0, 0, 0.88)', // 表单标签颜色
      labelHeight: 32,                 // 表单标签高度
      verticalLabelPadding: '0 0 8px', // 垂直布局标签内边距
      itemMarginBottom: 24,            // 表单项底部外边距
    },

    // === Collapse 折叠面板组件 ===
    Collapse: {
      borderRadius: 0,                 // 折叠面板边框圆角为 0
      borderRadiusLG: 0,               // 大折叠面板边框圆角为 0
      borderRadiusSM: 0,               // 小折叠面板边框圆角为 0
      headerPadding: '12px 16px',      // 折叠面板头部内边距
      headerBg: '#fafafa',             // 折叠面板头部背景色
      contentPadding: '16px',          // 折叠面板内容内边距
    },

    // === Radio 单选框组件 ===
    Radio: {
      // 普通圆形单选框样式
      colorPrimary: '#000000',         // 边框和圆点颜色设置为黑色
      colorBgContainer: '#ffffff',     // 强制背景色为白色
      colorWhite: '#000000',           // 将圆点颜色（原本是白色）改为黑色
      radioSize: 16,                   // 单选框大小
      dotSize: 8,                      // 选中时内部圆点大小
      dotColorDisabled: 'rgba(0, 0, 0, 0.25)', // 禁用状态圆点颜色
      wrapperMarginInlineEnd: 8,       // 单选框右间距

      // Radio.Button 按钮样式
      buttonBg: '#ffffff',             // 单选按钮背景色
      buttonCheckedBg: '#000000',      // 选中单选按钮背景色（黑色）
      buttonColor: 'rgba(0, 0, 0, 0.88)', // 单选按钮文字颜色
      buttonCheckedColorDisabled: 'rgba(0, 0, 0, 0.25)', // 单选框按钮选中并禁用时的文本颜色
      buttonPaddingInline: 15,         // 单选按钮横向内间距
      buttonSolidCheckedColor: '#ffffff', // 实心单选按钮选中时的文本颜色
      buttonSolidCheckedBg: '#000000',  // 实色按钮选中时的背景色
      buttonSolidCheckedHoverBg: '#333333', // 实色按钮选中时的悬浮态背景色
      buttonSolidCheckedActiveBg: '#000000', // 实色按钮选中时的激活态背景色
    },

    // === Upload 上传组件 ===
    Upload: {
      actionsColor: 'rgba(0, 0, 0, 0.45)', // 上传操作按钮颜色
    },

    // === Tooltip 提示框组件 ===
    Tooltip: {
      borderRadius: 2,                 // 提示框边框圆角
      colorBgSpotlight: 'rgba(0, 0, 0, 0.85)', // 提示框背景色
    },

    // === Message 消息提示组件 ===
    Message: {
      contentBg: '#ffffff',            // 消息背景色
      contentPadding: '10px 16px',     // 消息内边距
    },
  },
};

/**
 * 导出默认主题配置
 */
export default testCaseTheme;
