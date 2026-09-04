import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import type { AnimePerson } from "@/domain/anime/AnimeSchemas";
import type { UseSubjectStaffDeps } from "@/presentation/pages/SubjectDetail/useSubjectCast";
import {
  consolidateStaff,
  useSubjectStaff,
} from "@/presentation/pages/SubjectDetail/useSubjectCast";

const makePerson = (overrides: Partial<AnimePerson> = {}): AnimePerson => ({
  image: "",
  name: "木村拓",
  relation: "导演",
  id: 44615,
  eps: "",
  ...overrides,
});

const makeDeps = (
  overrides: Partial<UseSubjectStaffDeps> = {},
): UseSubjectStaffDeps => ({
  getAnimePersonsUseCase: { execute: vi.fn().mockResolvedValue([]) },
  ...overrides,
});

const renderCast = (deps: UseSubjectStaffDeps) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/subject/123"]}>{children}</MemoryRouter>
  );
  return renderHook(() => useSubjectStaff({ subjectId: 123 }, deps), {
    wrapper,
  });
};

describe("useSubjectCast 角色与制作人员 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应该加载制作人员并派生分组数据", async () => {
    const deps = makeDeps({
      getAnimePersonsUseCase: {
        execute: vi
          .fn()
          .mockResolvedValue([
            makePerson(),
            makePerson(),
            makePerson({ relation: "脚本", eps: "1-3" }),
          ]),
      },
    });
    const { result } = renderCast(deps);

    await waitFor(() => {
      expect(result.current.persons).toHaveLength(3);
    });
    expect(result.current.consolidatedStaff).toHaveLength(1);
    expect(result.current.consolidatedStaff[0].relations).toEqual([
      "导演",
      "脚本",
    ]);
    expect(result.current.staffGroupedByRole.get("导演")).toHaveLength(1);
    expect(result.current.staffGroupedByRole.get("脚本")).toHaveLength(1);
  });

  it("没有数据时分组为空", async () => {
    const { result } = renderCast(makeDeps());
    await waitFor(() => {
      expect(result.current.persons).toHaveLength(0);
    });
    expect(result.current.consolidatedStaff).toHaveLength(0);
  });
});

describe("consolidateStaff 制作人员去重", () => {
  it("同一个人相同角色出现多次时应去重，不同角色应合并", () => {
    const staff = consolidateStaff([
      makePerson(),
      makePerson(),
      makePerson({ relation: "脚本", eps: "1-3" }),
    ]);
    expect(staff).toHaveLength(1);
    expect(staff[0].relations).toEqual(["导演", "脚本"]);
    expect(staff[0].eps).toBe("");
  });

  it("图片为空时 image 字段应为空字符串", () => {
    const staff = consolidateStaff([makePerson()]);
    expect(staff[0].image).toBe("");
  });

  it("优先选择 large 图片", () => {
    const staff = consolidateStaff([
      makePerson({
        image: "large",
      }),
    ]);
    expect(staff[0].image).toBe("large");
  });
});
