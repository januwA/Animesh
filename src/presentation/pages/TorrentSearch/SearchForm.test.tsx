import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SearchForm } from "./SearchForm";

describe("SearchForm 搜索表单组件", () => {
  it("应该渲染关键词输入框与搜索按钮", () => {
    render(
      <SearchForm
        keyword="xxx"
        setKeyword={vi.fn()}
        loading={false}
        onSubmit={vi.fn()}
        searchEngine="dmhy"
        setSearchEngine={vi.fn()}
      />,
    );

    expect(screen.getByTestId("search-input")).toHaveValue("xxx");
    expect(screen.getByPlaceholderText("输入动漫名称")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "搜索" })).toBeInTheDocument();
  });

  it("输入关键词时应该调用 setKeyword", () => {
    const setKeyword = vi.fn();
    render(
      <SearchForm
        keyword=""
        setKeyword={setKeyword}
        loading={false}
        onSubmit={vi.fn()}
        searchEngine="dmhy"
        setSearchEngine={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId("search-input"), {
      target: { value: "柯南" },
    });

    expect(setKeyword).toHaveBeenCalledWith("柯南");
  });

  it("提交表单时应该调用 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <SearchForm
        keyword="xxx"
        setKeyword={vi.fn()}
        loading={false}
        onSubmit={onSubmit}
        searchEngine="dmhy"
        setSearchEngine={vi.fn()}
      />,
    );

    fireEvent.submit(screen.getByTestId("search-input").closest("form")!);

    expect(onSubmit).toHaveBeenCalled();
  });

  it("应该渲染所有搜索引擎选项并支持切换", () => {
    const setSearchEngine = vi.fn();
    render(
      <SearchForm
        keyword="xxx"
        setKeyword={vi.fn()}
        loading={false}
        onSubmit={vi.fn()}
        searchEngine="dmhy"
        setSearchEngine={setSearchEngine}
      />,
    );

    const select = screen.getByDisplayValue("动漫花园");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "萌番组" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "蜜柑计划" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nyaa" })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: "mikan" } });

    expect(setSearchEngine).toHaveBeenCalledWith("mikan");
  });

  it("关键词为空时搜索按钮应禁用", () => {
    render(
      <SearchForm
        keyword="   "
        setKeyword={vi.fn()}
        loading={false}
        onSubmit={vi.fn()}
        searchEngine="dmhy"
        setSearchEngine={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "搜索" })).toBeDisabled();
  });

  it("加载中时输入框与按钮应禁用并显示搜索中状态", () => {
    render(
      <SearchForm
        keyword="xxx"
        setKeyword={vi.fn()}
        loading={true}
        onSubmit={vi.fn()}
        searchEngine="dmhy"
        setSearchEngine={vi.fn()}
      />,
    );

    expect(screen.getByTestId("search-input")).toBeDisabled();
    expect(screen.getByText("搜索中...")).toBeInTheDocument();
  });
});
