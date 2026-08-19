import { render, screen } from "@testing-library/react";
import { SettingsActionHeader } from "./SettingsActionHeader";

describe("SettingsActionHeader 保存栏组件", () => {
  it("应该渲染标题与保存按钮", () => {
    render(<SettingsActionHeader saving={false} />);

    expect(screen.getByText("软件设置")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "保存设置" }),
    ).toBeInTheDocument();
  });

  it("保存中时保存按钮应该被禁用", () => {
    render(<SettingsActionHeader saving={true} />);

    expect(screen.getByRole("button", { name: "保存设置" })).toBeDisabled();
  });
});
