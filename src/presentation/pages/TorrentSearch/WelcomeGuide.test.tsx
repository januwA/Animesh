import { render, screen } from "@testing-library/react";
import { WelcomeGuide } from "./WelcomeGuide";

describe("WelcomeGuide 欢迎指南组件", () => {
  it("应该渲染三大功能引导卡片", () => {
    render(<WelcomeGuide />);

    expect(screen.getByText("聚合搜索")).toBeInTheDocument();
    expect(screen.getByText("边下边播")).toBeInTheDocument();
    expect(screen.getByText("外部播放")).toBeInTheDocument();
  });

  it("应该渲染各功能的说明文案", () => {
    render(<WelcomeGuide />);

    expect(screen.getByText(/一键检索动漫花园资源列表/)).toBeInTheDocument();
    expect(
      screen.getByText(/内置高性能 BT 流媒体播放引擎/),
    ).toBeInTheDocument();
    expect(screen.getByText(/一键拷贝本地视频流 URL/)).toBeInTheDocument();
  });
});
