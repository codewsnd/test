import type { ThemeConfig } from 'antd';

/**
 * 汇丰聊天界面专属主题配置
 * 基于汇丰银行的视觉规范设计
 */
export const hsbcChatTheme: ThemeConfig = {
  token: {
    // === 汇丰品牌主色 ===
    colorPrimary: '#DB0011', // 汇丰红
    colorInfo: '#DB0011',
    colorSuccess: '#00847F', // 汇丰绿（辅助色）

    // === 中性色系 ===
    colorTextBase: '#333333', // 主文本颜色
    colorBgBase: '#FFFFFF', // 主背景色

    // === 边框设置 ===
    borderRadius: 0, // 汇丰风格：直角设计

    // === 字体设置 ===
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 16,
  },

  components: {
    // === Layout 布局组件 ===
    Layout: {
      headerBg: '#FFFFFF',
      siderBg: '#F7F7F7', // 侧边栏背景色
      bodyBg: '#FFFFFF',
      triggerBg: '#DB0011',
      triggerColor: '#FFFFFF',
    },

    // === Button 按钮组件 ===
    Button: {
      borderRadius: 0, // 直角按钮
      primaryColor: '#FFFFFF',
      colorPrimary: '#DB0011',
      colorPrimaryHover: '#B8000E',
      colorPrimaryActive: '#9A000C',
      defaultBorderColor: '#CCCCCC',
      defaultColor: '#333333',
    },

    // === Avatar 头像组件 ===
    Avatar: {
      borderRadius: 0, // 方形头像，符合汇丰风格
      containerSize: 36,
      containerSizeLG: 40,
      containerSizeSM: 32,
    },

    // === Input 输入框组件 ===
    Input: {
      borderRadius: 0,
      activeBorderColor: '#DB0011',
      hoverBorderColor: '#DB0011',
      activeShadow: '0 0 0 2px rgba(219, 0, 17, 0.1)',
    },

    // === Menu 菜单组件 ===
    Menu: {
      borderRadius: 0,
      itemSelectedBg: 'rgba(219, 0, 17, 0.08)',
      itemSelectedColor: '#DB0011',
      itemHoverBg: 'rgba(219, 0, 17, 0.04)',
      itemHoverColor: '#DB0011',
    },
  },
};
