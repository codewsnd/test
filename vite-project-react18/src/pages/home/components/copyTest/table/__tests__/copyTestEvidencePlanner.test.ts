import { describe, expect, it } from 'vitest';
import type { CopyTestImage } from '../../api/copyTestApi';
import {
  planCopyTestEvidenceGroups,
  type CopyTestEvidenceSourceGroup,
} from '../copyTestEvidencePlanner';

/** 测试图片共用的最小 data URL。 */
const IMAGE_BASE64 = 'data:image/png;base64,QUJD';

/** Screen01 对应的上传图片。 */
const SCREEN_1: CopyTestImage = { base64: IMAGE_BASE64, fileName: 'screen-01.png' };

/** Screen02 对应的上传图片。 */
const SCREEN_2: CopyTestImage = { base64: IMAGE_BASE64, fileName: 'screen-02.png' };

/** 不应进入结果的第三张上传图片。 */
const SCREEN_3: CopyTestImage = { base64: IMAGE_BASE64, fileName: 'screen-03.png' };

/** Planner 使用的规范上传图片顺序。 */
const UPLOADED_IMAGES = [SCREEN_1, SCREEN_2, SCREEN_3];

/** 构造一个已选择且已有校验结果的来源原子组。 */
const sourceGroup = (
  anchorRowIndex: number,
  evidenceImages: CopyTestImage[],
  rowSpan = 1
): CopyTestEvidenceSourceGroup => ({
  anchorRowIndex,
  evidenceImages,
  hasResult: true,
  rowSpan,
  selected: true,
});

describe('copyTestEvidencePlanner', () => {
  it('合并共享图片的三行并为每行 Result 保留自己的 Screen 子集', () => {
    /** 用户核心案例对应的 Evidence 规划。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1]),
      sourceGroup(2, [SCREEN_1]),
      sourceGroup(3, [SCREEN_1, SCREEN_2]),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].anchorRowIndex).toBe(1);
    expect(plan[0].rowSpan).toBe(3);
    expect(plan[0].sourceGroups.map(group => group.anchorRowIndex)).toEqual([1, 2, 3]);
    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([
      SCREEN_1.fileName,
      SCREEN_2.fileName,
    ]);
    expect(plan[0].screenLabelByFileName).toEqual({
      [SCREEN_1.fileName]: 'Screen01 (screen-01)',
      [SCREEN_2.fileName]: 'Screen02 (screen-02)',
    });
    expect(plan[0].rowResults.map(result => result.screens.map(screen => screen.label))).toEqual([
      ['Screen01 (screen-01)'],
      ['Screen01 (screen-01)'],
      ['Screen01 (screen-01)', 'Screen02 (screen-02)'],
    ]);
  });

  it('通过中间行的共享图片传递合并并累加不可拆分来源 rowspan', () => {
    /** rowspan 分别为 1、2、1 的传递合并规划。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1]),
      sourceGroup(2, [SCREEN_2, SCREEN_1], 2),
      sourceGroup(4, [SCREEN_2]),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].rowSpan).toBe(4);
    expect(plan[0].sourceGroups.map(group => group.rowSpan)).toEqual([1, 2, 1]);
    expect(plan[0].screens.map(screen => screen.label)).toEqual([
      'Screen01 (screen-01)',
      'Screen02 (screen-02)',
    ]);
    expect(plan[0].rowResults[1].screens.map(screen => screen.label)).toEqual([
      'Screen01 (screen-01)',
      'Screen02 (screen-02)',
    ]);
  });

  it('把空图片行作为强制边界且不跨边界合并相同图片', () => {
    /** 中间空图片行分隔出的两个 Evidence 组。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1]),
      sourceGroup(2, []),
      sourceGroup(3, [SCREEN_1]),
    ], UPLOADED_IMAGES);

    expect(plan.map(group => group.anchorRowIndex)).toEqual([1, 3]);
    expect(plan.map(group => group.rowSpan)).toEqual([1, 1]);
    expect(plan.map(group => group.screens[0].label)).toEqual([
      'Screen01 (screen-01)',
      'Screen01 (screen-01)',
    ]);
  });

  it('不合并图片不相交、未选择、无结果或物理不连续的来源原子组', () => {
    /** 包含四种合并边界的来源原子组。 */
    const groups: CopyTestEvidenceSourceGroup[] = [
      sourceGroup(1, [SCREEN_1]),
      sourceGroup(2, [SCREEN_2]),
      { ...sourceGroup(3, [SCREEN_2]), selected: false },
      { ...sourceGroup(4, [SCREEN_2]), hasResult: false },
      sourceGroup(5, [SCREEN_2]),
      sourceGroup(7, [SCREEN_2]),
    ];
    /** 所有边界处理完成后的 Evidence 规划。 */
    const plan = planCopyTestEvidenceGroups(groups, UPLOADED_IMAGES);

    expect(plan.map(group => group.anchorRowIndex)).toEqual([1, 2, 5, 7]);
    expect(plan.every(group => group.rowSpan === 1)).toBe(true);
  });

  it('按上传顺序去重图片并排除未命中或不在上传列表中的图片', () => {
    /** 模拟模型返回但不属于本批上传的未知图片。 */
    const unknownImage: CopyTestImage = { base64: IMAGE_BASE64, fileName: 'unknown.png' };
    /** 图片顺序混乱且带未知图片时的 Evidence 规划。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_2, unknownImage, SCREEN_1]),
    ], [SCREEN_1, SCREEN_1, SCREEN_2, SCREEN_3]);

    expect(plan).toHaveLength(1);
    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([
      SCREEN_1.fileName,
      SCREEN_2.fileName,
    ]);
    expect(plan[0].rowResults[0].screens.map(screen => screen.label)).toEqual([
      'Screen01 (screen-01)',
      'Screen02 (screen-02)',
    ]);
    expect(plan[0].screenLabelByFileName).not.toHaveProperty(SCREEN_3.fileName);
    expect(plan[0].screenLabelByFileName).not.toHaveProperty(unknownImage.fileName);
  });

  it('优先使用用户原始文件名且不显示扩展名', () => {
    const uploadedImage: CopyTestImage = {
      base64: IMAGE_BASE64,
      fileName: '0198f4e0-0000-7000-8000-000000000000.png',
      originalFileName: 'This is just test.png',
    };
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [uploadedImage]),
    ], [uploadedImage]);

    expect(plan[0].screens[0].label).toBe('Screen01 (This is just test)');
    expect(plan[0].screenLabelByFileName).toEqual({
      [uploadedImage.fileName]: 'Screen01 (This is just test)',
    });
  });
});
