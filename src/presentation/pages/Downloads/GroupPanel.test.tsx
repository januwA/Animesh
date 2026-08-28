import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { TorrentStatusInfo } from "@/domain/torrent/TorrentSchemas";
import { GroupPanel } from "./GroupPanel";

vi.mock(import("@/presentation/components/TranslatableText"), () => ({
  TranslatableText: vi.fn(({ text }) => <span>{text}</span>),
}));

const makeStatus = (): TorrentStatusInfo => ({
  info_hash: NonEmptyStringSchema.parse("hash123"),
  name: NonEmptyStringSchema.parse("测试任务"),
  progress_bytes: 400,
  total_bytes: 1000,
  finished: false,
  download_speed_bytes_per_sec: 100,
  upload_speed_bytes_per_sec: 100,
  paused: false,
  peers_connected: 0,
  peers_total: 0,
  trackers: [],
});

describe("GroupPanel 分组面板组件", () => {
  it("应该渲染标题与数量徽标，defaultOpen 为 true 时展示内容", () => {
    render(
      <GroupPanel title="动漫A" items={[makeStatus()]} defaultOpen>
        <p>内部内容</p>
      </GroupPanel>,
    );

    expect(screen.getByText("动漫A")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("内部内容")).toBeInTheDocument();
  });

  it("defaultOpen 为 false 时折叠，点击标题后展开", () => {
    render(
      <GroupPanel title="动漫A" items={[makeStatus()]} defaultOpen={false}>
        <p>内部内容</p>
      </GroupPanel>,
    );

    expect(screen.queryByText("内部内容")).not.toBeInTheDocument();

    const trigger = screen.getByText("动漫A").closest("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);

    expect(screen.getByText("内部内容")).toBeInTheDocument();
  });

  it("未传 action 时不渲染操作按钮，传入后渲染", () => {
    const { rerender } = render(
      <GroupPanel title="动漫A" items={[makeStatus()]} defaultOpen>
        <p>内部内容</p>
      </GroupPanel>,
    );
    expect(
      screen.queryByRole("button", { name: "查看条目" }),
    ).not.toBeInTheDocument();

    rerender(
      <GroupPanel
        title="动漫A"
        items={[makeStatus()]}
        defaultOpen
        action={<button type="button">查看条目</button>}
      >
        <p>内部内容</p>
      </GroupPanel>,
    );
    expect(
      screen.getByRole("button", { name: "查看条目" }),
    ).toBeInTheDocument();
  });
});
