import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { SubjectNavigationHeader } from "./SubjectNavigationHeader";

// FavoriteButton 使用 useFavorite hook 内部发起异步请求，这里 mock 掉避免副作用
vi.mock("@/presentation/components/FavoriteButton", () => ({
  FavoriteButton: () => <button type="button">收藏</button>,
}));

const makeSubject = (
  overrides: Partial<BangumiSubject> = {},
): BangumiSubject => ({
  id: 123,
  name: "Test Anime Title",
  name_cn: "测试动漫标题",
  summary: "",
  images: {
    large: "http://example.com/large.jpg",
    common: "",
    medium: "",
    small: "",
    grid: "",
  },
  rating: { score: 8.5, rank: 42, total: 1000 },
  collection: { wish: 0, collect: 0, doing: 0, on_hold: 0, dropped: 0 },
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
  ...overrides,
});

const defaultDeps = () => ({
  getFavoriteStatusUseCase: { execute: vi.fn() },
  addFavoriteUseCase: { execute: vi.fn() },
  removeFavoriteUseCase: { execute: vi.fn() },
});

const renderHeader = (props: Parameters<typeof SubjectNavigationHeader>[0]) => {
  return render(<SubjectNavigationHeader {...props} />, {
    wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
  });
};

describe("SubjectNavigationHeader 导航头组件", () => {
  it("当 subject 存在时，应该渲染返回按钮和详情链接", () => {
    renderHeader({
      subject: makeSubject(),
      displayName: "测试动漫标题",
      onBack: vi.fn(),
      onOpenUrl: vi.fn(),
      ...defaultDeps(),
    });

    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "详情" })).toBeInTheDocument();
  });

  it("点击返回按钮时，应该调用 onBack", () => {
    const onBack = vi.fn();
    renderHeader({
      subject: makeSubject(),
      displayName: "测试动漫标题",
      onBack,
      onOpenUrl: vi.fn(),
      ...defaultDeps(),
    });

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("点击详情链接时，应该阻止默认行为并调用 onOpenUrl", () => {
    const onOpenUrl = vi.fn();
    renderHeader({
      subject: makeSubject(),
      displayName: "测试动漫标题",
      onBack: vi.fn(),
      onOpenUrl,
      ...defaultDeps(),
    });

    fireEvent.click(screen.getByRole("link", { name: "详情" }));

    expect(onOpenUrl).toHaveBeenCalledOnce();
  });

  it("当 subject 为 undefined 时，不应该渲染详情链接和收藏按钮", () => {
    renderHeader({
      subject: undefined,
      displayName: "加载中...",
      onBack: vi.fn(),
      onOpenUrl: vi.fn(),
      ...defaultDeps(),
    });

    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "详情" }),
    ).not.toBeInTheDocument();
  });
});
