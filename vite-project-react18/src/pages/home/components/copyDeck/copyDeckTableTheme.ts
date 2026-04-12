import type { ThemeConfig } from 'antd';

/**
 * CopyDeck Table Design Token Configuration
 */
export const copyDeckTableTheme: ThemeConfig = {
  components: {
    Table: {
      // === 边框设置 ===
      borderColor: '#D7D8D6', // 表格边框使用浅灰色

      // === 表头样式 ===
      headerBg: '#EDEDED', // 标准灰色背景
      // headerBg: '#D7D8D6', // 标准灰色背景
      headerColor: '#333333', // 深灰色文字
      headerBorderRadius: 0, // 无圆角，保持专业感
      headerSplitColor: 'transparent', // 移除表头列分隔线

      // === 行样式 ===
      rowHoverBg: '#EDEDED', // 悬停时浅灰色背景
      rowSelectedBg: '#EDEDED', // 选中时使用的极浅色调
      rowSelectedHoverBg: '#EDEDED', // 选中且悬停时稍深的红色调

      // === 单元格样式 ===
      cellPaddingBlock: 16, // 垂直内边距 - 较大的间距提供舒适感
      cellPaddingInline: 16, // 水平内边距
      cellPaddingBlockSM: 12, // small 尺寸的垂直内边距
      cellPaddingInlineSM: 12, // small 尺寸的水平内边距

      // === 边框半径 ===
      borderRadiusLG: 0, // 保持专业的直角设计

      // === 表格背景 ===
      bodySortBg: '#FAFAFA', // 排序列的背景色
      headerSortActiveBg: '#F0F0F0', // 排序激活的表头背景
      headerSortHoverBg: '#F5F5F5', // 排序悬停的表头背景
      headerFilterHoverBg: '#F5F5F5', // 筛选悬停背景

      // === 字体设置 ===
      cellFontSize: 14, // 标准字号
      cellFontSizeSM: 14, // small 尺寸保持相同字号

      // === 固定列阴影 ===
      fixedHeaderSortActiveBg: '#F0F0F0',

      // === 展开行背景 ===
      rowExpandedBg: '#FAFAFA',
    },
  },
};


