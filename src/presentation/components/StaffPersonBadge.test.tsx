import { render, screen } from "@testing-library/react";
import { StaffPersonBadge } from "@/presentation/components/StaffPersonBadge";
import type { ConsolidatedStaffMember } from "@/presentation/hooks/useSubjectCast";

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

describe("StaffPersonBadge 制作人员徽章组件", () => {
  it("应该渲染人名", () => {
    render(<StaffPersonBadge person={makePerson()} />);

    expect(screen.getByText("木村拓")).toBeInTheDocument();
  });

  it("当 eps 不为空时，应该显示集数信息", () => {
    render(<StaffPersonBadge person={makePerson({ eps: "1-3" })} />);

    expect(screen.getByText("木村拓")).toBeInTheDocument();
    expect(screen.getByText("(1-3)")).toBeInTheDocument();
  });

  it("当 eps 为空时，不应该显示集数信息", () => {
    render(<StaffPersonBadge person={makePerson({ eps: "" })} />);

    expect(screen.getByText("木村拓")).toBeInTheDocument();
    expect(screen.queryByText("(")).not.toBeInTheDocument();
  });
});
