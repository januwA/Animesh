import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type DIContainer, DIContext } from "@/di/DIContext";
import AboutPage from "./AboutPage";
import {
  SettingsLoaderContext,
  type SettingsLoaderContextType,
} from "./SettingsContext";

function makeDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    checkUpdateUseCase: {
      execute: vi.fn().mockResolvedValue({
        hasUpdate: false,
        latestVersion: "",
        htmlUrl: "",
        notes: "",
      }),
    },
    openUpdateUrlUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  } as unknown as DIContainer;
}

function makeContext(
  overrides?: Partial<SettingsLoaderContextType>,
): SettingsLoaderContextType {
  return {
    isTauri: true,
    isMobile: false,
    loading: false,
    currentVersion: "1.2.3",
    ...overrides,
  };
}

function renderPage(
  di?: Partial<DIContainer>,
  ctx?: Partial<SettingsLoaderContextType>,
) {
  return render(
    <DIContext value={makeDI(di)}>
      <SettingsLoaderContext value={makeContext(ctx)}>
        <AboutPage />
      </SettingsLoaderContext>
    </DIContext>,
  );
}

describe("AboutPage 关于页面", () => {
  it("应显示当前版本号", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("当前版本：1.2.3")).toBeInTheDocument();
    });
  });

  it("版本为空时应显示加载中", async () => {
    renderPage({}, { currentVersion: "" });
    await waitFor(() => {
      expect(screen.getByText("当前版本：加载中...")).toBeInTheDocument();
    });
  });

  it("点击检查更新按钮应调用 checkUpdateUseCase", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue({
      hasUpdate: false,
      latestVersion: "",
      htmlUrl: "",
      notes: "",
    });
    renderPage({ checkUpdateUseCase: { execute } } as unknown as DIContainer);

    await user.click(screen.getByRole("button", { name: "检查更新" }));

    expect(execute).toHaveBeenCalled();
  });

  it("发现新版本时应显示更新信息与 GitHub 下载按钮", async () => {
    const execute = vi.fn().mockResolvedValue({
      hasUpdate: true,
      latestVersion: "2.0.0",
      htmlUrl: "https://github.com/test/releases",
      notes: "修复了一些 bug",
    });
    renderPage({ checkUpdateUseCase: { execute } } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByText("发现新版本！")).toBeInTheDocument();
    });
    expect(screen.getByText("v2.0.0")).toBeInTheDocument();
    expect(screen.getByText("修复了一些 bug")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "前往 GitHub 下载" }),
    ).toBeInTheDocument();
  });

  it("已是最新版本时应显示当前已是最新版本", async () => {
    const execute = vi.fn().mockResolvedValue({
      hasUpdate: false,
      latestVersion: "1.2.3",
      htmlUrl: "",
      notes: "",
    });
    renderPage({ checkUpdateUseCase: { execute } } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByText("当前已是最新版本")).toBeInTheDocument();
    });
  });

  it("点击前往 GitHub 下载应调用 openUpdateUrlUseCase", async () => {
    const user = userEvent.setup();
    const openExecute = vi.fn().mockResolvedValue(undefined);
    const checkExecute = vi.fn().mockResolvedValue({
      hasUpdate: true,
      latestVersion: "2.0.0",
      htmlUrl: "https://github.com/test/releases",
      notes: "更新内容",
    });
    renderPage({
      checkUpdateUseCase: { execute: checkExecute },
      openUpdateUrlUseCase: { execute: openExecute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByText("发现新版本！")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "前往 GitHub 下载" }));

    expect(openExecute).toHaveBeenCalledWith(
      "https://github.com/test/releases",
    );
  });

  it("htmlUrl 为空时点击 GitHub 下载不应调用 openUpdateUrlUseCase", async () => {
    const openExecute = vi.fn().mockResolvedValue(undefined);
    const checkExecute = vi.fn().mockResolvedValue({
      hasUpdate: false,
      latestVersion: "",
      htmlUrl: "",
      notes: "",
    });
    renderPage({
      checkUpdateUseCase: { execute: checkExecute },
      openUpdateUrlUseCase: { execute: openExecute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByText("当前已是最新版本")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "前往 GitHub 下载" }),
    ).not.toBeInTheDocument();
    expect(openExecute).not.toHaveBeenCalled();
  });
});
