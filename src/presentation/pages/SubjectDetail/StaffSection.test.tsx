import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { StaffSection } from "./StaffSection";
import type { ConsolidatedStaffMember } from "./useSubjectDetail";

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

describe("StaffSection 制作人员区域组件", () => {
  it("当有制作人员数据时，应该按角色分组渲染", () => {
    const staffMap = makeStaffMap([
      ["导演", [makePerson()]],
      [
        "脚本",
        [makePerson({ id: 2639, name: "あおしまたかし", relations: ["脚本"] })],
      ],
    ]);
    render(
      <StaffSection
        staffGroupedByRole={staffMap}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("木村拓")).toBeInTheDocument();
    expect(screen.getByText("あおしまたかし")).toBeInTheDocument();
    expect(screen.getByText("导演")).toBeInTheDocument();
    expect(screen.getByText("脚本")).toBeInTheDocument();
  });

  it("当制作人员数据为空时，应该显示空状态提示", () => {
    render(
      <StaffSection
        staffGroupedByRole={new Map()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("暂无制作人员数据")).toBeInTheDocument();
  });

  it("当处于加载状态时，应该显示骨架屏", () => {
    render(
      <StaffSection
        staffGroupedByRole={new Map()}
        loading={true}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByTestId("staff-skeleton")).toBeInTheDocument();
  });

  it("当有错误时，应该显示错误状态组件", () => {
    render(
      <StaffSection
        staffGroupedByRole={new Map()}
        loading={false}
        error={new Error("Persons API Error")}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("获取制作人员数据失败")).toBeInTheDocument();
    expect(screen.getByText("Persons API Error")).toBeInTheDocument();
  });

  it("当有错误时，点击重试应该调用 onRetry", () => {
    const onRetry = vi.fn();
    render(
      <StaffSection
        staffGroupedByRole={new Map()}
        loading={false}
        error={new Error("Persons API Error")}
        onRetry={onRetry}
      />,
    );

    screen.getByRole("button", { name: "重试" }).click();

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
