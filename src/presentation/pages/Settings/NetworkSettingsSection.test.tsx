import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { NetworkSettingsSection } from "./NetworkSettingsSection";

describe("NetworkSettingsSection 网络设置区块", () => {
  it("应该渲染代理地址输入并触发变更回调", () => {
    const onProxyChange = vi.fn();
    render(
      <NetworkSettingsSection
        proxy="http://127.0.0.1:7890"
        onProxyChange={onProxyChange}
      />,
    );

    expect(screen.getByLabelText("代理服务器地址")).toHaveValue(
      "http://127.0.0.1:7890",
    );

    fireEvent.change(screen.getByLabelText("代理服务器地址"), {
      target: { value: "socks5://127.0.0.1:1080" },
    });

    expect(onProxyChange).toHaveBeenCalledWith("socks5://127.0.0.1:1080");
  });
});
