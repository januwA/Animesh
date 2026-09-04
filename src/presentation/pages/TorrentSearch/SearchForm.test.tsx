import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { vi } from "vitest";
import { SearchForm } from "./SearchForm";
import type { TorrentSearchFormValues } from "./useTorrentSearchPage";

interface RenderSearchFormOptions {
  defaultKeyword?: string;
  loading?: boolean;
  defaultEngines?: TorrentSearchFormValues["searchEngines"];
}

function renderSearchForm(options: RenderSearchFormOptions = {}) {
  const {
    defaultKeyword = "",
    loading = false,
    defaultEngines = ["dmhy"],
  } = options;

  let formRef: ReturnType<typeof useForm<TorrentSearchFormValues>> | null =
    null;

  function Wrapper() {
    const form = useForm<TorrentSearchFormValues>({
      defaultValues: {
        keyword: defaultKeyword,
        searchEngines: defaultEngines,
      },
    });
    formRef = form;

    return (
      <FormProvider {...form}>
        <SearchForm form={form} loading={loading} onSubmit={vi.fn()} />
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

  it("关键词为空时搜索按钮应禁用", () => {
    renderSearchForm({ defaultKeyword: "   " });

    expect(screen.getByRole("button", { name: "搜索" })).toBeDisabled();
  });

  it("加载中时输入框与按钮应禁用并显示搜索中状态", () => {
    renderSearchForm({ defaultKeyword: "xxx", loading: true });

    expect(screen.getByTestId("search-input")).toBeDisabled();
    expect(screen.getByText("搜索中...")).toBeInTheDocument();
  });

  it("单引擎时显示引擎名称", () => {
    renderSearchForm({ defaultEngines: ["dmhy"] });

    expect(screen.getByText("动漫花园")).toBeInTheDocument();
  });

  it("多引擎时显示已选数量", () => {
    renderSearchForm({ defaultEngines: ["dmhy", "nyaa"] });

    expect(screen.getByText("已选 2 个引擎")).toBeInTheDocument();
  });

  it("点击引擎按钮弹出 Popover 并显示所有引擎", () => {
    renderSearchForm();

    fireEvent.click(screen.getByText("动漫花园"));

    expect(screen.getByText("萌番组")).toBeInTheDocument();
    expect(screen.getByText("蜜柑计划")).toBeInTheDocument();
    expect(screen.getByText("Nyaa")).toBeInTheDocument();
    expect(screen.getByText("ACG.RIP")).toBeInTheDocument();
    expect(screen.getByText("ANiBT")).toBeInTheDocument();
  });

  it("加载中时引擎按钮应禁用", () => {
    renderSearchForm({ loading: true });

    expect(screen.getByText("动漫花园")).toBeDisabled();
  });

  it("点击已选中的复选框应将其从搜索引擎列表中移除", () => {
    const { form } = renderSearchForm({ defaultEngines: ["dmhy", "nyaa"] });

    fireEvent.click(screen.getByText("已选 2 个引擎"));
    fireEvent.click(screen.getByText("动漫花园"));

    expect(form.getValues("searchEngines")).toEqual(["nyaa"]);
  });

  it("点击未选中的复选框应将其添加到搜索引擎列表", () => {
    const { form } = renderSearchForm({ defaultEngines: ["dmhy"] });

    fireEvent.click(screen.getByText("动漫花园"));
    const labels = screen.getAllByText("Nyaa");
    fireEvent.click(labels[labels.length - 1]);

    expect(form.getValues("searchEngines")).toContain("nyaa");
  });

  it("只剩最后一个引擎时不应允许取消选中", () => {
    const { form } = renderSearchForm({ defaultEngines: ["dmhy"] });

    fireEvent.click(screen.getByText("动漫花园"));
    const labels = screen.getAllByText("动漫花园");
    fireEvent.click(labels[labels.length - 1]);

    expect(form.getValues("searchEngines")).toEqual(["dmhy"]);
  });
});
