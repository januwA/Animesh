import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { AnimeSubject } from "@/domain/anime/AnimeSchemas";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseSubjectInfoDeps } from "@/presentation/hooks/useSubjectInfo";
import { useSubjectInfo } from "@/presentation/hooks/useSubjectInfo";

const makeSubject = (): AnimeSubject => ({
  id: 123,
  name: "测试动漫",
  summary: "简介",
  image: "http://example.com/large.jpg",
  rating: 8.5,
  date: "2026-07-01",
  eps: 12,
  platform: "TV",
});

const makeDeps = (
  overrides: Partial<UseSubjectInfoDeps> = {},
): UseSubjectInfoDeps => ({
  getSubjectUseCase: {
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
      expect(result.current.subject?.name).toBe("测试动漫");
    });
    expect(result.current.displayName).toBe("测试动漫");
    expect(result.current.imageUrl).toBe("http://example.com/large.jpg");
    expect(deps.getSubjectUseCase.execute).toHaveBeenCalledWith(
      expect.anything(),
      NonEmptyStringSchema.parse("123"),
    );
  });

  it("条目加载失败时暴露错误并使用 location.state 回退", async () => {
    const deps = makeDeps({
      getSubjectUseCase: {
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
      expect(result.current.subject).toBeDefined();
    });
    act(() => result.current.handleOpenUrl());
    expect(deps.openUrlUseCase.execute).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("https://bgm.tv/subject/123"),
    );
  });
});
