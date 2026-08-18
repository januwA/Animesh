import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayerSubtitleSelector } from "./PlayerSubtitleSelector";
import type { SubtitleTrackItem } from "./usePlayerSubtitle";

describe("PlayerSubtitleSelector 字幕选择组件", () => {
  const tracks: SubtitleTrackItem[] = [
    { id: 1, language: "eng", title: "English", codec: "S_TEXT/UTF8" },
    { id: 2, language: "chi", title: "", codec: "S_TEXT/UTF8" },
  ];

  it("没有字幕轨道时应该渲染为空", () => {
    const { container } = render(
      <PlayerSubtitleSelector
        tracks={[]}
        selectedTrackId={null}
        onChange={vi.fn()}
        loading={false}
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("应该渲染关闭选项与所有字幕轨道，标题为空时回退为轨道编号", () => {
    render(
      <PlayerSubtitleSelector
        tracks={tracks}
        selectedTrackId={1}
        onChange={vi.fn()}
        loading={false}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("1");
    const options = Array.from(select.options).map((opt) => opt.textContent);
    expect(options).toContain("关闭字幕");
    expect(options).toContain("English (eng)");
    expect(options).toContain("轨道 2 (chi)");
  });

  it("未选中任何字幕轨道时应该选中关闭选项", () => {
    render(
      <PlayerSubtitleSelector
        tracks={tracks}
        selectedTrackId={null}
        onChange={vi.fn()}
        loading={false}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("切换选项时应该调用 onChange 并传入新的值", () => {
    const onChange = vi.fn();
    render(
      <PlayerSubtitleSelector
        tracks={tracks}
        selectedTrackId={1}
        onChange={onChange}
        loading={false}
      />,
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "2" } });

    expect(onChange).toHaveBeenCalledWith("2");
  });

  it("字幕加载中时应该显示旋转图标", () => {
    const { container } = render(
      <PlayerSubtitleSelector
        tracks={tracks}
        selectedTrackId={1}
        onChange={vi.fn()}
        loading
      />,
    );

    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("未在加载时不应该显示旋转图标", () => {
    const { container } = render(
      <PlayerSubtitleSelector
        tracks={tracks}
        selectedTrackId={1}
        onChange={vi.fn()}
        loading={false}
      />,
    );

    expect(container.querySelector(".animate-spin")).toBeNull();
  });
});
