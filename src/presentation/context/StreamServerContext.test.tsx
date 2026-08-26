import { render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIContext } from "@/di/DIContext";
import { StreamServerProvider, useStreamServer } from "./StreamServerContext";

function PortConsumer() {
  const { streamPort } = useStreamServer();
  return (
    <div>
      <span data-testid="port">
        {streamPort === null ? "null" : String(streamPort)}
      </span>
    </div>
  );
}

const renderProvider = (container: DIContainer, children = <PortConsumer />) =>
  render(
    <DIContext value={container}>
      <StreamServerProvider>{children}</StreamServerProvider>
    </DIContext>,
  );

describe("StreamServerContext 流媒体服务器上下文", () => {
  it("未提供 Provider 时 useStreamServer 应该抛出错误", () => {
    function DefaultConsumer() {
      useStreamServer();
      return null;
    }

    expect(() => render(<DefaultConsumer />)).toThrow(
      "StreamServerContext was not provided",
    );
  });

  it("获取端口成功后应把端口提供给消费者", async () => {
    const getStreamPort = vi.fn().mockResolvedValue(45678);
    renderProvider({
      getStreamPortUseCase: { execute: getStreamPort },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(screen.getByTestId("port")).toHaveTextContent("45678");
    });
  });

  it("获取端口失败时应保持 null 状态", async () => {
    const getStreamPort = vi.fn().mockRejectedValue(new Error("连接失败"));
    renderProvider({
      getStreamPortUseCase: { execute: getStreamPort },
    } as unknown as DIContainer);

    await waitFor(() => {
      expect(getStreamPort).toHaveBeenCalled();
    });
    expect(screen.getByTestId("port")).toHaveTextContent("null");
  });
});
