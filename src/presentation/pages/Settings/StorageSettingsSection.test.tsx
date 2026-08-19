import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { StorageSettingsSection } from "./StorageSettingsSection";

const makeProps = (
  overrides: Partial<Parameters<typeof StorageSettingsSection>[0]> = {},
) => ({
  downloadDir: "D:\\Downloads",
  isMobile: false,
  maxDownloadSpeed: 1024,
  maxUploadSpeed: 512,
  onDownloadDirChange: vi.fn(),
  onMaxDownloadSpeedChange: vi.fn(),
  onMaxUploadSpeedChange: vi.fn(),
  onSelectDir: vi.fn(),
  ...overrides,
});

describe("StorageSettingsSection 存储设置区块", () => {
  it("应该渲染下载目录与速度限制输入，并显示选择目录按钮", () => {
    render(<StorageSettingsSection {...makeProps()} />);

    expect(screen.getByLabelText("默认下载及播放缓存目录")).toHaveValue(
      "D:\\Downloads",
    );
    expect(screen.getByLabelText("后台下载速度限制")).toHaveValue(1024);
    expect(screen.getByLabelText("后台上传速度限制")).toHaveValue(512);
    expect(
      screen.getByRole("button", { name: "选择目录" }),
    ).toBeInTheDocument();
  });

  it("输入更改时应该触发对应的回调", () => {
    const props = makeProps();
    render(<StorageSettingsSection {...props} />);

    fireEvent.change(screen.getByLabelText("默认下载及播放缓存目录"), {
      target: { value: "D:\\New" },
    });
    fireEvent.change(screen.getByLabelText("后台下载速度限制"), {
      target: { value: "2048" },
    });
    fireEvent.change(screen.getByLabelText("后台上传速度限制"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "选择目录" }));

    expect(props.onDownloadDirChange).toHaveBeenCalledWith("D:\\New");
    expect(props.onMaxDownloadSpeedChange).toHaveBeenCalledWith(2048);
    expect(props.onMaxUploadSpeedChange).toHaveBeenCalledWith(0);
    expect(props.onSelectDir).toHaveBeenCalled();
  });

  it("移动端下应该禁用目录输入并隐藏选择目录按钮", () => {
    render(<StorageSettingsSection {...makeProps({ isMobile: true })} />);

    expect(screen.getByLabelText("默认下载及播放缓存目录")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "选择目录" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "移动端（Android/iOS）已自动选用应用沙盒内部路径，无需且不支持手动更改。",
      ),
    ).toBeInTheDocument();
  });
});
