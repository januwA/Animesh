import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { DIProvider } from "@/di/DIContext";
import { resetAppStores } from "@/test/store-reset";
import { createDIContainerForTest } from "@/test/test-utils";
import { TorrentStatusProvider } from "../context/TorrentStatusContext";
import { AppNavBar } from "./AppComponents";

describe("AppComponents 组件", () => {
  beforeEach(() => {
    resetAppStores();
  });

  it("AppNavBar 应该在 TorrentStatusProvider 下正确渲染", async () => {
    let resolveUnsubscribe: any;
    const unsubMock = vi.fn();
    const promise = new Promise<any>((resolve) => {
      resolveUnsubscribe = () => resolve(unsubMock);
    });

    const mockContainer = createDIContainerForTest({
      subscribeTorrentsUseCase: {
        execute: vi.fn().mockReturnValue(promise),
      } as any,
    });

    const { unmount } = render(
      <DIProvider value={mockContainer}>
        <TorrentStatusProvider>
          <MemoryRouter>
            <AppNavBar />
          </MemoryRouter>
        </TorrentStatusProvider>
      </DIProvider>,
    );

    unmount();
    resolveUnsubscribe();

    await promise;
    expect(unsubMock).toHaveBeenCalled();
  });
});
