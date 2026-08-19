import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { AiConfigList } from "./AiConfigList";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

const makeProps = (
  overrides: Partial<Parameters<typeof AiConfigList>[0]> = {},
) => ({
  aiConfigs: [],
  testingAi: false,
  showAddButton: true,
  onTest: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onAdd: vi.fn(),
  ...overrides,
});

describe("AiConfigList AI 配置列表组件", () => {
  it("应该渲染配置列表与对应操作按钮", () => {
    render(
      <AiConfigList
        {...makeProps({
          aiConfigs: [
            makeConfig(),
            makeConfig({
              alias: NonEmptyStringSchema.parse("Ollama"),
              ai_model: NonEmptyStringSchema.parse("llama3"),
            }),
          ],
        })}
      />,
    );

    expect(screen.getByText("DeepSeek")).toBeInTheDocument();
    expect(screen.getByText("deepseek-chat")).toBeInTheDocument();
    expect(screen.getByText("llama3")).toBeInTheDocument();
    expect(screen.getByText("Ollama")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "测试" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "编辑" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "删除" })).toHaveLength(2);
  });

  it("没有配置时应该渲染空状态提示", () => {
    render(<AiConfigList {...makeProps()} />);

    expect(screen.getByText("暂无 AI 配置")).toBeInTheDocument();
  });

  it("showAddButton 为 true 时渲染添加按钮，否则不渲染", () => {
    const { unmount } = render(<AiConfigList {...makeProps()} />);
    expect(
      screen.getByRole("button", { name: "+ 添加 AI 配置" }),
    ).toBeInTheDocument();
    unmount();

    render(<AiConfigList {...makeProps({ showAddButton: false })} />);
    expect(
      screen.queryByRole("button", { name: "+ 添加 AI 配置" }),
    ).not.toBeInTheDocument();
  });

  it("点击测试/编辑/删除按钮时应该触发对应回调", () => {
    const props = makeProps({
      aiConfigs: [makeConfig({ alias: NonEmptyStringSchema.parse("Ollama") })],
    });
    render(<AiConfigList {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "测试" }));
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "删除" }));

    expect(props.onTest).toHaveBeenCalledWith(
      expect.objectContaining({ alias: "Ollama" }),
    );
    expect(props.onEdit).toHaveBeenCalledWith(0);
    expect(props.onDelete).toHaveBeenCalledWith(0);
  });

  it("添加按钮点击时应该触发 onAdd 回调", () => {
    const props = makeProps();
    render(<AiConfigList {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "+ 添加 AI 配置" }));

    expect(props.onAdd).toHaveBeenCalled();
  });

  it("测试中时测试按钮应该被禁用", () => {
    render(
      <AiConfigList
        {...makeProps({ aiConfigs: [makeConfig()], testingAi: true })}
      />,
    );

    expect(screen.getByRole("button", { name: "测试" })).toBeDisabled();
  });
});
