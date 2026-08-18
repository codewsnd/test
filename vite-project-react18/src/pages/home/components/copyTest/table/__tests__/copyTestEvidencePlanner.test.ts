import { describe, expect, it } from 'vitest';
import type { CopyTestImage } from '../../api/copyTestApi';
import {
  planCopyTestEvidenceGroups,
  type CopyTestEvidenceSourceGroup,
} from '../copyTestEvidencePlanner';

/** Screen01 对应的上传图片。 */
const SCREEN_1: CopyTestImage = {
  base64: 'data:image/png;base64,QUJD',
  fileName: 'screen-01.png',
};

/** Screen02 对应的上传图片。 */
const SCREEN_2: CopyTestImage = {
  base64: 'data:image/png;base64,REVG',
  fileName: 'screen-02.png',
};

/** 不应进入结果的第三张上传图片。 */
const SCREEN_3: CopyTestImage = {
  base64: 'data:image/png;base64,R0hJ',
  fileName: 'screen-03.png',
};

/** Planner 使用的规范上传图片顺序。 */
const UPLOADED_IMAGES = [SCREEN_1, SCREEN_2, SCREEN_3];

/** 构造一个已选择且已有校验结果的来源原子组。 */
const sourceGroup = (
  anchorRowIndex: number,
  evidenceImages: CopyTestImage[],
  rowSpan = 1,
  evidenceGroupId = 1,
  currentEvidenceFileName?: string
): CopyTestEvidenceSourceGroup => ({
  anchorRowIndex,
  currentEvidenceFileName,
  evidenceGroupId,
  evidenceImages,
  hasResult: true,
  rowSpan,
  selected: true,
});

describe('copyTestEvidencePlanner', () => {
  it('按持久结构组合并连续行，并保留各批累计的唯一图片', () => {
    /** 两行没有共享图片，但属于同一稳定结构组。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1]),
      sourceGroup(2, [SCREEN_2]),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].anchorRowIndex).toBe(1);
    expect(plan[0].rowSpan).toBe(2);
    expect(plan[0].sourceGroups.map(group => group.anchorRowIndex)).toEqual([1, 2]);
    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([
      SCREEN_1.fileName,
      SCREEN_2.fileName,
    ]);
    expect(plan[0].screenLabelByFileName).toEqual({
      [SCREEN_1.fileName]: 'screen-01',
      [SCREEN_2.fileName]: 'screen-02',
    });
    expect(plan[0].rowResults.map(result => result.screens.map(screen => screen.label))).toEqual([
      ['screen-01', 'screen-02'],
      ['screen-01', 'screen-02'],
    ]);
  });

  it('按历史图片顺序保留结构组内全部累计 winner', () => {
    /** 同一结构组历次结果累计引用三张不同图片。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1, SCREEN_2]),
      sourceGroup(2, [SCREEN_2]),
      sourceGroup(3, [SCREEN_3]),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([
      SCREEN_1.fileName,
      SCREEN_2.fileName,
      SCREEN_3.fileName,
    ]);
    expect(plan[0].rowResults.map(result => result.screens.map(screen => screen.image.fileName))).toEqual([
      [SCREEN_1.fileName, SCREEN_2.fileName, SCREEN_3.fileName],
      [SCREEN_1.fileName, SCREEN_2.fileName, SCREEN_3.fileName],
      [SCREEN_1.fileName, SCREEN_2.fileName, SCREEN_3.fileName],
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

  it('没有本轮共同 winner 时不同 evidenceGroupId 仍各自保留历史', () => {
    /** 第一行已有两批历史图片，其余独立原子行各用自己的图片。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_2, SCREEN_1], 1, 10),
      sourceGroup(2, [SCREEN_2], 1, 20),
      sourceGroup(4, [SCREEN_3], 1, 20),
    ], UPLOADED_IMAGES);

    expect(plan.map(group => group.anchorRowIndex)).toEqual([1, 2, 4]);
    expect(plan.every(group => group.rowSpan === 1)).toBe(true);
    expect(plan.map(group => group.screens.map(screen => screen.image.fileName))).toEqual([
      [SCREEN_1.fileName, SCREEN_2.fileName],
      [SCREEN_2.fileName],
      [SCREEN_3.fileName],
    ]);
  });

  it('同轮相邻原子选择同一 singleton 时合并，并可从 12 单调扩展到 123', () => {
    /** 前两行是已持久化组，本轮三行共同选择新的 Screen02。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1, SCREEN_2], 1, 10, SCREEN_2.fileName),
      sourceGroup(2, [SCREEN_1, SCREEN_2], 1, 10, SCREEN_2.fileName),
      sourceGroup(3, [SCREEN_2], 1, 30, SCREEN_2.fileName),
    ], UPLOADED_IMAGES);

    expect(plan).toHaveLength(1);
    expect(plan[0].rowSpan).toBe(3);
    expect(plan[0].sourceGroups.map(group => group.anchorRowIndex)).toEqual([1, 2, 3]);
    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([
      SCREEN_1.fileName,
      SCREEN_2.fileName,
    ]);
  });

  it('不跨未参与本轮校验的原子扩展动态组', () => {
    /** 第二行缺少本轮 winner，因此第三行不得通过相同文件名越过它。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1], 1, 10, SCREEN_1.fileName),
      sourceGroup(2, [SCREEN_1], 1, 10),
      sourceGroup(3, [SCREEN_1], 1, 30, SCREEN_1.fileName),
    ], UPLOADED_IMAGES);

    expect(plan.map(group => group.sourceGroups.map(source => source.anchorRowIndex))).toEqual([
      [1, 2],
      [3],
    ]);
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

  it('按历史顺序去重累计图片并排除未知图片', () => {
    /** 模型返回但不属于本批上传的未知图片。 */
    const unknownImage: CopyTestImage = {
      base64: 'data:image/png;base64,SktM',
      fileName: 'unknown.png',
    };
    /** 结果引用顺序不覆盖稳定的历史图片顺序。 */
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_2, unknownImage, SCREEN_1]),
    ], [SCREEN_1, SCREEN_1, SCREEN_2, SCREEN_3]);

    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([
      SCREEN_1.fileName,
      SCREEN_2.fileName,
    ]);
    expect(plan[0].screenLabelByFileName).toEqual({
      [SCREEN_1.fileName]: 'screen-01',
      [SCREEN_2.fileName]: 'screen-02',
    });
    expect(plan[0].screenLabelByFileName).not.toHaveProperty(unknownImage.fileName);
  });

  it('跨批次重新上传同一图片时保留最早身份', () => {
    /** 同一图片在后续批次生成的新附件名。 */
    const repeatedScreen: CopyTestImage = {
      ...SCREEN_1,
      fileName: 'screen-01-reuploaded.png',
    };
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1, repeatedScreen]),
    ], [SCREEN_1, repeatedScreen]);

    expect(plan[0].screens.map(screen => screen.image.fileName)).toEqual([
      SCREEN_1.fileName,
    ]);
  });

  it('相同内容的图片在不同独立组中仍保留各自身份', () => {
    /** 另一独立组历史引用的同内容附件。 */
    const independentScreen: CopyTestImage = {
      ...SCREEN_1,
      fileName: 'independent-screen.png',
    };
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [SCREEN_1], 1, 10),
      sourceGroup(2, [independentScreen], 1, 20),
    ], [SCREEN_1, independentScreen]);

    expect(plan.map(group => group.screens.map(screen => screen.image.fileName))).toEqual([
      [SCREEN_1.fileName],
      [independentScreen.fileName],
    ]);
  });

  it('优先使用原始文件名且只去掉最后一段扩展名', () => {
    const englishImage: CopyTestImage = {
      base64: SCREEN_1.base64,
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
      base64: SCREEN_1.base64,
      fileName: '0198f4e0-0000-7000-8000-000000000000.webp',
    };
    const plan = planCopyTestEvidenceGroups([
      sourceGroup(1, [uuidImage]),
    ], [uuidImage]);

    expect(plan[0].screens[0].label).toBe('0198f4e0-0000-7000-8000-000000000000');
  });
});
