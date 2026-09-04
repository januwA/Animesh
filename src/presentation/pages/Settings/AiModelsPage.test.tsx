import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import AiModelsPage from "./AiModelsPage";
import * as hook from "./useAiConfigsForm";

vi.mock(import("./useAiConfigsForm"), () => ({
  useAiConfigsForm: vi.fn(),
}));

vi.mock(import("./AiConfigForm"), () => ({
  AiConfigForm: () => <div data-testid="ai-config-form" />,
}));

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

function mockForm(
  overrides: Partial<ReturnType<typeof hook.useAiConfigsForm>> = {},
) {
  vi.mocked(hook.useAiConfigsForm).mockReturnValue({
    aiConfigs: [],
    editingIndex: null,
    form: {} as ReturnType<typeof hook.useAiConfigsForm>["form"],
    testingAi: false,
    saving: false,
    loading: false,
    handleStartAdd: vi.fn(),
    handleStartEdit: vi.fn(),
    handleCancelEdit: vi.fn(),
    handleDeleteConfig: vi.fn(),
    handleSaveConfig: vi.fn(),
    handleTestConfig: vi.fn(),
    handleTestCurrentConnection: vi.fn(),
    ...overrides,
  } as ReturnType<typeof hook.useAiConfigsForm>);
}

describe("AiModelsPage AI 模型设置页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("加载中应显示加载提示", () => {
    mockForm({ loading: true });
    render(<AiModelsPage />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("无配置时应显示空状态", () => {
    mockForm({ aiConfigs: [] });
    render(<AiModelsPage />);
    expect(screen.getByText("暂无 AI 配置")).toBeInTheDocument();
  });

  it("有配置时应显示配置列表", () => {
    mockForm({ aiConfigs: [makeConfig()] });
    render(<AiModelsPage />);
    expect(screen.getByText("DeepSeek")).toBeInTheDocument();
    expect(screen.getByText("deepseek-chat")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:11434/v1")).toBeInTheDocument();
  });

  it("未编辑时应显示添加按钮", () => {
    mockForm({ editingIndex: null });
    render(<AiModelsPage />);
    expect(screen.getByText("+ 添加 AI 配置")).toBeInTheDocument();
  });

  it("点击测试按钮应调用 handleTestConfig", () => {
    const handleTestConfig = vi.fn();
    const config = makeConfig();
    mockForm({ aiConfigs: [config], handleTestConfig });
    render(<AiModelsPage />);
    screen.getByRole("button", { name: "测试" }).click();
    expect(handleTestConfig).toHaveBeenCalledWith(config);
  });

  it("点击编辑按钮应调用 handleStartEdit", () => {
    const handleStartEdit = vi.fn();
    mockForm({ aiConfigs: [makeConfig()], handleStartEdit });
    render(<AiModelsPage />);
    screen.getByRole("button", { name: "编辑" }).click();
    expect(handleStartEdit).toHaveBeenCalledWith(0);
  });

  it("点击删除按钮应调用 handleDeleteConfig", () => {
    const handleDeleteConfig = vi.fn();
    mockForm({ aiConfigs: [makeConfig()], handleDeleteConfig });
    render(<AiModelsPage />);
    screen.getByRole("button", { name: "删除" }).click();
    expect(handleDeleteConfig).toHaveBeenCalledWith(0);
  });

  it("点击添加按钮应调用 handleStartAdd", () => {
    const handleStartAdd = vi.fn();
    mockForm({ handleStartAdd });
    render(<AiModelsPage />);
    screen.getByRole("button", { name: "+ 添加 AI 配置" }).click();
    expect(handleStartAdd).toHaveBeenCalled();
  });

  it("测试中时测试按钮应禁用", () => {
    mockForm({ aiConfigs: [makeConfig()], testingAi: true });
    render(<AiModelsPage />);
    expect(screen.getByRole("button", { name: "测试" })).toBeDisabled();
  });

  it("编辑中时应显示 AI 配置表单", () => {
    mockForm({ editingIndex: 0, aiConfigs: [makeConfig()] });
    render(<AiModelsPage />);
    expect(screen.getByTestId("ai-config-form")).toBeInTheDocument();
  });
});
