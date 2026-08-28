import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { TranslationSettingsSection } from "./TranslationSettingsSection";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("GPT-4"),
  api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
  api_key: NonEmptyStringSchema.parse("test-key"),
  ai_model: NonEmptyStringSchema.parse("gpt-4"),
  ...overrides,
});

const mockAiConfigs: AiConfig[] = [
  makeConfig(),
  makeConfig({
    alias: NonEmptyStringSchema.parse("Claude"),
    api_endpoint: NonEmptyStringSchema.parse("https://api.anthropic.com"),
    api_key: NonEmptyStringSchema.parse("test-key-2"),
    ai_model: NonEmptyStringSchema.parse("claude-3"),
  }),
];

const makeProps = (
  overrides: Partial<Parameters<typeof TranslationSettingsSection>[0]> = {},
): Parameters<typeof TranslationSettingsSection>[0] => ({
  targetLang: "zh-CN",
  provider: "google",
  aiConfigAlias: null,
  aiConfigs: null,
  onTargetLangChange: vi.fn(),
  onProviderChange: vi.fn(),
  onAiConfigAliasChange: vi.fn(),
  ...overrides,
});

describe("TranslationSettingsSection 翻译设置区块", () => {
  it("应该渲染标题、目标语言和翻译提供者选项", () => {
    render(<TranslationSettingsSection {...makeProps()} />);

    expect(screen.getByText("翻译设置")).toBeInTheDocument();
    expect(screen.getByText("目标语言")).toBeInTheDocument();
    expect(screen.getByText("翻译提供者")).toBeInTheDocument();
  });

  it("当前目标语言应该被选中，切换时触发 onTargetLangChange", () => {
    const onTargetLangChange = vi.fn();
    render(
      <TranslationSettingsSection {...makeProps({ onTargetLangChange })} />,
    );

    const selects = screen.getAllByRole("combobox");
    const targetLangSelect = selects[0];
    expect(targetLangSelect).toHaveValue("zh-CN");

    fireEvent.change(targetLangSelect, { target: { value: "en" } });

    expect(onTargetLangChange).toHaveBeenCalledWith("en");
  });

  it("当前翻译提供者应该被选中，切换时触发 onProviderChange", () => {
    const onProviderChange = vi.fn();
    render(<TranslationSettingsSection {...makeProps({ onProviderChange })} />);

    const selects = screen.getAllByRole("combobox");
    const providerSelect = selects[1];
    expect(providerSelect).toHaveValue("google");

    fireEvent.change(providerSelect, { target: { value: "ai" } });

    expect(onProviderChange).toHaveBeenCalledWith("ai");
  });

  it("当 provider 为 google 时，不应该显示 AI 配置选项", () => {
    render(
      <TranslationSettingsSection {...makeProps({ provider: "google" })} />,
    );

    expect(screen.queryByText("AI 配置")).not.toBeInTheDocument();
  });

  it("当 provider 为 ai 时，应该显示 AI 配置选项", () => {
    render(
      <TranslationSettingsSection
        {...makeProps({
          provider: "ai",
          aiConfigs: mockAiConfigs,
          aiConfigAlias: "GPT-4",
        })}
      />,
    );

    expect(screen.getByText("AI 配置")).toBeInTheDocument();
  });

  it("切换 AI 配置时应该触发 onAiConfigAliasChange", () => {
    const onAiConfigAliasChange = vi.fn();
    render(
      <TranslationSettingsSection
        {...makeProps({
          provider: "ai",
          aiConfigs: mockAiConfigs,
          aiConfigAlias: "GPT-4",
          onAiConfigAliasChange,
        })}
      />,
    );

    const selects = screen.getAllByRole("combobox");
    const aiConfigSelect = selects[2];
    fireEvent.change(aiConfigSelect, { target: { value: "Claude" } });

    expect(onAiConfigAliasChange).toHaveBeenCalledWith("Claude");
  });

  it("当 AI 配置选择空值时，应该触发 onAiConfigAliasChange(null)", () => {
    const onAiConfigAliasChange = vi.fn();
    render(
      <TranslationSettingsSection
        {...makeProps({
          provider: "ai",
          aiConfigs: mockAiConfigs,
          aiConfigAlias: "GPT-4",
          onAiConfigAliasChange,
        })}
      />,
    );

    const selects = screen.getAllByRole("combobox");
    const aiConfigSelect = selects[2];
    fireEvent.change(aiConfigSelect, { target: { value: "" } });

    expect(onAiConfigAliasChange).toHaveBeenCalledWith(null);
  });
});
