import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig } from "@/domain/settings/SettingsSchemas";
import { SearchForm } from "./SearchForm";
import type { TorrentSearchFormValues } from "./useTorrentSearchPage";

const makeAiConfig = (alias: string): AiConfig => ({
  alias: NonEmptyStringSchema.parse(alias),
  api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
  api_key: NonEmptyStringSchema.parse("test-key"),
  ai_model: NonEmptyStringSchema.parse("gpt-3.5-turbo"),
});

interface RenderSearchFormOptions {
  defaultKeyword?: string;
  loading?: boolean;
  aiConfigs?: AiConfig[];
}

function renderSearchForm(options: RenderSearchFormOptions = {}) {
  const { defaultKeyword = "", loading = false, aiConfigs = [] } = options;

  let formRef: ReturnType<typeof useForm<TorrentSearchFormValues>> | null =
    null;

  function Wrapper() {
    const form = useForm<TorrentSearchFormValues>({
      defaultValues: {
        keyword: defaultKeyword,
        searchEngine: "dmhy",
        aiAlias: "none",
      },
    });
    formRef = form;

    return (
      <FormProvider {...form}>
        <SearchForm
          form={form}
          loading={loading}
          aiConfigs={aiConfigs}
          onSubmit={vi.fn()}
        />
      </FormProvider>
    );
  }

  const result = render(<Wrapper />);
  return { ...result, form: formRef! };
}

describe("SearchForm 搜索表单组件", () => {
  it("应该渲染关键词输入框与搜索按钮", () => {
    renderSearchForm({ defaultKeyword: "xxx" });

    expect(screen.getByTestId("search-input")).toHaveValue("xxx");
    expect(screen.getByPlaceholderText("输入动漫名称")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索" })).toBeInTheDocument();
  });

  it("提交表单时应该触发 handleSubmit", () => {
    renderSearchForm({ defaultKeyword: "xxx" });

    fireEvent.submit(screen.getByTestId("search-input").closest("form")!);
  });

  it("应该渲染所有搜索引擎选项", () => {
    renderSearchForm();

    const select = screen.getByDisplayValue("动漫花园");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "萌番组" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "蜜柑计划" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nyaa" })).toBeInTheDocument();
  });

  it("关键词为空时搜索按钮应禁用", () => {
    renderSearchForm({ defaultKeyword: "   " });

    expect(screen.getByRole("button", { name: "搜索" })).toBeDisabled();
  });

  it("加载中时输入框与按钮应禁用并显示搜索中状态", () => {
    renderSearchForm({ defaultKeyword: "xxx", loading: true });

    expect(screen.getByTestId("search-input")).toBeDisabled();
    expect(screen.getByText("搜索中...")).toBeInTheDocument();
  });

  it("无 AI 配置时不渲染 AI 过滤栏", () => {
    renderSearchForm({ aiConfigs: [] });

    expect(screen.queryByDisplayValue("传统搜索")).not.toBeInTheDocument();
  });

  it("有 AI 配置时应渲染 AI 过滤栏与选项", () => {
    const aiConfigs = [makeAiConfig("Test AI"), makeAiConfig("GPT-4")];
    renderSearchForm({ aiConfigs });

    expect(screen.getByDisplayValue("传统搜索")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Test AI" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "GPT-4" })).toBeInTheDocument();
  });

  it("切换 AI 别名时应更新表单值", () => {
    const aiConfigs = [makeAiConfig("Test AI")];
    const { form } = renderSearchForm({ aiConfigs });

    fireEvent.change(screen.getByDisplayValue("传统搜索"), {
      target: { value: "Test AI" },
    });

    expect(form.getValues("aiAlias")).toBe("Test AI");
  });

  it("加载中时 AI 过滤栏应禁用", () => {
    const aiConfigs = [makeAiConfig("Test AI")];
    renderSearchForm({ aiConfigs, loading: true });

    expect(screen.getByDisplayValue("传统搜索")).toBeDisabled();
  });
});
