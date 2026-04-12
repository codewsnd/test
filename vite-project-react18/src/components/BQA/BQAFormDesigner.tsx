import {
  createDesigner, Engine,
  GlobalRegistry,
  KeyCode,
  Shortcut,
} from '@trionesdev/designable-core';
import {type FC, type ReactNode, useEffect, useMemo} from 'react';
import {
  ComponentTreeWidget,
  CompositePanel,
  Designer,
  DesignerToolsWidget,
  HistoryWidget, type IDesignerComponents,
  OutlineTreeWidget,
  ResourceWidget,
  SettingsPanel,
  StudioPanel,
  ToolbarPanel,
  ViewPanel,
  ViewportPanel,
  ViewToolsWidget,
  Workspace,
  WorkspacePanel,
} from '@trionesdev/designable-react';
import {
  Form,
  Field,
  Input,
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
} from '@trionesdev/designable-formily-antd';
import {MonacoInput, SettingsForm} from '@trionesdev/designable-react-settings-form';
import {type IFormilySchema, transformToSchema, transformToTreeNode} from '@trionesdev/designable-formily-transformer';
import {PreviewWidget} from '../../PreviewWidget';
import {MarkupSchemaWidget} from "./MarkupSchemaWidget";
import copy from 'copy-to-clipboard';
import {readClipboard} from '../../utils/clipboardUtils';
import {useRequest} from "ahooks";
import {getFormApi, saveFormApi} from "../../api/form";
import {Button, message} from "antd";
import {useNavigate, useSearchParams} from "react-router";
import type {Form as FormModel} from "../../models/form";

type QAFormDesignerProps = {
  formConfig?: IFormilySchema
  logo?: ReactNode
  actions?: ReactNode[],
  customEngine?: Engine
};

export const BQAFormDesigner: FC<QAFormDesignerProps> = ({formConfig, logo, actions, customEngine}) => {
  const engine = customEngine || useMemo(
    () =>
      createDesigner({
        shortcuts: [
          new Shortcut({
            codes: [
              [KeyCode.Meta, KeyCode.I],
              [KeyCode.Control, KeyCode.I],
            ],
            handler(_ctx: any) {
              try {
                readClipboard().then
                (text => {
                  engine.setCurrentTree(transformToTreeNode(JSON.parse(text)));
                })
              } catch (err) {
                console.error(err)
              }
            },
          }),
          new Shortcut({
            codes: [
              [KeyCode.Meta, KeyCode.O],
              [KeyCode.Control, KeyCode.O],
            ],
            handler(_ctx: any) {
              const schema = JSON.stringify(transformToSchema(engine.getCurrentTree()));
              copy(schema);
              console.log(schema);
            },
          }),
        ],
        rootComponentName: 'Form',
      }),
    [],
  );

  const [searchParams] = useSearchParams();
  const formId = searchParams.get('formId'); // 获取 formId 值
  const navigate = useNavigate();

  // 删除表单
  const {run: getFormApiRun, data: getFormApiData} = useRequest(
    async (id: string) => {
      return getFormApi(id);
    },
    {
      manual: true,
    }
  );

  const {run: saveFormApiRun} = useRequest(
    async (form: FormModel) => {
      return saveFormApi(form);
    },
    {
      manual: true,
      onSuccess: () => {
        message.success('Save successfully');
      }
    }
  );

  useEffect(() => {
    GlobalRegistry.setDesignerLanguage('en-US');
    if (formConfig) {
      engine.setCurrentTree(transformToTreeNode(formConfig));
    }
    if (formId) {
      getFormApiRun(formId);
    }
  }, []);

  useEffect(() => {
    if (getFormApiData && getFormApiData?.formConfig) {
      engine.setCurrentTree(transformToTreeNode(getFormApiData?.formConfig));
    }
  }, [getFormApiData]);


  const handleSaveForm = () => {
    const schema = JSON.stringify(transformToSchema(engine.getCurrentTree()));
    const formConfig = JSON.parse(schema);
    console.log(formConfig);
    const form: FormModel = {
      formConfig,
      id: formId || ''
    };
    saveFormApiRun(form)
  }

  const components: IDesignerComponents = {
    Form,
    Field,
    Input,
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
  };

  return <>
    <Designer engine={engine}>
      <StudioPanel
        logo={logo || <></>}
        actions={actions || [
          <Button onClick={handleSaveForm}>Save</Button>,
          <Button danger onClick={() =>
            navigate('/admin', {state: {activeMenu: 'sub3'}})
          }>Exit</Button>
        ]}
      >
        <CompositePanel>
          <CompositePanel.Item title="panels.Component" icon="Component">
            <ResourceWidget title="sources.Displays" sources={[Text]}/>
            <ResourceWidget
              title="sources.Inputs"
              sources={[
                Input,
                Password,
                NumberPicker,
                Rate,
                Slider,
                Select,
                TreeSelect,
                Cascader,
                Transfer,
                Checkbox,
                Radio,
                DatePicker,
                TimePicker,
                Upload,
                Switch,
                ObjectContainer,
              ]}
            />
            <ResourceWidget title="sources.Layouts" sources={[Card, FormGrid, Space]}/>
            <ResourceWidget
              title="sources.Arrays"
              sources={[ArrayCards, ArrayTable]}
            />
          </CompositePanel.Item>
          <CompositePanel.Item title="panels.OutlinedTree" icon="Outline">
            <OutlineTreeWidget/>
          </CompositePanel.Item>
          <CompositePanel.Item title="panels.History" icon="History">
            <HistoryWidget/>
          </CompositePanel.Item>
        </CompositePanel>
        <Workspace id="form">
          <WorkspacePanel>
            <ToolbarPanel>
              <DesignerToolsWidget/>
              <ViewToolsWidget
                use={['test', 'DESIGNABLE', 'JSONTREE', 'MARKUP', 'PREVIEW']}
              />
            </ToolbarPanel>
            <ViewportPanel style={{height: '100%'}}>
              <ViewPanel type="DESIGNABLE">
                {() => (
                  <ComponentTreeWidget
                    components={components}
                  />
                )}
              </ViewPanel>
              <ViewPanel type="JSONTREE" scrollable={false}>
                {(tree, onChange) => (
                  <MonacoInput
                    value={JSON.stringify(transformToSchema(tree), null, 2)}
                    onChange={(value) => {
                      onChange?.(transformToTreeNode(JSON.parse(value)))
                    }}
                    language="json"
                  />
                )}
              </ViewPanel>
              <ViewPanel type="MARKUP" scrollable={false}>
                {(tree) => <MarkupSchemaWidget tree={tree}/>}
              </ViewPanel>
              <ViewPanel type={`PREVIEW`}>
                {/*@ts-ignore*/}
                {(tree) => <PreviewWidget tree={tree} components={components}/>}
              </ViewPanel>
            </ViewportPanel>
          </WorkspacePanel>
        </Workspace>
        <SettingsPanel title="panels.PropertySettings">
          <SettingsForm uploadAction="https://www.mocky.io/v2/5cc8019d300000980a055e76"/>
        </SettingsPanel>
      </StudioPanel>
    </Designer>
  </>
}
