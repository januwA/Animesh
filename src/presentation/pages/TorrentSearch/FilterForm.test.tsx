import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { FilterForm } from "./FilterForm";

function renderFilterForm(onFilterChange = vi.fn()) {
  return {
    ...render(<FilterForm onFilterChange={onFilterChange} />),
    onFilterChange,
  };
}

describe("FilterForm 筛选表单组件", () => {
  it("应该渲染筛选触发按钮", () => {
    renderFilterForm();
    expect(screen.getByTestId("filter-trigger")).toBeInTheDocument();
    expect(screen.getByText("筛选")).toBeInTheDocument();
  });

  it("点击展开后应显示发布日期选择器", () => {
    renderFilterForm();
    fireEvent.click(screen.getByTestId("filter-trigger"));

    expect(screen.getByTestId("pub-date-select")).toBeInTheDocument();
  });

  it("展开后应显示所有发布日期选项", () => {
    renderFilterForm();
    fireEvent.click(screen.getByTestId("filter-trigger"));

    expect(screen.getByRole("option", { name: "全部" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "24小时内" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "一周内" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "一个月内" }),
    ).toBeInTheDocument();
  });

  it("切换发布日期时应触发 onFilterChange", () => {
    const onFilterChange = vi.fn();
    renderFilterForm(onFilterChange);
    fireEvent.click(screen.getByTestId("filter-trigger"));

    fireEvent.change(screen.getByTestId("pub-date-select"), {
      target: { value: "week" },
    });

    const lastCall = onFilterChange.mock.lastCall;
    expect(lastCall).toBeDefined();
    expect(lastCall![0]).toEqual({ pubDatePreset: "week" });
  });

  it("点击重置按钮应恢复发布日期为全部", () => {
    const onFilterChange = vi.fn();
    renderFilterForm(onFilterChange);
    fireEvent.click(screen.getByTestId("filter-trigger"));

    fireEvent.change(screen.getByTestId("pub-date-select"), {
      target: { value: "week" },
    });
    fireEvent.click(screen.getByTestId("filter-reset"));

    expect(screen.getByTestId("pub-date-select")).toHaveValue("all");
  });
});
