import {
  Form,
  Input,
  Select,
  TreeSelect,
  Cascader,
  Radio,
  Checkbox,
  NumberPicker,
  Transfer,
  Password,
  DatePicker,
  TimePicker,
  Upload,
  Switch,
  ArrayCards,
  ArrayTable,
  Space,
  FormTab,
  FormCollapse,
  FormLayout,
  FormGrid,
  FormButtonGroup,
  FormItem,
  Submit,
} from '@formily/antd-v5';
import {createForm} from "@formily/core";
import {createSchemaField, FormProvider} from '@formily/react'

import {
  Card,
  Field,
  ObjectContainer,
  Rate,
  Slider,
  Text,
} from '@trionesdev/designable-formily-antd';
import type {FC} from "react";
import type {IFormilySchema} from "@trionesdev/designable-formily-transformer";
import { MentionsWithDefaults } from './BQAMentions';

const SchemaField = createSchemaField({
  components: {
    Form,
    Field,
    Input: {
      ...Input,
      // 当遇到Input.TextArea时，替换为Mentions组件
      TextArea: MentionsWithDefaults
    },
    Select,
    TreeSelect,
    Cascader,
    Radio,
    Checkbox,
    Slider,
    Rate,
    NumberPicker,
    Transfer,
    Password,
    DatePicker,
    TimePicker,
    Upload,
    Switch,
    Text,
    Card,
    ArrayCards,
    ObjectContainer,
    ArrayTable,
    Space,
    FormTab,
    FormCollapse,
    FormLayout,
    FormGrid,
    FormItem,
    Mentions: MentionsWithDefaults // 也可以直接使用Mentions
  },
});

type QAFormProps = {
  initialValues?: any;
  onSubmit?: (values: any) => void;
  formConfig: IFormilySchema;
};

export const BQAForm: FC<QAFormProps> = ({initialValues, onSubmit, formConfig}) => {

  const {form: formLayoutProps = {}, schema} = formConfig || {};

  const form = createForm({
    initialValues: initialValues || {},
  });

  return (
    <>
      <FormProvider form={form}>
        <FormLayout {...formLayoutProps}>
          <SchemaField schema={schema}/>
        </FormLayout>
        <FormButtonGroup align={'center'}>
          <Submit onSubmit={onSubmit}>Submit</Submit>
        </FormButtonGroup>
      </FormProvider>
    </>
  );
}
