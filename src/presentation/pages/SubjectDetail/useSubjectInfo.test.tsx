import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { BangumiSubject } from "@/domain/bangumi/BangumiSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseSubjectInfoDeps } from "./useSubjectInfo";
import { useSubjectInfo } from "./useSubjectInfo";

const makeSubject = (): BangumiSubject => ({
  id: 123,
  name: "Test Anime",
  name_cn: "测试动漫",
  summary: "简介",
  images: {
    large: "http://example.com/large.jpg",
    common: "",
    medium: "",
    small: "",
    grid: "",
  },
  rating: { score: 8.5, rank: 42, total: 100 },
  collection: { doing: 200 },
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
});

const makeDeps = (
  overrides: Partial<UseSubjectInfoDeps> = {},
): UseSubjectInfoDeps => ({
  getBangumiSubjectUseCase: {
    execute: vi.fn().mockResolvedValue(makeSubject()),
  },
  openUrlUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
  ...overrides,
});

const renderInfo = (
  deps: UseSubjectInfoDeps,
  state?: { name?: string; imageUrl?: string },
) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter
      initialEntries={[
        {
          pathname: "/subject/123",
          ...(state ? { state } : {}),
        },
      ]}
    >
      {children}
    </MemoryRouter>
  );
  return renderHook(() => useSubjectInfo({ subjectId: 123 }, deps), {
    wrapper,
  });
};

describe("useSubjectInfo 条目信息 hook", () => {
  it("应该加载条目并派生展示信息", async () => {
    const deps = makeDeps();
    const { result } = renderInfo(deps);

    await waitFor(() => {
      expect(result.current.subject?.name_cn).toBe("测试动漫");
    });
    expect(result.current.displayName).toBe("测试动漫");
    expect(result.current.originalName).toBe("Test Anime");
    expect(result.current.imageUrl).toBe("http://example.com/large.jpg");
    expect(deps.getBangumiSubjectUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      NonEmptyStringSchema.parse("123"),
    );
  });

  it("无中文名时 displayName 回退到原名且不显示 originalName", async () => {
    const deps = makeDeps({
      getBangumiSubjectUseCase: {
        execute: vi.fn().mockResolvedValue({ ...makeSubject(), name_cn: "" }),
      },
    });
    const { result } = renderInfo(deps);

    await waitFor(() => {
      expect(result.current.displayName).toBe("Test Anime");
    });
    expect(result.current.subject?.name_cn).toBe("");
    expect(result.current.originalName).toBe("");
  });

  it("条目加载失败时暴露错误并使用 location.state 回退", async () => {
    const deps = makeDeps({
      getBangumiSubjectUseCase: {
        execute: vi.fn().mockRejectedValue(new Error("Subject API Error")),
      },
    });
    const { result } = renderInfo(deps, {
      name: "回退名称",
      imageUrl: "http://example.com/fallback.jpg",
    });

    await waitFor(() => {
      expect(result.current.subjectQuery.error).not.toBeNull();
    });
    expect(result.current.displayName).toBe("回退名称");
    expect(result.current.imageUrl).toBe("http://example.com/fallback.jpg");
  });

  it("打开详情链接时调用 openUrlUseCase", async () => {
    const deps = makeDeps();
    const { result } = renderInfo(deps);

    await waitFor(() => {
      expect(result.current.subject).not.toBeNull();
    });
    act(() => result.current.handleOpenUrl());
    expect(deps.openUrlUseCase.execute).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("https://bgm.tv/subject/123"),
    );
  });
});
