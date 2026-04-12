import {Input, Select, FormItem, FormLayout} from '@formily/antd-v5'
import {createForm} from '@formily/core'
import {FormProvider, createSchemaField} from '@formily/react'

const SchemaField = createSchemaField({
  components: {
    Input,
    Select,
    FormItem,
    FormLayout,
  },
})

const schema = {
  "form": {
    "labelCol": 6,
    "wrapperCol": 12
  },
  "schema": {
    "type": "object",
    "properties": {
      "h0n4u08e4la": {
        "type": "string",
        "title": "Input",
        "x-decorator": "FormItem",
        "x-component": "Input",
        "x-validator": [],
        "x-component-props": {},
        "x-decorator-props": {},
        "x-designable-id": "h0n4u08e4la",
        "x-index": 0
      },
      "mb0kluvzwc2": {
        "type": "string",
        "title": "Input",
        "x-decorator": "FormItem",
        "x-component": "Input",
        "x-validator": [],
        "x-component-props": {},
        "x-decorator-props": {},
        "x-designable-id": "mb0kluvzwc2",
        "x-index": 1
      },
      "jhppe0uwy0y": {
        "type": "string",
        "title": "Input",
        "x-decorator": "FormItem",
        "x-component": "Input",
        "x-validator": [],
        "x-component-props": {},
        "x-decorator-props": {},
        "required": true,
        "x-designable-id": "jhppe0uwy0y",
        "x-index": 2
      }
    },
    "x-designable-id": "tmdpanmzere"
  }
}

const form = createForm()

export const Test = () => (
  <FormProvider form={form}>
    <SchemaField schema={schema.schema}/>
  </FormProvider>
)
