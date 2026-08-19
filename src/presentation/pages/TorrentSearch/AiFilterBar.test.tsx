import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { AiFilterBar } from "./AiFilterBar";

const makeAiConfig = (alias: string): AiConfig => ({
  alias: NonEmptyStringSchema.parse(alias),
  api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
  api_key: NonEmptyStringSchema.parse("test-key"),
  ai_model: NonEmptyStringSchema.parse("gpt-3.5-turbo"),
});

describe("AiFilterBar AI 智能过滤栏组件", () => {
  it("应该渲染不使用 AI 的默认选项", () => {
    render(
      <AiFilterBar
        aiConfigs={[]}
        selectedAiAlias="none"
        disabled={false}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("AI 智能过滤:")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("不使用 AI (传统搜索)"),
    ).toBeInTheDocument();
  });

  it("应该渲染所有 AI 配置别名", () => {
    render(
      <AiFilterBar
        aiConfigs={[makeAiConfig("Test AI"), makeAiConfig("Ollama")]}
        selectedAiAlias="none"
        disabled={false}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Test AI" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ollama" })).toBeInTheDocument();
  });

  it("切换选项时调用 onSelect", () => {
    const onSelect = vi.fn();
    render(
      <AiFilterBar
        aiConfigs={[makeAiConfig("Test AI")]}
        selectedAiAlias="none"
        disabled={false}
        onSelect={onSelect}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("不使用 AI (传统搜索)"), {
      target: { value: "Test AI" },
    });

    expect(onSelect).toHaveBeenCalledWith("Test AI");
  });

  it("disabled 时应禁用选择框", () => {
    render(
      <AiFilterBar
        aiConfigs={[]}
        selectedAiAlias="none"
        disabled={true}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue("不使用 AI (传统搜索)")).toBeDisabled();
  });
});
