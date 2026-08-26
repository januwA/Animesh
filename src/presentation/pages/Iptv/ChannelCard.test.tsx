import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IptvChannel } from "@/domain/iptv/IptvSchemas";
import { ChannelCard } from "./ChannelCard";

const makeChannel = (overrides: Partial<IptvChannel> = {}): IptvChannel =>
  ({
    tvgId: "cctv1",
    name: "CCTV-1",
    logo: "http://example.com/cctv1.png",
    category: "新闻",
    url: "http://example.com/cctv1.m3u8",
    ...overrides,
  }) as IptvChannel;

describe("ChannelCard 频道卡片组件", () => {
  it("应该渲染频道名称和分类", () => {
    const channel = makeChannel();
    render(<ChannelCard channel={channel} onClick={vi.fn()} />);

    expect(screen.getByText("CCTV-1")).toBeInTheDocument();
    expect(screen.getByText("新闻")).toBeInTheDocument();
  });

  it("有 logo 时应该渲染 LazyImage 容器", () => {
    const channel = makeChannel();
    const { container } = render(
      <ChannelCard channel={channel} onClick={vi.fn()} />,
    );

    const imgContainer = container.querySelector(".relative.w-full.h-full");
    expect(imgContainer).toBeInTheDocument();
  });

  it("没有 logo 时应该显示占位图标", () => {
    const channel = makeChannel({ logo: null });
    const { container } = render(
      <ChannelCard channel={channel} onClick={vi.fn()} />,
    );

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("没有分类时不应该渲染分类标签", () => {
    const channel = makeChannel({ category: null });
    render(<ChannelCard channel={channel} onClick={vi.fn()} />);

    expect(screen.queryByText("新闻")).not.toBeInTheDocument();
  });

  it("点击卡片时应该调用 onClick", () => {
    const onClick = vi.fn();
    const channel = makeChannel();
    render(<ChannelCard channel={channel} onClick={onClick} />);

    fireEvent.click(screen.getByTitle("播放: CCTV-1"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
