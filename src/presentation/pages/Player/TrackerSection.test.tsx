import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrackerSection } from "./TrackerSection";

describe("TrackerSection Tracker 列表组件", () => {
  it("应该渲染标题与 Tracker 数量徽标", () => {
    render(<TrackerSection trackers={["t1.example.com", "t2.example.com"]} />);

    expect(screen.getByText("Tracker 服务器")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("展开后应该显示所有 Tracker 地址", () => {
    render(<TrackerSection trackers={["t1.example.com", "t2.example.com"]} />);

    const trigger = screen.getByText("Tracker 服务器").closest("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);

    expect(screen.getByText("t1.example.com")).toBeInTheDocument();
    expect(screen.getByText("t2.example.com")).toBeInTheDocument();
  });

  it("没有 Tracker 时不应该渲染徽标并提示暂无信息", () => {
    render(<TrackerSection trackers={[]} />);

    const trigger = screen.getByText("Tracker 服务器").closest("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);

    expect(screen.getByText("暂无 Tracker 信息")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
