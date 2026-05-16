import { Catalog } from '@a2ui/web_core/v0_9';
import type { ReactComponentImplementation } from '@a2ui/react/v0_9';
import {
  createDataRowComponent,
  createDataTableComponent,
  createDualActionBarComponent,
  createHeaderComponent,
  createPanelComponent,
  createStatChipComponent,
  createStatGroupComponent,
  type DataTableColumn
} from './genericCatalog';

export const TEST_CASE_CATALOG_ID = 'https://local.a2ui.dev/catalogs/test-case/v1.json';

const testCaseColumns: DataTableColumn[] = [
  {
    key: 'testCaseId',
    label: 'ID',
    widthClassName: 'w-[110px]',
    cellClassName: 'font-semibold text-emerald-700'
  },
  {
    key: 'description',
    label: 'Description',
    widthClassName: 'w-[230px]',
    cellClassName: 'font-medium text-slate-900'
  },
  {
    key: 'preconditions',
    label: 'Preconditions',
    widthClassName: 'w-[190px]'
  },
  {
    key: 'steps',
    label: 'Steps',
    widthClassName: 'w-[190px]'
  },
  {
    key: 'expectedResults',
    label: 'Expected',
    widthClassName: 'w-[200px]'
  }
];

export const TestCasePanel = createPanelComponent({
  name: 'TestCasePanel',
  ariaLabel: 'Generated test cases'
});

export const TestCaseHeader = createHeaderComponent({
  name: 'TestCaseHeader',
  titleProp: 'title',
  descriptionProp: 'sourcePreview'
});

export const TestCaseStats = createStatGroupComponent('TestCaseStats');

export const TestCaseStat = createStatChipComponent({
  name: 'TestCaseStat'
});

export const TestCaseTable = createDataTableComponent({
  name: 'TestCaseTable',
  columns: testCaseColumns,
  minWidthClassName: 'min-w-[920px]'
});

export const TestCaseRow = createDataRowComponent({
  name: 'TestCaseRow',
  columns: testCaseColumns
});

export const TestCaseActions = createDualActionBarComponent({
  name: 'TestCaseActions',
  actions: [
    {
      labelProp: 'copyLabel',
      actionProp: 'copyAction',
      icon: 'copy',
      variant: 'secondary'
    },
    {
      labelProp: 'exportLabel',
      actionProp: 'exportAction',
      icon: 'export',
      variant: 'primary'
    }
  ]
});

export const testCaseCatalog = new Catalog<ReactComponentImplementation>(
  TEST_CASE_CATALOG_ID,
  [
    TestCasePanel,
    TestCaseHeader,
    TestCaseStats,
    TestCaseStat,
    TestCaseTable,
    TestCaseRow,
    TestCaseActions
  ],
  []
);
