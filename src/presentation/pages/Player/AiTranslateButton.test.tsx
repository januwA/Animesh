import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { AiTranslateButton } from "./AiTranslateButton";

describe("AiTranslateButton AI 翻译按钮组件", () => {
  const params = {
    infoHash: NonEmptyStringSchema.parse("hash123"),
    fileId: 0,
    title: NonEmptyStringSchema.parse("测试 视频"),
    fileName: NonEmptyStringSchema.parse("video name.mp4"),
  };

  const renderButton = () => {
    const router = createMemoryRouter(
      [
        { path: "/", element: <div>首页</div> },
        {
          path: "/play/:infoHash/:fileId",
          element: <AiTranslateButton {...params} />,
        },
        {
          path: "/play/:infoHash/:fileId/ai-subtitle",
          element: <div>AI 字幕翻译页</div>,
        },
      ],
      { initialEntries: ["/play/hash123/0"] },
    );
    return render(<RouterProvider router={router} />);
  };

  it("应该渲染 AI 翻译链接", () => {
    renderButton();

    expect(screen.getByRole("link", { name: /AI 翻译/ })).toBeInTheDocument();
  });

  it("点击链接时应该携带标题参数跳转到 AI 字幕翻译页面", () => {
    renderButton();

    fireEvent.click(screen.getByRole("link", { name: /AI 翻译/ }));

    expect(screen.getByText("AI 字幕翻译页")).toBeInTheDocument();
  });
});
