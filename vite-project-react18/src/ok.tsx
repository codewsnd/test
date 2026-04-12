import {
  createDesigner,
  GlobalRegistry,
  KeyCode,
  Shortcut,
} from '@trionesdev/designable-core';
import {useEffect, useMemo} from 'react';
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
import {SettingsForm} from '@trionesdev/designable-react-settings-form';
import {transformToSchema} from '@trionesdev/designable-formily-transformer';
import {Button} from 'antd';
import {PreviewWidget} from './PreviewWidget';


export const Ok = function () {
  const engine = useMemo(
    () =>
      createDesigner({
        shortcuts: [
          new Shortcut({
            codes: [
              [KeyCode.Meta, KeyCode.S],
              [KeyCode.Control, KeyCode.S],
            ],
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            handler(_ctx: any) {
              console.log(
                JSON.stringify(transformToSchema(engine.getCurrentTree())),
              );
            },
          }),
        ],
        rootComponentName: 'Form',
      }),
    [],
  );

  const handleSave = () => {
    console.log(JSON.stringify(transformToSchema(engine.getCurrentTree())));
  };

  useEffect(() => {
    GlobalRegistry.setDesignerLanguage('en-US');
    // engine.setCurrentTree(transformToTreeNode({"form":{"labelCol":6,"wrapperCol":12},"schema":{"type":"object","properties":{"1lwe8e6kk06":{"type":"string","title":"Input","x-decorator":"FormItem","x-component":"Input","x-validator":[],"x-component-props":{},"x-decorator-props":{},"x-designable-id":"1lwe8e6kk06","x-index":0},"0t3rpvtlhzn":{"title":"Password","x-decorator":"FormItem","x-component":"Password","x-validator":[],"x-component-props":{},"x-decorator-props":{},"x-designable-id":"0t3rpvtlhzn","x-index":1},"85f396zxx9c":{"type":"number","title":"Rate","x-decorator":"FormItem","x-component":"Rate","x-validator":[],"x-component-props":{},"x-decorator-props":{},"x-designable-id":"85f396zxx9c","x-index":2}},"x-designable-id":"r23w0z0ou5t"}}))
  }, []);

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

  return (
    <Designer engine={engine}>
      <StudioPanel actions={[<Button onClick={handleSave}>保存</Button>]}>
        <CompositePanel>
          <CompositePanel.Item title="panels.Component" icon="Component">
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
            <ResourceWidget title="sources.Displays" sources={[Text]}/>
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
                use={['DESIGNABLE', 'JSONTREE', 'MARKUP', 'PREVIEW']}
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
  );
}

