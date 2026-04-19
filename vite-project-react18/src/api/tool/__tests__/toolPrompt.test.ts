import { describe, expect, it } from 'vitest';
import { GET_TOOL_LIST } from '../api';
import { buildGroupedMatchPrompt, buildSingleTableMatchPrompt } from '../copyDeckPrompt';
import { buildLanguageComparePrompt } from '../languageComparePrompt';

describe('tool prompt builders', () => {
  it('exports the tool list api constant', () => {
    expect(GET_TOOL_LIST).toBe('aether/api/v1/mcp/tools');
  });

  it('builds a grouped match prompt with numeric ids and filenames', () => {
    const prompt = buildGroupedMatchPrompt(
      [{ fileName: 'one.png' }, { fileName: 'two.png' }],
      [{ group: 'Login', rows: [{ customId: '1', copyValue: 'Username' }] }],
    );

    expect(prompt).toContain('Match 1 groups to 2 images');
    expect(prompt).toContain('"customId": 1');
    expect(prompt).toContain('"fileName": "one.png"');
    expect(prompt).toContain('fileName must be one of: one.png, two.png');
  });

  it('builds a single-table match prompt with consecutive metadata', () => {
    const prompt = buildSingleTableMatchPrompt(
      [{ fileName: 'single.png' }],
      [
        [
          { customId: '1', copyValue: 'First' },
          { customId: '2', copyValue: 'Second' },
        ],
        [{ customId: '4', copyValue: 'Fourth' }],
      ],
    );

    expect(prompt).toContain('"type": "consecutive"');
    expect(prompt).toContain('"type": "individual"');
    expect(prompt).toContain('"customIds": [');
    expect(prompt).toContain('"totalRows": 3');
    expect(prompt).toContain('fileName: Must be one of: single.png');
  });

  it('builds a language comparison prompt with languages and input data', () => {
    const prompt = buildLanguageComparePrompt('en', 'zh-cn', [
      { rowIndex: 1, referenceValue: 'Save', targetValue: '保存' },
      { rowIndex: 2, referenceValue: 'Delete', targetValue: '删除' },
    ]);

    expect(prompt).toContain('Analyze 2 text pairs');
    expect(prompt).toContain('referenceValue (en)');
    expect(prompt).toContain('targetValue (zh-cn)');
    expect(prompt).toContain('"rowIndex": 2');
    expect(prompt).toContain('Execute the audit and return ONLY rows with issues.');
  });
});
