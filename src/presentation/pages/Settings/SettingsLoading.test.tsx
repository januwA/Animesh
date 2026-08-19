import { render, screen } from "@testing-library/react";
import { SettingsLoading } from "./SettingsLoading";

describe("SettingsLoading 加载指示器组件", () => {
  it("应该渲染加载提示文本", () => {
    render(<SettingsLoading />);

    expect(screen.getByText("正在加载设置面版...")).toBeInTheDocument();
  });
});
