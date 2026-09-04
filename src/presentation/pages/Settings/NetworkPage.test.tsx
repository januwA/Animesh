import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { type DIContainer, DIContext } from "@/di/DIContext";
import NetworkPage from "./NetworkPage";

function makeDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    getProxyUseCase: {
      execute: vi.fn().mockResolvedValue({ proxy: "http://127.0.0.1:7890" }),
    },
    setProxyUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  } as unknown as DIContainer;
}

function renderPage(di?: Partial<DIContainer>) {
  return render(
    <DIContext value={makeDI(di)}>
      <NetworkPage />
    </DIContext>,
  );
}

describe("NetworkPage 网络设置页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("加载中应显示加载提示", () => {
    renderPage({
      getProxyUseCase: {
        execute: vi.fn().mockImplementation(() => new Promise(() => {})),
      },
    } as unknown as DIContainer);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("加载完成后应显示代理输入框", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("代理服务器地址")).toBeInTheDocument();
    });
  });

  it("应预填当前代理地址", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("代理服务器地址")).toHaveValue(
        "http://127.0.0.1:7890",
      );
    });
  });

  it("修改代理后保存按钮应启用", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("代理服务器地址")).toHaveValue(
        "http://127.0.0.1:7890",
      );
    });

    await user.clear(screen.getByLabelText("代理服务器地址"));
    await user.type(
      screen.getByLabelText("代理服务器地址"),
      "socks5://localhost:1080",
    );

    expect(screen.getByRole("button", { name: "保存" })).not.toBeDisabled();
  });

  it("提交表单应调用 setProxyUseCase", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      setProxyUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("代理服务器地址")).toHaveValue(
        "http://127.0.0.1:7890",
      );
    });

    await user.clear(screen.getByLabelText("代理服务器地址"));
    await user.type(
      screen.getByLabelText("代理服务器地址"),
      "socks5://localhost:1080",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith("socks5://localhost:1080");
    });
  });

  it("代理为空时提交应传 null", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      getProxyUseCase: {
        execute: vi.fn().mockResolvedValue({ proxy: null }),
      },
      setProxyUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("代理服务器地址")).toHaveValue("");
    });

    await user.type(
      screen.getByLabelText("代理服务器地址"),
      "http://proxy:8080",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith("http://proxy:8080");
    });
  });

  it("清空代理后提交应传 null", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(undefined);
    renderPage({ setProxyUseCase: { execute } } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("代理服务器地址")).toHaveValue(
        "http://127.0.0.1:7890",
      );
    });

    await user.clear(screen.getByLabelText("代理服务器地址"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith(null);
    });
  });

  it("保存失败时应显示错误提示", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockRejectedValue(new Error("网络错误"));
    renderPage({ setProxyUseCase: { execute } } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByLabelText("代理服务器地址")).toHaveValue(
        "http://127.0.0.1:7890",
      );
    });

    await user.clear(screen.getByLabelText("代理服务器地址"));
    await user.type(screen.getByLabelText("代理服务器地址"), "http://new");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("保存失败: 网络错误");
    });
  });
});
