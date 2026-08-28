import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { type DIContainer, DIContext } from "@/di/DIContext";
import StoragePage from "./StoragePage";

function makeDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    getDownloadDirUseCase: {
      execute: vi.fn().mockResolvedValue({ downloadDir: "/downloads" }),
    },
    setDownloadDirUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    getSpeedLimitsUseCase: {
      execute: vi.fn().mockResolvedValue({
        maxDownloadSpeed: 0,
        maxUploadSpeed: 0,
      }),
    },
    setSpeedLimitsUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    selectDirectoryUseCase: { execute: vi.fn().mockResolvedValue(null) },
    ...overrides,
  } as unknown as DIContainer;
}

function renderPage(di?: Partial<DIContainer>) {
  return render(
    <DIContext value={makeDI(di)}>
      <StoragePage />
    </DIContext>,
  );
}

describe("StoragePage 存储设置页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TAURI_ENV_PLATFORM", "");
  });

  it("加载中应显示加载提示", () => {
    renderPage({
      getDownloadDirUseCase: {
        execute: vi.fn().mockImplementation(() => new Promise(() => {})),
      },
    } as unknown as DIContainer);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("加载完成后应显示下载目录输入框", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("默认下载及播放缓存目录")).toHaveValue(
        "/downloads",
      );
    });
  });

  it("应显示速度限制输入框", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("后台下载速度限制")).toBeInTheDocument();
      expect(screen.getByLabelText("后台上传速度限制")).toBeInTheDocument();
    });
  });

  it("应显示选择目录按钮", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "选择目录" }),
      ).toBeInTheDocument();
    });
  });

  it("修改下载目录后保存按钮应启用", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("默认下载及播放缓存目录")).toHaveValue(
        "/downloads",
      );
    });

    await user.clear(screen.getByLabelText("默认下载及播放缓存目录"));
    await user.type(
      screen.getByLabelText("默认下载及播放缓存目录"),
      "/new-path",
    );

    expect(screen.getByRole("button", { name: "保存" })).not.toBeDisabled();
  });

  it("点击选择目录按钮应调用 selectDirectoryUseCase", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue("/selected/dir");
    renderPage({
      selectDirectoryUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "选择目录" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "选择目录" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalled();
      expect(screen.getByLabelText("默认下载及播放缓存目录")).toHaveValue(
        "/selected/dir",
      );
    });
  });

  it("selectDirectory 返回 null 时不应更新输入框", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(null);
    renderPage({
      selectDirectoryUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "选择目录" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "选择目录" }));

    await waitFor(() => {
      expect(screen.getByLabelText("默认下载及播放缓存目录")).toHaveValue(
        "/downloads",
      );
    });
  });

  it("提交表单应调用 setDownloadDirUseCase 和 setSpeedLimitsUseCase", async () => {
    const user = userEvent.setup();
    const setDirExecute = vi.fn().mockResolvedValue(undefined);
    const setSpeedExecute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      setDownloadDirUseCase: { execute: setDirExecute },
      setSpeedLimitsUseCase: { execute: setSpeedExecute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("默认下载及播放缓存目录")).toHaveValue(
        "/downloads",
      );
    });

    await user.clear(screen.getByLabelText("默认下载及播放缓存目录"));
    await user.type(
      screen.getByLabelText("默认下载及播放缓存目录"),
      "/new-dir",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(setDirExecute).toHaveBeenCalledWith("/new-dir");
      expect(setSpeedExecute).toHaveBeenCalledWith(0, 0);
    });
  });

  it("修改下载速度后提交应传正确的速度值", async () => {
    const user = userEvent.setup();
    const setSpeedExecute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      setSpeedLimitsUseCase: { execute: setSpeedExecute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("后台下载速度限制")).toHaveValue(0);
    });

    await user.clear(screen.getByLabelText("后台下载速度限制"));
    await user.type(screen.getByLabelText("后台下载速度限制"), "1024");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(setSpeedExecute).toHaveBeenCalledWith(1024, 0);
    });
  });

  it("修改上传速度后提交应传正确的速度值", async () => {
    const user = userEvent.setup();
    const setSpeedExecute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      setSpeedLimitsUseCase: { execute: setSpeedExecute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("后台上传速度限制")).toHaveValue(0);
    });

    await user.clear(screen.getByLabelText("后台上传速度限制"));
    await user.type(screen.getByLabelText("后台上传速度限制"), "512");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(setSpeedExecute).toHaveBeenCalledWith(0, 512);
    });
  });

  it("保存失败时应显示错误提示", async () => {
    const user = userEvent.setup();
    const setDirExecute = vi.fn().mockRejectedValue(new Error("保存出错"));
    renderPage({
      setDownloadDirUseCase: { execute: setDirExecute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("默认下载及播放缓存目录")).toHaveValue(
        "/downloads",
      );
    });

    await user.clear(screen.getByLabelText("默认下载及播放缓存目录"));
    await user.type(screen.getByLabelText("默认下载及播放缓存目录"), "/new");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("保存失败: 保存出错");
    });
  });

  it("移动端模式下应显示移动端提示并禁用目录选择", async () => {
    vi.stubEnv("TAURI_ENV_PLATFORM", "android");
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(
          "移动端已自动选用应用沙盒内部路径，无需且不支持手动更改。",
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "选择目录" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("默认下载及播放缓存目录")).toBeDisabled();
  });

  it("非移动端模式下应显示桌面提示并启用目录选择", async () => {
    vi.stubEnv("TAURI_ENV_PLATFORM", "");
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/提示：边下边播的缓存与下载的完整文件/),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "选择目录" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("默认下载及播放缓存目录")).not.toBeDisabled();
  });
});
