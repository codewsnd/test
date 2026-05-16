import type { ReactNode } from 'react';
import {
  CoffeeOutlined,
  CreditCardOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons';
import { Catalog, CommonSchemas } from '@a2ui/web_core/v0_9';
import {
  createComponentImplementation,
  type ReactComponentImplementation
} from '@a2ui/react/v0_9';
import { z } from 'zod';

export const COFFEE_ORDER_CATALOG_ID = 'https://local.a2ui.dev/catalogs/coffee-order/v1.json';

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
      return <div key={`${child}-${index}`}>{buildChild(child)}</div>;
    }

    if (child && typeof child === 'object' && 'id' in child) {
      const node = child as ResolvedChildNode;
      return (
        <div key={`${node.id}-${node.basePath ?? index}`}>
          {buildChild(node.id, node.basePath)}
        </div>
      );
    }

    return null;
  });
};

const CoffeeOrderCardApi = {
  name: 'CoffeeOrderCard',
  schema: z.object({
    children: CommonSchemas.ChildList
  }).strict()
};

const CoffeeOrderHeaderApi = {
  name: 'CoffeeOrderHeader',
  schema: z.object({
    eyebrow: CommonSchemas.DynamicString,
    shopName: CommonSchemas.DynamicString
  }).strict()
};

const CoffeeOrderItemsApi = {
  name: 'CoffeeOrderItems',
  schema: z.object({
    children: CommonSchemas.ChildList
  }).strict()
};

const CoffeeOrderLineItemApi = {
  name: 'CoffeeOrderLineItem',
  schema: z.object({
    name: CommonSchemas.DynamicString,
    detail: CommonSchemas.DynamicString.optional(),
    price: CommonSchemas.DynamicString
  }).strict()
};

const CoffeeOrderDividerApi = {
  name: 'CoffeeOrderDivider',
  schema: z.object({}).strict()
};

const CoffeeOrderSummaryApi = {
  name: 'CoffeeOrderSummary',
  schema: z.object({
    children: CommonSchemas.ChildList
  }).strict()
};

const CoffeeOrderSummaryRowApi = {
  name: 'CoffeeOrderSummaryRow',
  schema: z.object({
    label: CommonSchemas.DynamicString,
    amount: CommonSchemas.DynamicString,
    isTotal: CommonSchemas.DynamicBoolean.optional()
  }).strict()
};

const CoffeeOrderActionsApi = {
  name: 'CoffeeOrderActions',
  schema: z.object({
    purchaseLabel: CommonSchemas.DynamicString,
    cartLabel: CommonSchemas.DynamicString,
    purchaseAction: CommonSchemas.Action,
    addToCartAction: CommonSchemas.Action
  }).strict()
};

export const CoffeeOrderCard = createComponentImplementation(
  CoffeeOrderCardApi,
  ({ props, buildChild }) => (
    <section
      aria-label="Coffee order"
      className="w-full max-w-[402px] rounded-[14px] border border-[#84849a]/20 bg-[#f8f7fb] bg-gradient-to-br from-white/95 to-[#f8f7fc]/90 px-5 pb-[26px] pt-[22px] font-sans text-[#24232a] shadow-[0_20px_48px_rgba(59,60,85,0.12)] sm:px-[22px]"
    >
      {renderChildren(props.children, buildChild)}
    </section>
  )
);

export const CoffeeOrderHeader = createComponentImplementation(
  CoffeeOrderHeaderApi,
  ({ props }) => (
    <header>
      <div className="mb-[46px] text-sm font-semibold text-[#8d8b94]">
        {displayText(props.eyebrow)}
      </div>

      <div className="mb-[26px] flex items-center justify-center gap-[18px]">
        <CoffeeOutlined className="text-[22px] text-[#686872]" aria-hidden="true" />
        <h2 className="m-0 text-[28px] font-bold leading-none text-[#24232a]">
          {displayText(props.shopName)}
        </h2>
      </div>
    </header>
  )
);

export const CoffeeOrderItems = createComponentImplementation(
  CoffeeOrderItemsApi,
  ({ props, buildChild }) => (
    <div className="mx-auto flex max-w-[248px] flex-col gap-3.5">
      {renderChildren(props.children, buildChild)}
    </div>
  )
);

export const CoffeeOrderLineItem = createComponentImplementation(
  CoffeeOrderLineItemApi,
  ({ props }) => (
    <div>
      <div className="flex items-baseline justify-between gap-5 text-lg font-semibold text-[#6c6972]">
        <span>{displayText(props.name)}</span>
        <span className="tabular-nums">{displayText(props.price)}</span>
      </div>
      {props.detail && (
        <div className="mt-2.5 text-[17px] font-semibold italic text-[#77747e]">
          {displayText(props.detail)}
        </div>
      )}
    </div>
  )
);

export const CoffeeOrderDivider = createComponentImplementation(
  CoffeeOrderDividerApi,
  () => <div className="mx-auto my-6 h-px max-w-[248px] bg-[#686872]/20" />
);

export const CoffeeOrderSummary = createComponentImplementation(
  CoffeeOrderSummaryApi,
  ({ props, buildChild }) => (
    <div className="mx-auto flex max-w-[248px] flex-col gap-3.5">
      {renderChildren(props.children, buildChild)}
    </div>
  )
);

export const CoffeeOrderSummaryRow = createComponentImplementation(
  CoffeeOrderSummaryRowApi,
  ({ props }) => {
    const rowClassName = props.isTotal
      ? 'flex items-baseline justify-between gap-5 text-[27px] font-extrabold leading-none text-[#24232a]'
      : 'flex items-baseline justify-between gap-5 text-[17px] font-semibold italic text-[#716e78]';

    return (
      <div className={rowClassName}>
        <span>{displayText(props.label)}</span>
        <span className="tabular-nums">{displayText(props.amount)}</span>
      </div>
    );
  }
);

export const CoffeeOrderActions = createComponentImplementation(
  CoffeeOrderActionsApi,
  ({ props }) => (
    <div className="mt-6 flex justify-center gap-5">
      <button
        type="button"
        onClick={props.purchaseAction}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#7779c8] px-[17px] text-base font-semibold leading-none text-white transition hover:-translate-y-px hover:bg-[#686bbe] hover:shadow-[0_8px_18px_rgba(104,107,190,0.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7779c8] active:translate-y-0"
      >
        <CreditCardOutlined aria-hidden="true" />
        <span>{displayText(props.purchaseLabel)}</span>
      </button>

      <button
        type="button"
        onClick={props.addToCartAction}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#7779c8] px-[17px] text-base font-semibold leading-none text-white transition hover:-translate-y-px hover:bg-[#686bbe] hover:shadow-[0_8px_18px_rgba(104,107,190,0.24)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7779c8] active:translate-y-0"
      >
        <ShoppingCartOutlined aria-hidden="true" />
        <span>{displayText(props.cartLabel)}</span>
      </button>
    </div>
  )
);

export const coffeeOrderCatalog = new Catalog<ReactComponentImplementation>(
  COFFEE_ORDER_CATALOG_ID,
  [
    CoffeeOrderCard,
    CoffeeOrderHeader,
    CoffeeOrderItems,
    CoffeeOrderLineItem,
    CoffeeOrderDivider,
    CoffeeOrderSummary,
    CoffeeOrderSummaryRow,
    CoffeeOrderActions
  ],
  []
);
