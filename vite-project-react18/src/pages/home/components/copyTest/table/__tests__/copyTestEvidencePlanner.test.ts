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
  rowSpan = 1,
  evidenceGroupId = 1
): CopyTestEvidenceSourceGroup => ({
  anchorRowIndex,
  evidenceGroupId,
  evidenceImages,
  hasResult: true,
  rowSpan,
  selected: true,
});

describe('copyTestEvidencePlanner', () => {
  it('按结构组合并命中不同图片的连续行，并在平票时选择先上传的唯一图片', () => {
    /** 两行没有共享图片，但属于同一稳定结构组。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1]),
      sourceGroup(2, [SCREEN_2]),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].anchorRowIndex).toBe(1);
    expect(plan[0].rowSpan).toBe(2);
    expect(plan[0].sourceGroups.map(group => group.anchorRowIndex)).toEqual([1, 2]);
    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([SCREEN_1.fileName]);
    expect(plan[0].screenLabelByFileName).toEqual({
      [SCREEN_1.fileName]: 'screen-01',
    });
    expect(plan[0].rowResults.map(result => result.screens.map(screen => screen.label))).toEqual([
      ['screen-01'],
      ['screen-01'],
    ]);
  });

  it('按覆盖有结果来源行的票数选择唯一 winner', () => {
    /** Screen02 覆盖两行，其余候选各覆盖一行。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1, SCREEN_2]),
      sourceGroup(2, [SCREEN_2]),
      sourceGroup(3, [SCREEN_3]),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([SCREEN_2.fileName]);
    expect(plan[0].rowResults.map(result => result.screens[0]?.image.fileName)).toEqual([
      SCREEN_2.fileName,
      SCREEN_2.fileName,
      SCREEN_2.fileName,
    ]);
  });

  it('无图时仍保留完整结构组，未选或无结果行只贡献 rowspan', () => {
    /** 同组包含有结果无图行、未选行和无结果行。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, []),
      { ...sourceGroup(2, [SCREEN_1], 2), selected: false },
      { ...sourceGroup(4, [SCREEN_1]), hasResult: false },
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].rowSpan).toBe(4);
    expect(plan[0].screens).toEqual([]);
    expect(plan[0].screenLabelByFileName).toEqual({});
    expect(plan[0].sourceGroups.map(group => group.anchorRowIndex)).toEqual([1, 2, 4]);
    expect(plan[0].rowResults).toEqual([{
      anchorRowIndex: 1,
      rowSpan: 1,
      screens: [],
    }]);
  });

  it('不同 evidenceGroupId 或物理不连续时绝不跨边界合并', () => {
    /** 第二行使用新组标识，第四行与第二行同组但物理不连续。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1], 1, 10),
      sourceGroup(2, [SCREEN_1], 1, 20),
      sourceGroup(4, [SCREEN_1], 1, 20),
    ], UPLOADED_IMAGES);

    expect(plan.map(group => group.anchorRowIndex)).toEqual([1, 2, 4]);
    expect(plan.every(group => group.rowSpan === 1)).toBe(true);
  });

  it('累加同一结构组中不可拆分来源原子组的 rowspan', () => {
    /** 两个来源原子组分别覆盖两行和三行。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1], 2, 30),
      sourceGroup(3, [SCREEN_1], 3, 30),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].rowSpan).toBe(5);
    expect(plan[0].sourceGroups.map(group => group.rowSpan)).toEqual([2, 3]);
    expect(plan[0].rowResults.map(result => result.rowSpan)).toEqual([2, 3]);
  });

  it('按上传顺序去重候选并排除未上传图片', () => {
    /** 模型返回但不属于本批上传的未知图片。 */
    const unknownImage: CopyTestImage = { base64: IMAGE_BASE64, fileName: 'unknown.png' };
    /** Screen02 虽在输入中靠前，平票仍由上传顺序选择 Screen01。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_2, unknownImage, SCREEN_1]),
    ], [SCREEN_1, SCREEN_1, SCREEN_2, SCREEN_3]);

    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([SCREEN_1.fileName]);
    expect(plan[0].screenLabelByFileName).toEqual({ [SCREEN_1.fileName]: 'screen-01' });
    expect(plan[0].screenLabelByFileName).not.toHaveProperty(unknownImage.fileName);
  });

  it('优先使用原始文件名且只去掉最后一段扩展名', () => {
    const englishImage: CopyTestImage = {
      base64: IMAGE_BASE64,
      fileName: '0198f4e0-0000-7000-8000-000000000000.png',
      originalFileName: 'This is just test.png',
    };
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [englishImage]),
    ], [englishImage]);

    expect(plan[0].screens.map(screen => screen.label)).toEqual(['This is just test']);
    expect(plan[0].screenLabelByFileName).toEqual({
      [englishImage.fileName]: 'This is just test',
    });
  });

  it('没有原始文件名时显示不带扩展名的 UUID', () => {
    const uuidImage: CopyTestImage = {
      base64: IMAGE_BASE64,
      fileName: '0198f4e0-0000-7000-8000-000000000000.webp',
    };
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [uuidImage]),
    ], [uuidImage]);

    expect(plan[0].screens[0].label).toBe('0198f4e0-0000-7000-8000-000000000000');
  });
});
