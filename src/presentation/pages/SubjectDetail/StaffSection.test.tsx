import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { StaffSection } from "./StaffSection";
import type {
  ConsolidatedStaffMember,
  SubjectStaffResult,
  UseSubjectStaffDeps,
} from "./useSubjectCast";
import { useSubjectStaff } from "./useSubjectCast";

vi.mock(import("./useSubjectCast"), () => ({
  useSubjectStaff: vi.fn(),
}));

const mockedUseSubjectCast = vi.mocked(useSubjectStaff);

const makePerson = (
  overrides: Partial<ConsolidatedStaffMember> = {},
): ConsolidatedStaffMember => ({
  id: 44615,
  name: "木村拓",
  image: "",
  relations: ["导演"],
  eps: "",
  ...overrides,
});

const makeStaffMap = (
  entries: [string, ConsolidatedStaffMember[]][],
): Map<string, ConsolidatedStaffMember[]> => new Map(entries);

const makeDeps = (): UseSubjectStaffDeps => ({
  getAnimePersonsUseCase: { execute: vi.fn() },
});

const makeCast = (
  staffGroupedByRole: Map<string, ConsolidatedStaffMember[]> = new Map(),
  overrides: Partial<SubjectStaffResult> = {},
): SubjectStaffResult => ({
  personsQuery: {
    data: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  },
  persons: [],
  consolidatedStaff: [],
  staffGroupedByRole,
  ...overrides,
});

const renderSection = (cast: SubjectStaffResult) => {
  mockedUseSubjectCast.mockReturnValue(cast);
  return render(<StaffSection subjectId={123} deps={makeDeps()} />);
};

describe("StaffSection 制作人员区域组件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("当有制作人员数据时，应该按角色分组渲染", () => {
    const staffMap = makeStaffMap([
      ["导演", [makePerson()]],
      [
        "脚本",
        [makePerson({ id: 2639, name: "あおしまたかし", relations: ["脚本"] })],
      ],
    ]);
    renderSection(makeCast(staffMap));

    expect(screen.getByText("木村拓")).toBeInTheDocument();
    expect(screen.getByText("あおしまたかし")).toBeInTheDocument();
    expect(screen.getByText("导演")).toBeInTheDocument();
    expect(screen.getByText("脚本")).toBeInTheDocument();
  });

  it("当制作人员数据为空时，应该显示空状态提示", () => {
    renderSection(makeCast());

    expect(screen.getByText("暂无制作人员数据")).toBeInTheDocument();
  });

  it("当处于加载状态时，应该显示骨架屏", () => {
    renderSection(
      makeCast(new Map(), {
        personsQuery: {
          data: null,
          loading: true,
          error: null,
          refetch: vi.fn(),
        },
      }),
    );

    expect(screen.getByTestId("staff-skeleton")).toBeInTheDocument();
  });

  it("当有错误时，应该显示错误状态组件", () => {
    renderSection(
      makeCast(new Map(), {
        personsQuery: {
          data: null,
          loading: false,
          error: new Error("Persons API Error"),
          refetch: vi.fn(),
        },
      }),
    );

    expect(screen.getByText("获取制作人员数据失败")).toBeInTheDocument();
    expect(screen.getByText("Persons API Error")).toBeInTheDocument();
  });

  it("当有错误时，点击重试应该调用 refetch", () => {
    const refetch = vi.fn();
    renderSection(
      makeCast(new Map(), {
        personsQuery: {
          data: null,
          loading: false,
          error: new Error("Persons API Error"),
          refetch,
        },
      }),
    );

    screen.getByRole("button", { name: "重试" }).click();

    expect(refetch).toHaveBeenCalledOnce();
  });
});
