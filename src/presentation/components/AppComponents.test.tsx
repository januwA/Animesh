import { render, screen } from "@testing-library/react";
import { ErrorBanner, PageLoader } from "./AppComponents";

describe("AppComponents 组件", () => {
  it("PageLoader 应该在加载时显示加载提示", async () => {
    render(<PageLoader />);
    expect(await screen.findByText("正在载入页面...")).toBeInTheDocument();
  });

  it("ErrorBanner 应该显示错误标题和消息", async () => {
    render(<ErrorBanner message="网络连接失败，请检查网络设置" />);

    expect(await screen.findByText("搜索失败")).toBeInTheDocument();
    expect(
      screen.getByText("网络连接失败，请检查网络设置"),
    ).toBeInTheDocument();
  });
});
