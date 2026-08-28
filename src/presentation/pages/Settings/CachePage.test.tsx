import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { type DIContainer, DIContext } from "@/di/DIContext";
import { createStoreMock } from "@/test/storeMock";
import CachePage from "./CachePage";

vi.mock(import("@/presentation/store/bangumiCalendarStore"), () => ({
  useBangumiCalendarStore: createStoreMock({
    calendar: [],
    calendarActiveDay: null,
    setCalendar: vi.fn(),
    setCalendarActiveDay: vi.fn(),
    reset: vi.fn(),
  }) as typeof import("@/presentation/store/bangumiCalendarStore").useBangumiCalendarStore,
}));

vi.mock(import("@/presentation/store/iptvStore"), () => ({
  useIptvStore: createStoreMock({
    iptvCountries: [],
    iptvSelectedCountry: "CN",
    iptvChannels: [],
    iptvChannelsCountry: null,
    iptvSelectedCategory: "all",
    iptvKeyword: "",
    setIptvCountries: vi.fn(),
    setIptvSelectedCountry: vi.fn(),
    setIptvChannels: vi.fn(),
    setIptvChannelsCountry: vi.fn(),
    setIptvSelectedCategory: vi.fn(),
    setIptvKeyword: vi.fn(),
    reset: vi.fn(),
  }) as typeof import("@/presentation/store/iptvStore").useIptvStore,
}));

function makeDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    clearCacheUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    ...overrides,
  } as unknown as DIContainer;
}

function renderPage(di?: Partial<DIContainer>) {
  return render(
    <DIContext value={makeDI(di)}>
      <CachePage />
    </DIContext>,
  );
}

describe("CachePage 缓存管理页面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应渲染标题和清理缓存按钮", () => {
    renderPage();
    expect(screen.getByText("缓存管理")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "清理缓存" }),
    ).toBeInTheDocument();
  });

  it("应显示清理说明文本", () => {
    renderPage();
    expect(screen.getByText(/清理新番日历、条目详情/)).toBeInTheDocument();
  });

  it("点击清理缓存按钮应打开确认对话框", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "清理缓存" }));

    expect(screen.getByText("确定清理缓存数据？")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "确认清理" }),
    ).toBeInTheDocument();
  });

  it("点击取消应关闭对话框", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "清理缓存" }));
    await user.click(screen.getByText("取消"));

    expect(screen.queryByText("确定清理缓存数据？")).not.toBeInTheDocument();
  });

  it("点击确认清理应调用 clearCacheUseCase", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockResolvedValue(undefined);
    renderPage({ clearCacheUseCase: { execute } } as unknown as DIContainer);

    await user.click(screen.getByRole("button", { name: "清理缓存" }));
    await user.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(execute).toHaveBeenCalled();
    });
  });

  it("清理失败时应显示错误提示", async () => {
    const user = userEvent.setup();
    const execute = vi.fn().mockRejectedValue(new Error("网络错误"));
    renderPage({ clearCacheUseCase: { execute } } as unknown as DIContainer);

    await user.click(screen.getByRole("button", { name: "清理缓存" }));
    await user.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("清理缓存失败: 网络错误");
    });
  });

  it("清理中时按钮应显示加载状态", async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    const execute = vi.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolvePromise = r;
        }),
    );
    renderPage({ clearCacheUseCase: { execute } } as unknown as DIContainer);

    await user.click(screen.getByRole("button", { name: "清理缓存" }));
    await user.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(screen.getByText("清理中...")).toBeInTheDocument();
    });

    await act(async () => {
      resolvePromise!();
    });
  });
});
