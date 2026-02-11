import React from "react";
import { Form, type FormProps } from "ink-form";

export interface ModelFormData {
  name: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

interface Props {
  mode: "add" | "edit";
  initialValues?: ModelFormData;
  onSubmit: (data: ModelFormData) => void;
  onCancel: () => void;
}

/**
 * 模型表单组件
 * 支持添加和编辑两种模式
 */
const ModelForm: React.FC<Props> = ({ mode, initialValues, onSubmit, onCancel }) => {
  const formConfig: FormProps = {
    form: {
      title: mode === "add" ? "添加新模型" : "编辑模型",
      sections: [
        {
          title: "模型配置 (OpenAI 协议)",
          fields: [
            {
              type: "string",
              name: "name",
              label: "模型名称 (显示名)",
              initialValue: initialValues?.name || "",
            },
            {
              type: "string",
              name: "baseUrl",
              label: "Base URL",
              initialValue: initialValues?.baseUrl || "",
            },
            {
              type: "string",
              name: "apiKey",
              label: "API Key",
              mask: "*",
              initialValue: initialValues?.apiKey || "",
            },
            {
              type: "string",
              name: "modelName",
              label: "Model Name (模型标识)",
              initialValue: initialValues?.modelName || "",
            },
          ],
        },
      ],
    },
    onSubmit: (result) => {
      onSubmit({
        name: (result.name as string) || "",
        baseUrl: (result.baseUrl as string) || "",
        apiKey: (result.apiKey as string) || "",
        modelName: (result.modelName as string) || "",
      });
    },
    onCancel: onCancel,
  };

  return <Form {...formConfig} />;
};

export default ModelForm;
