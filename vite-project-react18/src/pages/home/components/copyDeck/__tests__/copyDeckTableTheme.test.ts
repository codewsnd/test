import { describe, it, expect } from 'vitest';
import { copyDeckTableTheme } from '../copyDeckTableTheme';

describe('copyDeckTableTheme', () => {
  it('should export a valid theme config object', () => {
    expect(copyDeckTableTheme).toBeDefined();
    expect(typeof copyDeckTableTheme).toBe('object');
  });

  it('should have components property', () => {
    expect(copyDeckTableTheme.components).toBeDefined();
  });

  it('should have Table configuration', () => {
    expect(copyDeckTableTheme.components?.Table).toBeDefined();
  });

  it('should set correct border color', () => {
    expect(copyDeckTableTheme.components?.Table?.borderColor).toBe('#D7D8D6');
  });

  it('should set correct header background', () => {
    expect(copyDeckTableTheme.components?.Table?.headerBg).toBe('#EDEDED');
  });

  it('should set correct header color', () => {
    expect(copyDeckTableTheme.components?.Table?.headerColor).toBe('#333333');
  });

  it('should set header border radius to 0', () => {
    expect(copyDeckTableTheme.components?.Table?.headerBorderRadius).toBe(0);
  });

  it('should set header split color to transparent', () => {
    expect(copyDeckTableTheme.components?.Table?.headerSplitColor).toBe('transparent');
  });

  it('should set correct row hover background', () => {
    expect(copyDeckTableTheme.components?.Table?.rowHoverBg).toBe('#EDEDED');
  });

  it('should set correct row selected background', () => {
    expect(copyDeckTableTheme.components?.Table?.rowSelectedBg).toBe('#EDEDED');
  });

  it('should set correct row selected hover background', () => {
    expect(copyDeckTableTheme.components?.Table?.rowSelectedHoverBg).toBe('#EDEDED');
  });

  it('should set correct cell padding block', () => {
    expect(copyDeckTableTheme.components?.Table?.cellPaddingBlock).toBe(16);
  });

  it('should set correct cell padding inline', () => {
    expect(copyDeckTableTheme.components?.Table?.cellPaddingInline).toBe(16);
  });

  it('should set correct small cell padding block', () => {
    expect(copyDeckTableTheme.components?.Table?.cellPaddingBlockSM).toBe(12);
  });

  it('should set correct small cell padding inline', () => {
    expect(copyDeckTableTheme.components?.Table?.cellPaddingInlineSM).toBe(12);
  });

  it('should set border radius to 0', () => {
    expect(copyDeckTableTheme.components?.Table?.borderRadiusLG).toBe(0);
  });

  it('should set correct body sort background', () => {
    expect(copyDeckTableTheme.components?.Table?.bodySortBg).toBe('#FAFAFA');
  });

  it('should set correct header sort active background', () => {
    expect(copyDeckTableTheme.components?.Table?.headerSortActiveBg).toBe('#F0F0F0');
  });

  it('should set correct header sort hover background', () => {
    expect(copyDeckTableTheme.components?.Table?.headerSortHoverBg).toBe('#F5F5F5');
  });

  it('should set correct header filter hover background', () => {
    expect(copyDeckTableTheme.components?.Table?.headerFilterHoverBg).toBe('#F5F5F5');
  });

  it('should set correct cell font size', () => {
    expect(copyDeckTableTheme.components?.Table?.cellFontSize).toBe(14);
  });

  it('should set correct small cell font size', () => {
    expect(copyDeckTableTheme.components?.Table?.cellFontSizeSM).toBe(14);
  });

  it('should set correct fixed header sort active background', () => {
    expect(copyDeckTableTheme.components?.Table?.fixedHeaderSortActiveBg).toBe('#F0F0F0');
  });

  it('should set correct row expanded background', () => {
    expect(copyDeckTableTheme.components?.Table?.rowExpandedBg).toBe('#FAFAFA');
  });

  it('should have all numeric values as numbers', () => {
    const tableConfig = copyDeckTableTheme.components?.Table;
    if (tableConfig) {
      expect(typeof tableConfig.cellPaddingBlock).toBe('number');
      expect(typeof tableConfig.cellPaddingInline).toBe('number');
      expect(typeof tableConfig.cellPaddingBlockSM).toBe('number');
      expect(typeof tableConfig.cellPaddingInlineSM).toBe('number');
      expect(typeof tableConfig.cellFontSize).toBe('number');
      expect(typeof tableConfig.cellFontSizeSM).toBe('number');
      expect(typeof tableConfig.headerBorderRadius).toBe('number');
      expect(typeof tableConfig.borderRadiusLG).toBe('number');
    }
  });

  it('should have all color values as strings', () => {
    const tableConfig = copyDeckTableTheme.components?.Table;
    if (tableConfig) {
      expect(typeof tableConfig.borderColor).toBe('string');
      expect(typeof tableConfig.headerBg).toBe('string');
      expect(typeof tableConfig.headerColor).toBe('string');
      expect(typeof tableConfig.headerSplitColor).toBe('string');
      expect(typeof tableConfig.rowHoverBg).toBe('string');
      expect(typeof tableConfig.rowSelectedBg).toBe('string');
      expect(typeof tableConfig.rowSelectedHoverBg).toBe('string');
    }
  });
});
