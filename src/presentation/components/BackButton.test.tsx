import { fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BackButton } from "./BackButton";

const currentLocation = {
  current: null as string | null,
};
const LocationTracker = () => {
  currentLocation.current = useLocation().pathname;
  return null;
};

const renderWithRouter = (node: React.ReactNode, initialIndex = 1) => {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <>
            <LocationTracker />
            <Outlet />
          </>
        ),
        children: [
          { index: true, element: <div>首页</div> },
          { path: "detail", element: node },
        ],
      },
    ],
    { initialEntries: ["/", "/detail"], initialIndex },
  );
  return render(<RouterProvider router={router} />);
};

describe("BackButton 返回按钮组件", () => {
  it("应该渲染默认「返回」按钮", () => {
    renderWithRouter(<BackButton />);

    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
  });

  it("点击时默认回退到上一页", () => {
    renderWithRouter(<BackButton />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(currentLocation.current).toBe("/");
  });

  it("提供 onBack 时应该调用回调而不是导航", () => {
    const onBack = vi.fn();
    renderWithRouter(<BackButton onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "返回" }));

    expect(onBack).toHaveBeenCalledOnce();
    expect(currentLocation.current).toBe("/detail");
  });

  it("支持自定义文案", () => {
    renderWithRouter(<BackButton label="返回" />);

    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
  });

  it("支持自定义 variant", () => {
    renderWithRouter(<BackButton variant="outline" />);

    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
  });
});
