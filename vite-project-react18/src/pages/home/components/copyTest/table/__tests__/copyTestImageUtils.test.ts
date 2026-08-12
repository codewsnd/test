import { describe, expect, it } from 'vitest';
import {
  getCopyTestImageDisplayFileName,
  getCopyTestImageDisplayName,
  getCopyTestImageId,
} from '../copyTestImageUtils';

describe('copyTestImageUtils', () => {
  it('始终使用 fileName 作为唯一图片 ID', () => {
    expect(getCopyTestImageId({ base64: 'x', fileName: 'a.png' })).toBe('a.png');
  });

  it('优先展示用户原始文件名并去掉最后一段扩展名', () => {
    const image = {
      base64: 'x',
      fileName: '0198f4e0-0000-7000-8000-000000000000.png',
      originalFileName: 'This is just test.final.PNG',
    };

    expect(getCopyTestImageDisplayFileName(image)).toBe('This is just test.final.PNG');
    expect(getCopyTestImageDisplayName(image)).toBe('This is just test.final');
  });

  it('保留中文和多点文件名的主体', () => {
    const image = {
      base64: 'x',
      fileName: '0198f4e0-0001-7000-8000-000000000000.png',
      originalFileName: '首页.最终版.PNG',
    };

    expect(getCopyTestImageDisplayName(image)).toBe('首页.最终版');
  });

  it('没有原始文件名时显示不带扩展名的 UUID', () => {
    const image = {
      base64: 'x',
      fileName: '0198f4e0-0000-7000-8000-000000000000.webp',
    };

    expect(getCopyTestImageDisplayName(image)).toBe('0198f4e0-0000-7000-8000-000000000000');
  });

  it('兼容附件名回退、隐藏文件和外部路径', () => {
    expect(getCopyTestImageDisplayName({ base64: 'x', fileName: 'screen.png' }))
      .toBe('screen');
    expect(getCopyTestImageDisplayName({ base64: 'x', fileName: '.screen' }))
      .toBe('.screen');
    expect(getCopyTestImageDisplayName({ base64: 'x', fileName: 'folder\\screen.webp' }))
      .toBe('screen');
  });
});
