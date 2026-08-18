import { fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PlayerBackButton } from "./PlayerBackButton";

const currentLocation = {
  current: null as string | null,
};
const LocationTracker = () => {
  currentLocation.current = useLocation().pathname;
  return null;
};

const renderWithRouter = (initialIndex: number) => {
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
          {
            path: "play/hash123",
            element: <PlayerBackButton />,
          },
        ],
      },
    ],
    { initialEntries: ["/", "/play/hash123"], initialIndex },
  );
  return render(<RouterProvider router={router} />);
};

describe("PlayerBackButton 返回按钮组件", () => {
  it("应该渲染返回按钮", () => {
    renderWithRouter(1);

    expect(screen.getByRole("button", { name: /返回/ })).toBeInTheDocument();
  });

  it("点击按钮时应该导航回上一页", () => {
    renderWithRouter(1);

    fireEvent.click(screen.getByRole("button", { name: /返回/ }));

    expect(currentLocation.current).toBe("/");
  });
});
