import { render, screen } from "@testing-library/react";
import { SettingsLoaderContext, useSettingsLoader } from "./SettingsContext";

function Consumer() {
  const ctx = useSettingsLoader();
  return <span data-testid="version">{ctx.currentVersion}</span>;
}

describe("SettingsContext 设置上下文", () => {
  it("useSettingsLoader 在 Provider 外部使用时应抛出错误", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      "useSettingsLoader 必须在 SettingsLoaderContext.Provider 内使用",
    );
    spy.mockRestore();
  });

  it("useSettingsLoader 在 Provider 内部应返回上下文值", () => {
    render(
      <SettingsLoaderContext
        value={{
          isTauri: true,
          isMobile: false,
          loading: false,
          currentVersion: "1.0.0",
        }}
      >
        <Consumer />
      </SettingsLoaderContext>,
    );
    expect(screen.getByTestId("version")).toHaveTextContent("1.0.0");
  });
});
