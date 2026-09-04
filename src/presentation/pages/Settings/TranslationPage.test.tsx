import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { type DIContainer, DIContext } from "@/di/DIContext";
import TranslationPage from "./TranslationPage";

function makeDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    getTranslationConfigUseCase: {
      execute: vi.fn().mockResolvedValue({
        target_lang: "zh-CN",
        provider: "google",
        ai_config_alias: null,
      }),
    },
    setTranslationConfigUseCase: {
      execute: vi.fn().mockResolvedValue(undefined),
    },
    getAiConfigsUseCase: {
      execute: vi.fn().mockResolvedValue({ aiConfigs: [] }),
    },
    ...overrides,
  } as unknown as DIContainer;
}

function renderPage(di?: Partial<DIContainer>) {
  return render(
    <DIContext value={makeDI(di)}>
      <TranslationPage />
    </DIContext>,
  );
}

describe("TranslationPage 翻译设置页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("加载中应显示加载提示", () => {
    renderPage({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockImplementation(() => new Promise(() => {})),
      },
    } as unknown as DIContainer);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("加载完成后应显示语言选择器", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("目标语言")).toBeInTheDocument();
    });
  });

  it("应显示翻译提供者选择器", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("翻译提供者")).toBeInTheDocument();
    });
  });

  it("默认应选择简体中文和 Google Translate", async () => {
    renderPage();
    await waitFor(() => {
      const langSelect = screen.getByDisplayValue("简体中文");
      expect(langSelect).toBeInTheDocument();
      const providerSelect = screen.getByDisplayValue(
        "Google Translate (免费)",
      );
      expect(providerSelect).toBeInTheDocument();
    });
  });

  it("provider 为 ai 时应显示 AI 配置选择器", async () => {
    const user = userEvent.setup();
    renderPage({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockResolvedValue({
          target_lang: "zh-CN",
          provider: "google",
          ai_config_alias: null,
        }),
      },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByText("翻译提供者")).toBeInTheDocument();
    });

    const providerSelect = screen.getByDisplayValue("Google Translate (免费)");
    await user.selectOptions(providerSelect, "ai");

    expect(screen.getByText("AI 配置")).toBeInTheDocument();
  });

  it("provider 为 google 时不应显示 AI 配置选择器", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("翻译提供者")).toBeInTheDocument();
    });
    expect(screen.queryByText("AI 配置")).not.toBeInTheDocument();
  });

  it("有 AI 配置且 provider 为 ai 时应显示配置选项", async () => {
    const user = userEvent.setup();
    renderPage({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockResolvedValue({
          target_lang: "zh-CN",
          provider: "google",
          ai_config_alias: null,
        }),
      },
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({
          aiConfigs: [
            {
              alias: "DeepSeek",
              api_endpoint: "http://test",
              api_key: "sk-test",
              ai_model: "deepseek",
            },
          ],
        }),
      },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByText("翻译提供者")).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByDisplayValue("Google Translate (免费)"),
      "ai",
    );

    expect(screen.getByText("AI 配置")).toBeInTheDocument();
    expect(screen.getByDisplayValue("请选择")).toBeInTheDocument();
  });

  it("修改语言后保存按钮应启用", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("简体中文")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue("简体中文"), "en");

    expect(screen.getByRole("button", { name: "保存" })).not.toBeDisabled();
  });

  it("提交表单应调用 setTranslationConfigUseCase", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      setTranslationConfigUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByDisplayValue("简体中文")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue("简体中文"), "ja");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith({
        target_lang: "ja",
        provider: "google",
        ai_config_alias: null,
      });
    });
  });

  it("选择 AI 配置后应正确设置 aiConfigAlias", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockResolvedValue({
          target_lang: "zh-CN",
          provider: "google",
          ai_config_alias: null,
        }),
      },
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({
          aiConfigs: [
            {
              alias: "DeepSeek",
              api_endpoint: "http://test",
              api_key: "sk-test",
              ai_model: "deepseek",
            },
          ],
        }),
      },
      setTranslationConfigUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByText("翻译提供者")).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByDisplayValue("Google Translate (免费)"),
      "ai",
    );

    await waitFor(() => {
      expect(screen.getByText("AI 配置")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue("请选择"), "DeepSeek");

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith({
        target_lang: "zh-CN",
        provider: "ai",
        ai_config_alias: "DeepSeek",
      });
    });
  });

  it("AI 配置选择空值时应设置 aiConfigAlias 为 null", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(undefined);
    renderPage({
      getTranslationConfigUseCase: {
        execute: vi.fn().mockResolvedValue({
          target_lang: "zh-CN",
          provider: "ai",
          ai_config_alias: "DeepSeek",
        }),
      },
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({
          aiConfigs: [
            {
              alias: "DeepSeek",
              api_endpoint: "http://test",
              api_key: "sk-test",
              ai_model: "deepseek",
            },
          ],
        }),
      },
      setTranslationConfigUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByDisplayValue("DeepSeek")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue("DeepSeek"), "");

    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith({
        target_lang: "zh-CN",
        provider: "ai",
        ai_config_alias: null,
      });
    });
  });

  it("保存失败时应显示错误提示", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockRejectedValue(new Error("网络错误"));
    renderPage({
      setTranslationConfigUseCase: { execute },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByDisplayValue("简体中文")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue("简体中文"), "ja");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("保存失败: 网络错误");
    });
  });
});
