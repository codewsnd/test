import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  getColumnIndexes,
  parseEvidenceData,
  parseResultJSON,
  getRowIndexByCustomId,
  findRowsByCustomGroup,
  updateCellData,
  updateResultJSON,
  copyDeckSidebarVisibleAtom,
  copyDeckFullscreenAtom,
  copyDeckCurrentViewAtom,
  copyDeckMessageAtom,
  copyDeckConfluenceInfoAtom,
  copyDeckStorageHtmlAtom,
  copyDeckCurrentTableHtmlAtom,
  copyDeckRenderTableDataAtom,
  copyDeckOriginalTableDataAtom,
  copyDeckTableImageAtom,
  copyDeckValuesArrayAtom,
  copyDeckSelectedLanguageAtom,
  copyDeckShowUncomparedAtom,
  copyDeckSelectedRowsAtom,
  copyDeckLanguageTableDataAtom,
  copyDeckGroupTableDataAtom,
  showCopyDeckSidebarAtom,
  hideCopyDeckSidebarAtom,
  toggleCopyDeckFullscreenAtom,
  type CellInfo,
  type CheckResultJSON,
  type OperationImageData
} from '../copyDeckAtom';

describe('copyDeckAtom', () => {
  describe('getColumnIndexes', () => {
    it('should find all column indexes correctly', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Result|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.customId).toBe(0);
      expect(result.customGroup).toBe(1);
      expect(result.copy).toBe(2);
      expect(result.result).toBe(3);
      expect(result.evidence).toBe(4);
    });

    it('should return -1 for missing columns', () => {
      const headerRow: CellInfo[] = [
        { value: 'Other Column', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.customId).toBe(-1);
      expect(result.customGroup).toBe(-1);
      expect(result.copy).toBe(-1);
      expect(result.result).toBe(-1);
      expect(result.evidence).toBe(-1);
    });

    it('should handle legacy custom group format', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_GROUP|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.customGroup).toBe(1);
    });

    it('should handle header with Test Evidence column', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.evidence).toBe(1);
    });

    it('should handle TestEvidence without space', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'TestEvidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.evidence).toBe(1);
    });

    it('should handle TestResult column', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'TestResult|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.result).toBe(1);
    });

    it('should exclude columns with copydeck_custom in copy search', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_OTHER|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.copy).toBe(2);
    });

    it('should exclude columns with testresult in copy search', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'TestResult|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.copy).toBe(2);
    });

    it('should exclude columns with evidence in copy search', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Evidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.copy).toBe(2);
    });
  });

  describe('parseEvidenceData', () => {
    it('should parse valid JSON array', () => {
      const jsonStr = '[{"fileName":"test.png","base64":"data:image/png;base64,test"}]';
      const result = parseEvidenceData(jsonStr);

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe('test.png');
      expect(result[0].base64).toBe('data:image/png;base64,test');
    });

    it('should return empty array for invalid JSON', () => {
      const result = parseEvidenceData('invalid json');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      const result = parseEvidenceData('');
      expect(result).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      const result = parseEvidenceData('{"key":"value"}');
      expect(result).toEqual([]);
    });

    it('should handle whitespace-only string', () => {
      const result = parseEvidenceData('   ');
      expect(result).toEqual([]);
    });

    it('should handle array with multiple items', () => {
      const jsonStr = '[{"fileName":"img1.png","base64":"abc"},{"fileName":"img2.png","base64":"def"}]';
      const result = parseEvidenceData(jsonStr);

      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe('img1.png');
      expect(result[1].fileName).toBe('img2.png');
    });

    it('should handle null value', () => {
      const result = parseEvidenceData('null');
      expect(result).toEqual([]);
    });
  });

  describe('parseResultJSON', () => {
    it('should parse new array format', () => {
      const jsonStr = '[{"fileName":"test.png","passed":true},{"fileName":"test2.png","passed":false,"discrepancies":[]}]';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(1);
      expect(result.FAILED).toHaveLength(1);
      expect(result.PASS[0].filename).toBe('test.png');
      expect(result.FAILED[0].filename).toBe('test2.png');
    });

    it('should parse old object format', () => {
      const jsonStr = '{"PASS":[{"filename":"test.png"}],"FAILED":[{"filename":"test2.png"}]}';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(1);
      expect(result.FAILED).toHaveLength(1);
    });

    it('should return empty PASS and FAILED for invalid JSON', () => {
      const result = parseResultJSON('invalid');

      expect(result).toEqual({ PASS: [], FAILED: [] });
    });

    it('should handle empty string', () => {
      const result = parseResultJSON('');

      expect(result).toEqual({ PASS: [], FAILED: [] });
    });

    it('should handle null value', () => {
      const result = parseResultJSON('null');

      expect(result).toEqual({ PASS: [], FAILED: [] });
    });

    it('should include displayName and diff in new format', () => {
      const jsonStr = '[{"fileName":"test.png","passed":true,"displayName":"Screen 01","discrepancies":["diff1"]}]';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS[0].displayName).toBe('Screen 01');
      expect(result.PASS[0].diff).toBeDefined();
    });

    it('should handle passed=true items', () => {
      const jsonStr = '[{"fileName":"pass.png","passed":true}]';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(1);
      expect(result.FAILED).toHaveLength(0);
    });

    it('should handle passed=false items with discrepancies', () => {
      const jsonStr = '[{"fileName":"fail.png","passed":false,"discrepancies":["error1","error2"]}]';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(0);
      expect(result.FAILED).toHaveLength(1);
      expect(result.FAILED[0].diff).toContain('error1');
    });

    it('should handle mixed passed and failed items', () => {
      const jsonStr = '[{"fileName":"pass.png","passed":true},{"fileName":"fail.png","passed":false}]';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(1);
      expect(result.FAILED).toHaveLength(1);
    });

    it('should handle items without passed field', () => {
      const jsonStr = '[{"fileName":"unknown.png"}]';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(0);
      expect(result.FAILED).toHaveLength(0);
    });

    it('should handle old format with only PASS', () => {
      const jsonStr = '{"PASS":[{"filename":"test.png"}]}';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(1);
      expect(result.FAILED).toHaveLength(0);
    });

    it('should handle old format with only FAILED', () => {
      const jsonStr = '{"FAILED":[{"filename":"test.png"}]}';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(0);
      expect(result.FAILED).toHaveLength(1);
    });

    it('should handle items with fileName as empty string', () => {
      const jsonStr = '[{"fileName":"","passed":true}]';
      const result = parseResultJSON(jsonStr);

      expect(result.PASS).toHaveLength(1);
      expect(result.PASS[0].filename).toBe('');
    });
  });

  describe('getRowIndexByCustomId', () => {
    const mockTableData: CellInfo[][] = [
      [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Test copy 2', rowspan: 1, colspan: 1, isSpanned: false }
      ]
    ];

    it('should find row index by customId', () => {
      const result = getRowIndexByCustomId(mockTableData, 'ROW_001');
      expect(result).toBe(1);
    });

    it('should return -1 for non-existent customId', () => {
      const result = getRowIndexByCustomId(mockTableData, 'NON_EXISTENT');
      expect(result).toBe(-1);
    });

    it('should return -1 for empty table data', () => {
      const result = getRowIndexByCustomId([], 'ROW_001');
      expect(result).toBe(-1);
    });

    it('should return -1 for empty customId', () => {
      const result = getRowIndexByCustomId(mockTableData, '');
      expect(result).toBe(-1);
    });

    it('should return -1 when customId column is missing', () => {
      const tableWithoutCustomId: CellInfo[][] = [
        [
          { value: 'Other Column', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'Data', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      const result = getRowIndexByCustomId(tableWithoutCustomId, 'ROW_001');
      expect(result).toBe(-1);
    });

    it('should handle table data with null/undefined', () => {
      const result = getRowIndexByCustomId(null as any, 'ROW_001');
      expect(result).toBe(-1);
    });
  });

  describe('findRowsByCustomGroup', () => {
    const mockTableData: CellInfo[][] = [
      [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'ROW_003', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Group2', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Copy 3', rowspan: 1, colspan: 1, isSpanned: false }
      ]
    ];

    it('should find all rows with same customGroup', () => {
      const result = findRowsByCustomGroup(mockTableData, 'en', 'Group1');
      expect(result).toEqual([1, 2]);
    });

    it('should return empty array for non-existent group', () => {
      const result = findRowsByCustomGroup(mockTableData, 'en', 'NonExistent');
      expect(result).toEqual([]);
    });

    it('should handle empty table data', () => {
      const result = findRowsByCustomGroup([], 'en', 'Group1');
      expect(result).toEqual([]);
    });

    it('should handle rows with whitespace in customGroup', () => {
      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '  Group1  ', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      const result = findRowsByCustomGroup(mockTableData, 'en', 'Group1');
      expect(result).toEqual([1, 2]);
    });

    it('should handle missing customGroup column', () => {
      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      const result = findRowsByCustomGroup(mockTableData, 'en', 'Group1');
      expect(result).toEqual([]);
    });

    it('should handle null table data', () => {
      const result = findRowsByCustomGroup(null as any, 'en', 'Group1');
      expect(result).toEqual([]);
    });
  });

  describe('updateCellData', () => {
    const mockTableData: CellInfo[][] = [
      [
        { value: 'Header1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Header2', rowspan: 1, colspan: 1, isSpanned: false }
      ],
      [
        { value: 'Data1', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'Data2', rowspan: 1, colspan: 1, isSpanned: false }
      ]
    ];

    it('should update cell value and return new array', () => {
      const result = updateCellData(mockTableData, 1, 1, 'NewValue');

      expect(result[1][1].value).toBe('NewValue');
      expect(result).not.toBe(mockTableData);
      expect(mockTableData[1][1].value).toBe('Data2');
    });

    it('should preserve other cell properties', () => {
      const result = updateCellData(mockTableData, 1, 1, 'NewValue');

      expect(result[1][1].rowspan).toBe(1);
      expect(result[1][1].colspan).toBe(1);
      expect(result[1][1].isSpanned).toBe(false);
    });

    it('should not modify original data', () => {
      const original: CellInfo[][] = [
        [
          { value: 'A', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'B', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      const originalCopy = JSON.parse(JSON.stringify(original));
      updateCellData(original, 0, 0, 'C');

      expect(original).toEqual(originalCopy);
    });

    it('should preserve cell properties when updating value', () => {
      const original: CellInfo[][] = [
        [
          { value: 'A', rowspan: 2, colspan: 3, isSpanned: true }
        ]
      ];

      const result = updateCellData(original, 0, 0, 'B');

      expect(result[0][0].value).toBe('B');
      expect(result[0][0].rowspan).toBe(2);
      expect(result[0][0].colspan).toBe(3);
      expect(result[0][0].isSpanned).toBe(true);
    });
  });

  describe('updateResultJSON', () => {
    const mockResultJSON: CheckResultJSON = {
      PASS: [{ filename: 'pass1.png', displayName: 'Screen 01' }],
      FAILED: [{ filename: 'fail1.png', displayName: 'Screen 02' }]
    };

    it('should add PASS item', () => {
      const imageData: OperationImageData = {
        filename: 'pass2.png',
        type: 'PASS'
      };

      const result = updateResultJSON(mockResultJSON, 'add', imageData);

      expect(result.PASS).toHaveLength(2);
      expect(result.PASS[1].filename).toBe('pass2.png');
      expect(result.FAILED).toHaveLength(1);
    });

    it('should add FAILED item with diff', () => {
      const imageData: OperationImageData = {
        filename: 'fail2.png',
        type: 'FAILED',
        diff: 'difference details'
      };

      const result = updateResultJSON(mockResultJSON, 'add', imageData);

      expect(result.FAILED).toHaveLength(2);
      expect(result.FAILED[1].filename).toBe('fail2.png');
      expect(result.FAILED[1].diff).toBe('difference details');
    });

    it('should remove item from PASS by matching filename and displayName', () => {
      const imageData: OperationImageData = {
        filename: 'pass1.png',
        displayName: 'Screen 01'
      };

      const result = updateResultJSON(mockResultJSON, 'remove', imageData);

      expect(result.PASS).toHaveLength(0);
      expect(result.FAILED).toHaveLength(1);
    });

    it('should remove item from FAILED by matching filename and displayName', () => {
      const imageData: OperationImageData = {
        filename: 'fail1.png',
        displayName: 'Screen 02'
      };

      const result = updateResultJSON(mockResultJSON, 'remove', imageData);

      expect(result.PASS).toHaveLength(1);
      expect(result.FAILED).toHaveLength(0);
    });

    it('should not mutate original data', () => {
      const imageData: OperationImageData = {
        filename: 'pass2.png',
        type: 'PASS'
      };

      updateResultJSON(mockResultJSON, 'add', imageData);

      expect(mockResultJSON.PASS).toHaveLength(1);
    });

    it('should handle removing from both PASS and FAILED if matching', () => {
      const mockResult: CheckResultJSON = {
        PASS: [
          { filename: 'test.png', displayName: 'Screen 01' },
          { filename: 'other.png', displayName: 'Screen 02' }
        ],
        FAILED: [
          { filename: 'test.png', displayName: 'Screen 01' }
        ]
      };

      const imageData: OperationImageData = {
        filename: 'test.png',
        displayName: 'Screen 01'
      };

      const result = updateResultJSON(mockResult, 'remove', imageData);

      expect(result.PASS).toHaveLength(1);
      expect(result.PASS[0].filename).toBe('other.png');
      expect(result.FAILED).toHaveLength(0);
    });

    it('should remove item when filename matches even if displayName differs', () => {
      const mockResult: CheckResultJSON = {
        PASS: [
          { filename: 'test1.png', displayName: 'Screen 01' },
          { filename: 'test2.png', displayName: 'Screen 02' }
        ],
        FAILED: []
      };

      const imageData: OperationImageData = {
        filename: 'test1.png',
        displayName: 'Different Name'
      };

      const result = updateResultJSON(mockResult, 'remove', imageData);

      expect(result.PASS).toHaveLength(1);
      expect(result.PASS[0].filename).toBe('test2.png');
    });

    it('should add item with optional diff field', () => {
      const mockResult: CheckResultJSON = {
        PASS: [],
        FAILED: []
      };

      const imageData: OperationImageData = {
        filename: 'test.png',
        displayName: 'Screen 01',
        type: 'PASS',
        diff: 'some diff'
      };

      const result = updateResultJSON(mockResult, 'add', imageData);

      expect(result.PASS).toHaveLength(1);
      expect(result.PASS[0].diff).toBe('some diff');
    });

    it('should add item without diff field when not provided', () => {
      const mockResult: CheckResultJSON = {
        PASS: [],
        FAILED: []
      };

      const imageData: OperationImageData = {
        filename: 'test.png',
        displayName: 'Screen 01',
        type: 'PASS'
      };

      const result = updateResultJSON(mockResult, 'add', imageData);

      expect(result.PASS).toHaveLength(1);
      expect(result.PASS[0].diff).toBeUndefined();
    });

    it('should default to PASS when type is not FAILED', () => {
      const mockResult: CheckResultJSON = {
        PASS: [],
        FAILED: []
      };

      const imageData: OperationImageData = {
        filename: 'test.png',
        displayName: 'Screen 01'
      };

      const result = updateResultJSON(mockResult, 'add', imageData);

      expect(result.PASS).toHaveLength(1);
      expect(result.FAILED).toHaveLength(0);
    });
  });

  describe('Atoms Initialization', () => {
    it('should initialize copyDeckSidebarVisibleAtom with false', () => {
      expect(copyDeckSidebarVisibleAtom.init).toBe(false);
    });

    it('should initialize copyDeckFullscreenAtom with false', () => {
      expect(copyDeckFullscreenAtom.init).toBe(false);
    });

    it('should initialize copyDeckCurrentViewAtom with input', () => {
      expect(copyDeckCurrentViewAtom.init).toBe('input');
    });

    it('should initialize copyDeckMessageAtom with null', () => {
      expect(copyDeckMessageAtom.init).toBe(null);
    });

    it('should initialize copyDeckConfluenceInfoAtom with default values', () => {
      const defaultValue = copyDeckConfluenceInfoAtom.init;
      expect(defaultValue.confluenceUrl).toBe('');
      expect(defaultValue.tableName).toBe('');
      expect(defaultValue.confluenceTitle).toBe('');
      expect(defaultValue.tableIndex).toBe(-1);
    });

    it('should initialize copyDeckStorageHtmlAtom with empty string', () => {
      expect(copyDeckStorageHtmlAtom.init).toBe('');
    });

    it('should initialize copyDeckCurrentTableHtmlAtom with empty string', () => {
      expect(copyDeckCurrentTableHtmlAtom.init).toBe('');
    });

    it('should initialize copyDeckRenderTableDataAtom with empty array', () => {
      expect(copyDeckRenderTableDataAtom.init).toEqual([]);
    });

    it('should initialize copyDeckOriginalTableDataAtom with empty array', () => {
      expect(copyDeckOriginalTableDataAtom.init).toEqual([]);
    });

    it('should initialize copyDeckTableImageAtom with empty array', () => {
      expect(copyDeckTableImageAtom.init).toEqual([]);
    });

    it('should initialize copyDeckValuesArrayAtom with empty array', () => {
      expect(copyDeckValuesArrayAtom.init).toEqual([]);
    });

    it('should initialize copyDeckSelectedLanguageAtom with empty string', () => {
      expect(copyDeckSelectedLanguageAtom.init).toBe('');
    });

    it('should initialize copyDeckShowUncomparedAtom with false', () => {
      expect(copyDeckShowUncomparedAtom.init).toBe(false);
    });

    it('should initialize copyDeckSelectedRowsAtom with empty array', () => {
      expect(copyDeckSelectedRowsAtom.init).toEqual([]);
    });
  });

  describe('Derived Atoms - copyDeckLanguageTableDataAtom', () => {
    it('should return empty array when no language is selected', () => {
      const store = createStore();
      const result = store.get(copyDeckLanguageTableDataAtom);
      expect(result).toEqual([]);
    });

    it('should return empty array when renderTableData is empty', () => {
      const store = createStore();
      store.set(copyDeckSelectedLanguageAtom, 'en');
      const result = store.get(copyDeckLanguageTableDataAtom);
      expect(result).toEqual([]);
    });

    it('should extract rows for selected language', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'TestResult|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'TestEvidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[]', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[]', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');

      const result = store.get(copyDeckLanguageTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0].customId).toBe('ROW_001');
      expect(result[0].customGroup).toBe('Group1');
      expect(result[0].copy).toBe('Test copy');
    });

    it('should filter out rows without copy content', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '   ', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');

      const result = store.get(copyDeckLanguageTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0].customId).toBe('ROW_001');
    });

    it('should return empty array when customId column is missing', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'Other Column', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'Data', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');

      const result = store.get(copyDeckLanguageTableDataAtom);
      expect(result).toEqual([]);
    });

    it('should preserve evidenceCell information', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'TestEvidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[]', rowspan: 2, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');

      const result = store.get(copyDeckLanguageTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0].evidenceCell).toBeDefined();
      expect(result[0].evidenceCell?.rowspan).toBe(2);
    });
  });

  describe('Derived Atoms - copyDeckGroupTableDataAtom', () => {
    it('should return empty array when languageTableData is empty', () => {
      const store = createStore();
      const result = store.get(copyDeckGroupTableDataAtom);
      expect(result).toEqual([]);
    });

    it('should group rows by customGroup', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_003', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 3', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(2);
      expect(result[1]).toHaveLength(1);
      expect(result[0][0].customGroup).toBe('Group1');
      expect(result[1][0].customGroup).toBe('Group2');
    });

    it('should filter uncompared groups when showUncompared is true', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'TestEvidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[]', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"test.png"}]', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');
      store.set(copyDeckShowUncomparedAtom, true);

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0][0].customGroup).toBe('Group1');
    });

    it('should maintain group order', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'GroupZ', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'GroupA', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(2);
      expect(result[0][0].customGroup).toBe('GroupZ');
      expect(result[1][0].customGroup).toBe('GroupA');
    });

    it('should handle single table mode filtering (empty customGroup)', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'TestEvidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[]', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[{"fileName":"test.png"}]', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');
      store.set(copyDeckShowUncomparedAtom, true);

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].customId).toBe('ROW_001');
    });

    it('should handle spanned rows without finding first non-spanned row', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'TestEvidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');
      store.set(copyDeckShowUncomparedAtom, true);

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
    });

    it('should handle group with empty evidence cell without evidenceCell property', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Group1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');
      store.set(copyDeckShowUncomparedAtom, true);

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(1);
    });
  });

  describe('Side Effect Atoms - showCopyDeckSidebarAtom', () => {
    it('should show sidebar when not visible', () => {
      const store = createStore();

      store.set(showCopyDeckSidebarAtom);

      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(true);
      expect(store.get(copyDeckFullscreenAtom)).toBe(false);
      expect(store.get(copyDeckCurrentViewAtom)).toBe('input');
    });

    it('should do nothing when sidebar is already visible', () => {
      const store = createStore();

      store.set(copyDeckSidebarVisibleAtom, true);
      store.set(copyDeckCurrentViewAtom, 'table');

      store.set(showCopyDeckSidebarAtom);

      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(true);
      expect(store.get(copyDeckCurrentViewAtom)).toBe('table');
    });

    it('should exit fullscreen when showing sidebar', () => {
      const store = createStore();

      store.set(copyDeckFullscreenAtom, true);

      store.set(showCopyDeckSidebarAtom);

      expect(store.get(copyDeckFullscreenAtom)).toBe(false);
      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(true);
    });
  });

  describe('Side Effect Atoms - hideCopyDeckSidebarAtom', () => {
    it('should hide sidebar and reset all states', () => {
      const store = createStore();

      store.set(copyDeckSidebarVisibleAtom, true);
      store.set(copyDeckFullscreenAtom, true);
      store.set(copyDeckCurrentViewAtom, 'table');
      store.set(copyDeckStorageHtmlAtom, '<html>test</html>');
      store.set(copyDeckSelectedLanguageAtom, 'en');

      store.set(hideCopyDeckSidebarAtom);

      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(false);
      expect(store.get(copyDeckFullscreenAtom)).toBe(false);
      expect(store.get(copyDeckCurrentViewAtom)).toBe('input');
      expect(store.get(copyDeckStorageHtmlAtom)).toBe('');
      expect(store.get(copyDeckSelectedLanguageAtom)).toBe('');
    });

    it('should reset all data atoms', () => {
      const store = createStore();

      store.set(copyDeckRenderTableDataAtom, [[{ value: 'test', rowspan: 1, colspan: 1, isSpanned: false }]]);
      store.set(copyDeckOriginalTableDataAtom, [[{ value: 'test', rowspan: 1, colspan: 1, isSpanned: false }]]);
      store.set(copyDeckTableImageAtom, [{ fileName: 'test.png', base64: 'abc' }]);
      store.set(copyDeckValuesArrayAtom, ['en', 'fr']);
      store.set(copyDeckSelectedRowsAtom, [{ customId: 'ROW_001', language: 'en', groupName: 'Group1' }]);

      store.set(hideCopyDeckSidebarAtom);

      expect(store.get(copyDeckRenderTableDataAtom)).toEqual([]);
      expect(store.get(copyDeckOriginalTableDataAtom)).toEqual([]);
      expect(store.get(copyDeckTableImageAtom)).toEqual([]);
      expect(store.get(copyDeckValuesArrayAtom)).toEqual([]);
      expect(store.get(copyDeckSelectedRowsAtom)).toEqual([]);
    });

    it('should work when sidebar is already hidden', () => {
      const store = createStore();

      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(false);

      store.set(hideCopyDeckSidebarAtom);

      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(false);
    });
  });

  describe('Side Effect Atoms - toggleCopyDeckFullscreenAtom', () => {
    it('should toggle fullscreen from false to true', () => {
      const store = createStore();

      expect(store.get(copyDeckFullscreenAtom)).toBe(false);

      store.set(toggleCopyDeckFullscreenAtom);

      expect(store.get(copyDeckFullscreenAtom)).toBe(true);
      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(true);
    });

    it('should toggle fullscreen from true to false', () => {
      const store = createStore();

      store.set(copyDeckFullscreenAtom, true);

      store.set(toggleCopyDeckFullscreenAtom);

      expect(store.get(copyDeckFullscreenAtom)).toBe(false);
    });

    it('should ensure sidebar is visible when entering fullscreen', () => {
      const store = createStore();

      store.set(copyDeckSidebarVisibleAtom, false);
      store.set(copyDeckFullscreenAtom, false);

      store.set(toggleCopyDeckFullscreenAtom);

      expect(store.get(copyDeckFullscreenAtom)).toBe(true);
      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(true);
    });

    it('should toggle multiple times correctly', () => {
      const store = createStore();

      store.set(toggleCopyDeckFullscreenAtom);
      expect(store.get(copyDeckFullscreenAtom)).toBe(true);

      store.set(toggleCopyDeckFullscreenAtom);
      expect(store.get(copyDeckFullscreenAtom)).toBe(false);

      store.set(toggleCopyDeckFullscreenAtom);
      expect(store.get(copyDeckFullscreenAtom)).toBe(true);
    });
  });

  describe('Complex Interaction Scenarios', () => {
    it('should handle show -> toggle fullscreen -> hide flow', () => {
      const store = createStore();

      store.set(showCopyDeckSidebarAtom);
      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(true);
      expect(store.get(copyDeckFullscreenAtom)).toBe(false);

      store.set(toggleCopyDeckFullscreenAtom);
      expect(store.get(copyDeckFullscreenAtom)).toBe(true);

      store.set(hideCopyDeckSidebarAtom);
      expect(store.get(copyDeckSidebarVisibleAtom)).toBe(false);
      expect(store.get(copyDeckFullscreenAtom)).toBe(false);
    });

    it('should maintain derived atom reactivity', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Test copy', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      expect(store.get(copyDeckLanguageTableDataAtom)).toEqual([]);

      store.set(copyDeckSelectedLanguageAtom, 'en');
      expect(store.get(copyDeckLanguageTableDataAtom)).toHaveLength(1);

      store.set(hideCopyDeckSidebarAtom);
      expect(store.get(copyDeckLanguageTableDataAtom)).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty customGroup values', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '   ', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
    });

    it('should handle table with merged cells (isSpanned)', () => {
      const store = createStore();

      const mockTableData: CellInfo[][] = [
        [
          { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'COPYDECK_CUSTOM_GROUP', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy|values=en|', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'TestEvidence|values=en|', rowspan: 1, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_001', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 1', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '[]', rowspan: 2, colspan: 1, isSpanned: false }
        ],
        [
          { value: 'ROW_002', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: false },
          { value: 'Copy 2', rowspan: 1, colspan: 1, isSpanned: false },
          { value: '', rowspan: 1, colspan: 1, isSpanned: true }
        ]
      ];

      store.set(copyDeckRenderTableDataAtom, mockTableData);
      store.set(copyDeckSelectedLanguageAtom, 'en');
      store.set(copyDeckShowUncomparedAtom, true);

      const result = store.get(copyDeckGroupTableDataAtom);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(2);
    });

    it('should handle case-insensitive column matching', () => {
      const headerRow: CellInfo[] = [
        { value: 'COPYDECK_CUSTOM_ID', rowspan: 1, colspan: 1, isSpanned: false },
        { value: 'TESTRESULT|values=EN|', rowspan: 1, colspan: 1, isSpanned: false }
      ];

      const result = getColumnIndexes(headerRow, 'en');

      expect(result.result).toBe(1);
    });
  });
});
