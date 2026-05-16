import { Fragment, type ReactNode } from 'react';
import {
  CopyOutlined,
  ExportOutlined
} from '@ant-design/icons';
import { Catalog, CommonSchemas } from '@a2ui/web_core/v0_9';
import {
  createComponentImplementation,
  type ReactComponentImplementation
} from '@a2ui/react/v0_9';
import { z } from 'zod';

export const TEST_CASE_CATALOG_ID = 'https://local.a2ui.dev/catalogs/test-case/v1.json';

type ResolvedChildNode = {
  id: string;
  basePath?: string;
};

type BuildChild = (id: string, basePath?: string) => ReactNode;

const displayText = (value: unknown) =>
  typeof value === 'string' ? value : String(value ?? '');

const renderChildren = (children: unknown, buildChild: BuildChild) => {
  if (!Array.isArray(children)) {
    return null;
  }

  return children.map((child, index) => {
    if (typeof child === 'string') {
      return <Fragment key={`${child}-${index}`}>{buildChild(child)}</Fragment>;
    }

    if (child && typeof child === 'object' && 'id' in child) {
      const node = child as ResolvedChildNode;
      return (
        <Fragment key={`${node.id}-${node.basePath ?? index}`}>
          {buildChild(node.id, node.basePath)}
        </Fragment>
      );
    }

    return null;
  });
};

const renderMultiline = (value: unknown) =>
  displayText(value)
    .split(/<br\s*\/?>|\n/i)
    .filter(Boolean)
    .map((line, index) => (
      <div key={`${line}-${index}`} className="leading-5">
        {line}
      </div>
    ));

const TestCasePanelApi = {
  name: 'TestCasePanel',
  schema: z.object({
    children: CommonSchemas.ChildList
  }).strict()
};

const TestCaseHeaderApi = {
  name: 'TestCaseHeader',
  schema: z.object({
    title: CommonSchemas.DynamicString,
    sourcePreview: CommonSchemas.DynamicString
  }).strict()
};

const TestCaseStatsApi = {
  name: 'TestCaseStats',
  schema: z.object({
    children: CommonSchemas.ChildList
  }).strict()
};

const TestCaseStatApi = {
  name: 'TestCaseStat',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    value: CommonSchemas.DynamicString
  }).strict()
};

const TestCaseTableApi = {
  name: 'TestCaseTable',
  schema: z.object({
    children: CommonSchemas.ChildList
  }).strict()
};

const TestCaseRowApi = {
  name: 'TestCaseRow',
  schema: z.object({
    testCaseId: CommonSchemas.DynamicString,
    description: CommonSchemas.DynamicString,
    preconditions: CommonSchemas.DynamicString,
    steps: CommonSchemas.DynamicString,
    expectedResults: CommonSchemas.DynamicString
  }).strict()
};

const TestCaseActionsApi = {
  name: 'TestCaseActions',
  schema: z.object({
    exportLabel: CommonSchemas.DynamicString,
    copyLabel: CommonSchemas.DynamicString,
    exportAction: CommonSchemas.Action,
    copyAction: CommonSchemas.Action
  }).strict()
};

export const TestCasePanel = createComponentImplementation(
  TestCasePanelApi,
  ({ props, buildChild }) => (
    <section
      aria-label="Generated test cases"
      className="w-full max-w-[1040px] overflow-hidden rounded-md border border-slate-200 bg-white font-sans text-slate-900"
    >
      {renderChildren(props.children, buildChild)}
    </section>
  )
);

export const TestCaseHeader = createComponentImplementation(
  TestCaseHeaderApi,
  ({ props }) => (
    <header className="border-b border-slate-200 px-4 py-3">
      <h2 className="m-0 text-base font-semibold leading-6 text-slate-950">
        {displayText(props.title)}
      </h2>
      <p className="m-0 mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
        {displayText(props.sourcePreview)}
      </p>
    </header>
  )
);

export const TestCaseStats = createComponentImplementation(
  TestCaseStatsApi,
  ({ props, buildChild }) => (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-2">
      {renderChildren(props.children, buildChild)}
    </div>
  )
);

export const TestCaseStat = createComponentImplementation(
  TestCaseStatApi,
  ({ props }) => (
    <div className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs">
      <span className="font-medium text-slate-500">
        {displayText(props.label)}
      </span>
      <span className="font-semibold text-slate-800">
        {displayText(props.value)}
      </span>
    </div>
  )
);

export const TestCaseTable = createComponentImplementation(
  TestCaseTableApi,
  ({ props, buildChild }) => (
    <div className="overflow-x-auto">
      <table className="min-w-[920px] table-fixed border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
            <th className="w-[110px] px-3 py-2">ID</th>
            <th className="w-[230px] px-3 py-2">Description</th>
            <th className="w-[190px] px-3 py-2">Preconditions</th>
            <th className="w-[190px] px-3 py-2">Steps</th>
            <th className="w-[200px] px-3 py-2">Expected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {renderChildren(props.children, buildChild)}
        </tbody>
      </table>
    </div>
  )
);

export const TestCaseRow = createComponentImplementation(
  TestCaseRowApi,
  ({ props }) => (
    <tr className="align-top hover:bg-slate-50">
      <td className="px-3 py-3 font-semibold text-emerald-700">
        {displayText(props.testCaseId)}
      </td>
      <td className="px-3 py-3 font-medium leading-5 text-slate-900">
        {displayText(props.description)}
      </td>
      <td className="px-3 py-3 leading-5 text-slate-600">
        {renderMultiline(props.preconditions)}
      </td>
      <td className="px-3 py-3 leading-5 text-slate-600">
        {renderMultiline(props.steps)}
      </td>
      <td className="px-3 py-3 leading-5 text-slate-600">
        {renderMultiline(props.expectedResults)}
      </td>
    </tr>
  )
);

export const TestCaseActions = createComponentImplementation(
  TestCaseActionsApi,
  ({ props }) => (
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
      <button
        type="button"
        onClick={props.copyAction}
        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <CopyOutlined aria-hidden="true" />
        <span>{displayText(props.copyLabel)}</span>
      </button>
      <button
        type="button"
        onClick={props.exportAction}
        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
      >
        <ExportOutlined aria-hidden="true" />
        <span>{displayText(props.exportLabel)}</span>
      </button>
    </div>
  )
);

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
