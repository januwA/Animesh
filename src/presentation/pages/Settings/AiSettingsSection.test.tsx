import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { AiSettingsSection } from "./AiSettingsSection";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

const makeProps = (
  overrides: Partial<Parameters<typeof AiSettingsSection>[0]> = {},
) => ({
  aiConfigs: [],
  editingIndex: null,
  aliasInput: "",
  apiEndpointInput: "",
  apiKeyInput: "",
  modelInput: "",
  testingAi: false,
  onAliasInputChange: vi.fn(),
  onApiEndpointInputChange: vi.fn(),
  onApiKeyInputChange: vi.fn(),
  onModelInputChange: vi.fn(),
  onTestConfig: vi.fn(),
  onStartAdd: vi.fn(),
  onStartEdit: vi.fn(),
  onCancelEdit: vi.fn(),
  onDeleteConfig: vi.fn(),
  onSaveConfig: vi.fn(),
  onTestCurrentConnection: vi.fn(),
  ...overrides,
});

describe("AiSettingsSection AI 设置区块", () => {
  it("未编辑时应该渲染配置列表与添加按钮，不渲染表单", () => {
    render(<AiSettingsSection {...makeProps()} />);

    expect(screen.getByText("AI 智能搜索模型设置")).toBeInTheDocument();
    expect(screen.getByText("暂无 AI 配置")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ 添加 AI 配置" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "保存配置" }),
    ).not.toBeInTheDocument();
  });

  it("编辑中时应该渲染编辑表单", () => {
    render(
      <AiSettingsSection
        {...makeProps({
          editingIndex: -1,
          aiConfigs: [makeConfig()],
        })}
      />,
    );

    expect(screen.getByText("添加 AI 配置")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "+ 添加 AI 配置" }),
    ).not.toBeInTheDocument();
  });

  it("点击添加按钮应该触发 onStartAdd 回调", () => {
    const props = makeProps();
    render(<AiSettingsSection {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "+ 添加 AI 配置" }));

    expect(props.onStartAdd).toHaveBeenCalled();
  });
});
