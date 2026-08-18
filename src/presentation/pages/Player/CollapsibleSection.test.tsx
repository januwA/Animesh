import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollapsibleSection } from "./CollapsibleSection";

describe("CollapsibleSection 折叠区块组件", () => {
  it("应该渲染标题、图标与徽标，且默认收起内容", () => {
    render(
      <CollapsibleSection title="章节" icon={<span>图标</span>} badge={3}>
        <p>内部内容</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText("章节")).toBeInTheDocument();
    expect(screen.getByText("图标")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("内部内容")).not.toBeInTheDocument();
  });

  it("不传 badge 时不应该渲染徽标", () => {
    render(
      <CollapsibleSection title="章节" icon={<span>图标</span>}>
        <p>内部内容</p>
      </CollapsibleSection>,
    );

    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("点击标题后应该展开并显示内部内容", () => {
    render(
      <CollapsibleSection title="章节" icon={<span>图标</span>}>
        <p>内部内容</p>
      </CollapsibleSection>,
    );

    const trigger = screen.getByText("章节").closest("button");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);

    expect(screen.getByText("内部内容")).toBeInTheDocument();
  });

  it("defaultOpen 为 true 时应该默认展开", () => {
    render(
      <CollapsibleSection title="章节" icon={<span>图标</span>} defaultOpen>
        <p>内部内容</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText("内部内容")).toBeInTheDocument();
  });
});
