import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubmitEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { SubjectSearchForm } from "./SubjectSearchForm";

describe("SubjectSearchForm 动漫搜索表单", () => {
  it("输入关键词后可提交并携带当前关键词", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: SubmitEvent) => e.preventDefault());
    render(
      <SubjectSearchForm
        keyword="柯南"
        setKeyword={() => {}}
        loading={false}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByTestId("subject-search-input");
    expect(input).toHaveValue("柯南");

    await user.click(screen.getByRole("button", { name: "搜索" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("关键词为空时提交按钮禁用", () => {
    render(
      <SubjectSearchForm
        keyword="   "
        setKeyword={() => {}}
        loading={false}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "搜索" })).toBeDisabled();
  });

  it("loading 时输入框与按钮禁用并显示搜索中", () => {
    render(
      <SubjectSearchForm
        keyword="柯南"
        setKeyword={() => {}}
        loading={true}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByTestId("subject-search-input")).toBeDisabled();
    expect(screen.getByRole("button", { name: /搜索中/ })).toBeDisabled();
  });

  it("输入变化会调用 setKeyword", async () => {
    const user = userEvent.setup();
    const setKeyword = vi.fn();
    render(
      <SubjectSearchForm
        keyword=""
        setKeyword={setKeyword}
        loading={false}
        onSubmit={() => {}}
      />,
    );

    await user.type(screen.getByTestId("subject-search-input"), "新");

    expect(setKeyword).toHaveBeenCalled();
  });
});
