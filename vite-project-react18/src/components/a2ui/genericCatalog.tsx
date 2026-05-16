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

export const GENERIC_CATALOG_ID = 'https://local.a2ui.dev/catalogs/common/v1.json';

type ResolvedChildNode = {
  id: string;
  basePath?: string;
};

type BuildChild = (id: string, basePath?: string) => ReactNode;

export type DataTableColumn = {
  key: string;
  label: string;
  widthClassName?: string;
  cellClassName?: string;
};

type PanelOptions = {
  name: string;
  ariaLabel?: string;
  className?: string;
};

type HeaderOptions = {
  name: string;
  titleProp?: string;
  descriptionProp?: string;
};

type StatChipOptions = {
  name: string;
  labelProp?: string;
  valueProp?: string;
};

type DataTableOptions = {
  name: string;
  columns: DataTableColumn[];
  minWidthClassName?: string;
};

type DataRowOptions = {
  name: string;
  columns: DataTableColumn[];
};

type ActionButtonConfig = {
  labelProp: string;
  actionProp: string;
  icon?: 'copy' | 'export';
  variant?: 'primary' | 'secondary';
};

type DualActionBarOptions = {
  name: string;
  actions: ActionButtonConfig[];
};

const childListSchema = z.object({
  children: CommonSchemas.ChildList
}).strict();

const flexibleColumnSchema = z.object({
  label: CommonSchemas.DynamicString,
  widthClassName: z.string().optional()
}).strict();

const fallbackColumns: Array<z.infer<typeof flexibleColumnSchema>> = [
  { label: 'Primary', widthClassName: 'w-[180px]' },
  { label: 'Secondary', widthClassName: 'w-[260px]' },
  { label: 'Status', widthClassName: 'w-[160px]' }
];

export const displayText = (value: unknown) =>
  typeof value === 'string' ? value : String(value ?? '');

export const renderChildren = (children: unknown, buildChild: BuildChild) => {
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

export const renderMultiline = (value: unknown) =>
  displayText(value)
    .split(/<br\s*\/?>|\n/i)
    .filter(Boolean)
    .map((line, index) => (
      <div key={`${line}-${index}`} className="leading-5">
        {line}
      </div>
    ));

export const createPanelComponent = ({
  name,
  ariaLabel = 'A2UI panel',
  className = 'w-full max-w-[1040px] overflow-hidden rounded-md border border-slate-200 bg-white font-sans text-slate-900'
}: PanelOptions) =>
  createComponentImplementation(
    {
      name,
      schema: childListSchema
    },
    ({ props, buildChild }) => (
      <section aria-label={ariaLabel} className={className}>
        {renderChildren(props.children, buildChild)}
      </section>
    )
  );

export const createHeaderComponent = ({
  name,
  titleProp = 'title',
  descriptionProp = 'description'
}: HeaderOptions) =>
  createComponentImplementation(
    {
      name,
      schema: z.object({
        [titleProp]: CommonSchemas.DynamicString,
        [descriptionProp]: CommonSchemas.DynamicString.optional()
      }).strict()
    },
    ({ props }) => (
      <header className="border-b border-slate-200 px-4 py-3">
        <h2 className="m-0 text-base font-semibold leading-6 text-slate-950">
          {displayText(props[titleProp])}
        </h2>
        {props[descriptionProp] && (
          <p className="m-0 mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {displayText(props[descriptionProp])}
          </p>
        )}
      </header>
    )
  );

export const createStatGroupComponent = (name: string) =>
  createComponentImplementation(
    {
      name,
      schema: childListSchema
    },
    ({ props, buildChild }) => (
      <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-2">
        {renderChildren(props.children, buildChild)}
      </div>
    )
  );

export const createStatChipComponent = ({
  name,
  labelProp = 'label',
  valueProp = 'value'
}: StatChipOptions) =>
  createComponentImplementation(
    {
      name,
      schema: z.object({
        [labelProp]: CommonSchemas.DynamicString,
        [valueProp]: CommonSchemas.DynamicString
      }).strict()
    },
    ({ props }) => (
      <div className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-xs">
        <span className="font-medium text-slate-500">
          {displayText(props[labelProp])}
        </span>
        <span className="font-semibold text-slate-800">
          {displayText(props[valueProp])}
        </span>
      </div>
    )
  );

export const createDataTableComponent = ({
  name,
  columns,
  minWidthClassName = 'min-w-[920px]'
}: DataTableOptions) =>
  createComponentImplementation(
    {
      name,
      schema: childListSchema
    },
    ({ props, buildChild }) => (
      <div className="overflow-x-auto">
        <table className={`${minWidthClassName} table-fixed border-collapse text-left text-xs`}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${column.widthClassName ?? ''} px-3 py-2`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderChildren(props.children, buildChild)}
          </tbody>
        </table>
      </div>
    )
  );

export const createDataRowComponent = ({ name, columns }: DataRowOptions) =>
  createComponentImplementation(
    {
      name,
      schema: z.object(
        Object.fromEntries(
          columns.map((column) => [column.key, CommonSchemas.DynamicString])
        )
      ).strict()
    },
    ({ props }) => (
      <tr className="align-top hover:bg-slate-50">
        {columns.map((column) => (
          <td
            key={column.key}
            className={`px-3 py-3 leading-5 text-slate-600 ${column.cellClassName ?? ''}`}
          >
            {renderMultiline(props[column.key])}
          </td>
        ))}
      </tr>
    )
  );

const buttonClassName = (variant: ActionButtonConfig['variant']) =>
  variant === 'primary'
    ? 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded bg-emerald-600 px-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
    : 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600';

const ActionIcon = ({ icon }: { icon?: ActionButtonConfig['icon'] }) => {
  if (icon === 'copy') {
    return <CopyOutlined aria-hidden="true" />;
  }

  if (icon === 'export') {
    return <ExportOutlined aria-hidden="true" />;
  }

  return null;
};

export const createDualActionBarComponent = ({ name, actions }: DualActionBarOptions) =>
  createComponentImplementation(
    {
      name,
      schema: z.object(
        Object.fromEntries(
          actions.flatMap((action) => [
            [action.labelProp, CommonSchemas.DynamicString],
            [action.actionProp, CommonSchemas.Action]
          ])
        )
      ).strict()
    },
    ({ props }) => (
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">
        {actions.map((action) => (
          <button
            key={action.actionProp}
            type="button"
            onClick={props[action.actionProp]}
            className={buttonClassName(action.variant)}
          >
            <ActionIcon icon={action.icon} />
            <span>{displayText(props[action.labelProp])}</span>
          </button>
        ))}
      </div>
    )
  );

export const A2Panel = createPanelComponent({
  name: 'A2Panel'
});

export const A2Header = createHeaderComponent({
  name: 'A2Header'
});

export const A2StatGroup = createStatGroupComponent('A2StatGroup');

export const A2StatChip = createStatChipComponent({
  name: 'A2StatChip'
});

export const A2DataTable = createComponentImplementation(
  {
    name: 'A2DataTable',
    schema: z.object({
      children: CommonSchemas.ChildList,
      columns: z.array(flexibleColumnSchema).optional(),
      minWidthClassName: CommonSchemas.DynamicString.optional()
    }).strict()
  },
  ({ props, buildChild }) => {
    const columns = props.columns?.length ? props.columns : fallbackColumns;
    const minWidthClassName = displayText(props.minWidthClassName || 'min-w-[600px]');

    return (
      <div className="overflow-x-auto">
        <table className={`${minWidthClassName} table-fixed border-collapse text-left text-xs`}>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              {columns.map((column, index) => (
                <th
                  key={`${displayText(column.label)}-${index}`}
                  className={`${column.widthClassName ?? ''} px-3 py-2`}
                >
                  {displayText(column.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderChildren(props.children, buildChild)}
          </tbody>
        </table>
      </div>
    );
  }
);

export const A2DataRow = createComponentImplementation(
  {
    name: 'A2DataRow',
    schema: z.object({
      cells: z.array(CommonSchemas.DynamicString)
    }).strict()
  },
  ({ props }) => (
    <tr className="align-top hover:bg-slate-50">
      {props.cells.map((cell, index) => (
        <td
          key={`${displayText(cell)}-${index}`}
          className="px-3 py-3 leading-5 text-slate-600 first:font-semibold first:text-slate-900"
        >
          {renderMultiline(cell)}
        </td>
      ))}
    </tr>
  )
);

export const A2ActionBar = createDualActionBarComponent({
  name: 'A2ActionBar',
  actions: [
    {
      labelProp: 'secondaryLabel',
      actionProp: 'secondaryAction',
      icon: 'copy',
      variant: 'secondary'
    },
    {
      labelProp: 'primaryLabel',
      actionProp: 'primaryAction',
      icon: 'export',
      variant: 'primary'
    }
  ]
});

export const genericCatalog = new Catalog<ReactComponentImplementation>(
  GENERIC_CATALOG_ID,
  [
    A2Panel,
    A2Header,
    A2StatGroup,
    A2StatChip,
    A2DataTable,
    A2DataRow,
    A2ActionBar
  ],
  []
);
