import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubjectSearchLoading } from "./SubjectSearchLoading";

describe("SubjectSearchLoading 搜索加载占位", () => {
  it("渲染骨架屏与加载提示", () => {
    render(<SubjectSearchLoading />);
    expect(screen.getByTestId("subject-search-loading")).toBeInTheDocument();
    expect(screen.getByText("正在搜索条目...")).toBeInTheDocument();
  });
});
