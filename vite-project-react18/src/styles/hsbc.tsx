import type { ThemeConfig } from 'antd';

/**
 * 全局主题配置
 */
export const hsbcTheme: ThemeConfig = {
  components: {
    Card: {
      // === 移除 Card 组件的圆角边框 ===
      // 设置所有尺寸的边框半径为 0，保持专业的直角设计
      borderRadius: 0,      // 默认尺寸的边框半径
      borderRadiusLG: 0,    // 大尺寸的边框半径
      borderRadiusSM: 0,    // 小尺寸的边框半径

      // === Card 内边距设置 ===
      paddingLG: 20,        // Card body 的内边距设置为 20px
      padding: 16,          // Card header 和其他部分的默认内边距为 16px
    },
  },
};
