import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { AiConfigForm } from "./AiConfigForm";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

const makeProps = (
  overrides: Partial<Parameters<typeof AiConfigForm>[0]> = {},
) => ({
  editingIndex: -1,
  aiConfigs: [],
  aliasInput: "",
  apiEndpointInput: "",
  apiKeyInput: "",
  modelInput: "",
  testingAi: false,
  onAliasInputChange: vi.fn(),
  onApiEndpointInputChange: vi.fn(),
  onApiKeyInputChange: vi.fn(),
  onModelInputChange: vi.fn(),
  onTestConnection: vi.fn(),
  onCancel: vi.fn(),
  onSave: vi.fn(),
  ...overrides,
});

describe("AiConfigForm AI 配置表单组件", () => {
  it("添加模式下应该渲染添加标题", () => {
    render(<AiConfigForm {...makeProps()} />);

    expect(screen.getByText("添加 AI 配置")).toBeInTheDocument();
  });

  it("编辑模式下应该渲染编辑标题与预填值", () => {
    render(
      <AiConfigForm
        {...makeProps({
          editingIndex: 0,
          aiConfigs: [makeConfig()],
          aliasInput: "DeepSeek",
          apiEndpointInput: "http://127.0.0.1:11434/v1",
          apiKeyInput: "sk-test",
          modelInput: "deepseek-chat",
        })}
      />,
    );

    expect(screen.getByText("编辑 AI 配置: DeepSeek")).toBeInTheDocument();
    expect(screen.getByLabelText("配置别名 (Alias) *")).toHaveValue("DeepSeek");
    expect(screen.getByLabelText("AI 接口地址 (Endpoint) *")).toHaveValue(
      "http://127.0.0.1:11434/v1",
    );
    expect(screen.getByLabelText("API 密钥 (API Key) *")).toHaveValue(
      "sk-test",
    );
    expect(screen.getByLabelText("模型名称 (Model)")).toHaveValue(
      "deepseek-chat",
    );
  });

  it("输入更改时应该触发对应回调", () => {
    const props = makeProps();
    render(<AiConfigForm {...props} />);

    fireEvent.change(screen.getByLabelText("配置别名 (Alias) *"), {
      target: { value: "Ollama" },
    });
    fireEvent.change(screen.getByLabelText("AI 接口地址 (Endpoint) *"), {
      target: { value: "http://localhost:11434" },
    });
    fireEvent.change(screen.getByLabelText("API 密钥 (API Key) *"), {
      target: { value: "sk-123" },
    });
    fireEvent.change(screen.getByLabelText("模型名称 (Model)"), {
      target: { value: "llama3" },
    });

    expect(props.onAliasInputChange).toHaveBeenCalledWith("Ollama");
    expect(props.onApiEndpointInputChange).toHaveBeenCalledWith(
      "http://localhost:11434",
    );
    expect(props.onApiKeyInputChange).toHaveBeenCalledWith("sk-123");
    expect(props.onModelInputChange).toHaveBeenCalledWith("llama3");
  });

  it("点击测试/取消/保存按钮时应该触发对应回调", () => {
    const props = makeProps();
    render(<AiConfigForm {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "测试模型连接" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    expect(props.onTestConnection).toHaveBeenCalled();
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onSave).toHaveBeenCalled();
  });

  it("测试中时应该显示正在测试状态", () => {
    render(<AiConfigForm {...makeProps({ testingAi: true })} />);

    expect(screen.getByText("正在测试连接...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "正在测试连接..." }),
    ).toBeDisabled();
  });
});
