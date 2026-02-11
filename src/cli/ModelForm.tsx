import React from "react";
import { Form, type FormProps } from "ink-form";
import { Box, Text, useInput } from "ink";

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
 * 按 q 可取消返回
 */
const ModelForm: React.FC<Props> = ({ mode, initialValues, onSubmit, onCancel }) => {
  // 监听 q 键取消（避免与 ink-form 的 ESC 冲突）
  useInput((input) => {
    if (input.toLowerCase() === "q") {
      onCancel();
    }
  });

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
    // onCancel: onCancel,
  };

  return (
    <Box flexDirection="column">
      <Form {...formConfig} />
      <Box marginTop={2} justifyContent="flex-end">
        <Text color="gray">
          按 <Text color="cyan">q</Text> 返回模型选择
        </Text>
      </Box>
    </Box>
  );
};

export default ModelForm;
