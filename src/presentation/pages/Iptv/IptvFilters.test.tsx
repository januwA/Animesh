import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IptvFilters } from "./IptvFilters";

const defaultProps = {
  countries: [
    { name: "中国", code: "CN", flag: "🇨🇳" },
    { name: "日本", code: "JP", flag: "🇯🇵" },
  ],
  selectedCountry: "CN",
  categories: ["新闻", "电影"],
  selectedCategory: "all",
  keyword: "",
  onCountryChange: vi.fn(),
  onCategoryChange: vi.fn(),
  onKeywordChange: vi.fn(),
};

describe("IptvFilters IPTV 筛选组件", () => {
  it("应该渲染国家下拉、搜索框和分类标签", () => {
    render(<IptvFilters {...defaultProps} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索频道...")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "全部" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "新闻" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "电影" })).toBeInTheDocument();
  });

  it("切换国家时应该调用 onCountryChange", () => {
    render(<IptvFilters {...defaultProps} />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "JP" },
    });

    expect(defaultProps.onCountryChange).toHaveBeenCalledWith("JP");
  });

  it("输入关键词时应该调用 onKeywordChange", () => {
    render(<IptvFilters {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText("搜索频道..."), {
      target: { value: "test" },
    });

    expect(defaultProps.onKeywordChange).toHaveBeenCalledWith("test");
  });

  it("点击分类标签时应该调用 onCategoryChange", () => {
    render(<IptvFilters {...defaultProps} />);

    fireEvent.click(screen.getByRole("radio", { name: "新闻" }));

    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("新闻");
  });
});
