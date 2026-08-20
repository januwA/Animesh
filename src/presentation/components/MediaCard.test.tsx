import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaCard } from "./MediaCard";

const defaultProps = {
  id: 101,
  imageSrc: "http://example.com/cover.jpg",
  title: "测试动画",
  onClick: vi.fn(),
};

describe("MediaCard 媒体卡片组件", () => {
  it("应该渲染标题", () => {
    render(<MediaCard {...defaultProps} />);

    expect(screen.getByText("测试动画")).toBeInTheDocument();
  });

  it("传入 rating 时应该渲染评分", () => {
    render(<MediaCard {...defaultProps} rating={8.5} />);

    expect(screen.getByText("8.5")).toBeInTheDocument();
  });

  it("未传入 rating 时不应该渲染评分", () => {
    render(<MediaCard {...defaultProps} />);

    expect(screen.queryByText(/^\d+\.\d$/)).not.toBeInTheDocument();
  });

  it("有封面时应该渲染 LazyImage 容器", () => {
    const { container } = render(<MediaCard {...defaultProps} />);

    const imgContainer = container.querySelector(".relative.w-full.h-full");
    expect(imgContainer).toBeInTheDocument();
  });

  it("没有封面时应该显示占位图标", () => {
    const { container } = render(
      <MediaCard {...defaultProps} imageSrc={null} />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("点击卡片时应该调用 onClick", () => {
    const onClick = vi.fn();
    render(<MediaCard {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByTitle("详情: 测试动画"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
