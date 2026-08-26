import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { UpdateCheckResult } from "@/domain/update/UpdateInfo";
import { UpdateCheckSection } from "./UpdateCheckSection";

const makeResult = (
  overrides: Partial<UpdateCheckResult> = {},
): UpdateCheckResult => ({
  hasUpdate: true,
  latestVersion: "1.0.0",
  currentVersion: "0.3.1",
  notes: "修复了一些已知问题",
  htmlUrl: "https://github.com/animesh/releases/1.0.0",
  ...overrides,
});

const makeProps = (
  overrides: Partial<Parameters<typeof UpdateCheckSection>[0]> = {},
) => ({
  currentVersion: "0.3.1",
  checkingUpdate: false,
  updateResult: null,
  onCheckUpdate: vi.fn(),
  onOpenGithub: vi.fn(),
  ...overrides,
});

describe("UpdateCheckSection 检查更新区块", () => {
  it("应该渲染当前版本与检查更新按钮", () => {
    const onCheckUpdate = vi.fn();
    render(<UpdateCheckSection {...makeProps({ onCheckUpdate })} />);

    expect(screen.getByText("当前版本：0.3.1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "检查更新" }));
    expect(onCheckUpdate).toHaveBeenCalled();
  });

  it("版本为空时应该渲染加载中提示", () => {
    render(<UpdateCheckSection {...makeProps({ currentVersion: "" })} />);

    expect(screen.getByText("当前版本：加载中...")).toBeInTheDocument();
  });

  it("检查更新中时按钮应该被禁用", () => {
    render(<UpdateCheckSection {...makeProps({ checkingUpdate: true })} />);

    expect(screen.getByRole("button", { name: "检查更新" })).toBeDisabled();
  });

  it("发现新版本时应该渲染版本信息与 GitHub 下载按钮", () => {
    const onOpenGithub = vi.fn();
    render(
      <UpdateCheckSection
        {...makeProps({ updateResult: makeResult(), onOpenGithub })}
      />,
    );

    expect(screen.getByText("发现新版本！")).toBeInTheDocument();
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("修复了一些已知问题")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "前往 GitHub 下载" }));
    expect(onOpenGithub).toHaveBeenCalled();
  });

  it("没有新版本时应该渲染最新提示", () => {
    render(
      <UpdateCheckSection
        {...makeProps({ updateResult: makeResult({ hasUpdate: false }) })}
      />,
    );

    expect(screen.getByText("当前已是最新版本")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "前往 GitHub 下载" }),
    ).not.toBeInTheDocument();
  });
});
