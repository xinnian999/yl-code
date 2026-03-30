import React from "react";
import { Form, type FormProps } from "ink-form";
import { Box, Text, useInput } from "ink";

/** 模型表单数据 */
export interface ModelFormData {
  /** 显示名称 */
  name: string;
  /** Base URL */
  baseUrl: string;
  /** API Key */
  apiKey: string;
  /** 模型标识 */
  modelName: string;
}

/** 模型表单属性 */
export interface ModelFormProps {
  /** 表单模式 */
  mode: "add" | "edit";
  /** 初始值 */
  initialValues?: ModelFormData;
  /** 提交回调 */
  onSubmit: (data: ModelFormData) => void;
  /** 取消回调 */
  onCancel: () => void;
}

/** 模型表单 */
const ModelForm: React.FC<ModelFormProps> = ({
  mode,
  initialValues,
  onSubmit,
  onCancel,
}) => {
  useInput((input) => {
    if (input.toLowerCase() === "q") {
      onCancel();
    }
  });

  /** 当前表单配置 */
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
      const data = result as Record<string, unknown>;
      onSubmit({
        name: (data.name as string) || "",
        baseUrl: (data.baseUrl as string) || "",
        apiKey: (data.apiKey as string) || "",
        modelName: (data.modelName as string) || "",
      });
    },
  };

  return (
    <Box flexDirection="column">
      <Form {...formConfig} />
      <Box marginTop={2} justifyContent="flex-end">
        <Text dimColor>
          按 <Text color="cyan">q</Text> 返回模型选择
        </Text>
      </Box>
    </Box>
  );
};

export default ModelForm;
