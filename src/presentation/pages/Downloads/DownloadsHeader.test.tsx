import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadsHeader } from "./DownloadsHeader";

describe("DownloadsHeader 下载管理页头部组件", () => {
  it("应该渲染标题、描述与全部任务数量", () => {
    render(<DownloadsHeader total={3} />);

    expect(screen.getByText("下载管理")).toBeInTheDocument();
    expect(
      screen.getByText(/管理所有在后台进行的种子下载与边下边播任务/),
    ).toBeInTheDocument();
    expect(screen.getByText("全部任务: 3")).toBeInTheDocument();
  });
});
