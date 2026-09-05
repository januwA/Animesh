import { fireEvent, render, screen } from "@testing-library/react";
import type { Context } from "ajanuw-context";
import { beforeEach, vi } from "vitest";
import { DIContext } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { UseQueryResult } from "@/presentation/hooks/useQuery";
import { useQuery } from "@/presentation/hooks/useQuery";
import { TrackerSection } from "./TrackerSection";

vi.mock(import("@/presentation/hooks/useQuery"), () => ({
  useQuery: vi.fn(),
}));

const mockedUseQuery = vi.mocked(useQuery);

const infoHash = NonEmptyStringSchema.parse("hash1");

const mockExecute = vi.fn().mockResolvedValue([]);

let queryResult: UseQueryResult<string[]> = {
  data: null,
  loading: false,
  error: null,
  refetch: vi.fn(),
};

mockedUseQuery.mockImplementation((queryFn) => {
  queryFn({} as Context);
  return queryResult;
});

function setupTrackers(params: {
  trackers?: string[];
  error?: string;
  isLoading?: boolean;
  refetch?: () => void;
}) {
  queryResult = {
    data: params.trackers ?? null,
    loading: params.isLoading ?? false,
    error: params.error ? new Error(params.error) : null,
    refetch: params.refetch ?? vi.fn(),
  };
}

const renderTrackerSection = () =>
  render(
    <DIContext
      value={
        {
          getTorrentTrackersUseCase: { execute: mockExecute },
        } as never
      }
    >
      <TrackerSection infoHash={infoHash} />
    </DIContext>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue([]);
  mockedUseQuery.mockImplementation((queryFn) => {
    queryFn({} as Context);
    return queryResult;
  });
});

describe("TrackerSection Tracker 列表组件", () => {
  it("应该渲染标题与 Tracker 数量徽标", () => {
    setupTrackers({ trackers: ["t1.example.com", "t2.example.com"] });
    renderTrackerSection();

    expect(screen.getByText("Tracker 服务器")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("展开后应该显示所有 Tracker 地址", () => {
    setupTrackers({ trackers: ["t1.example.com", "t2.example.com"] });
    renderTrackerSection();

    const trigger = screen.getByText("Tracker 服务器");
    fireEvent.click(trigger);

    expect(screen.getByText("t1.example.com")).toBeInTheDocument();
    expect(screen.getByText("t2.example.com")).toBeInTheDocument();
  });

  it("没有 Tracker 时不应该渲染徽标并提示暂无信息", () => {
    setupTrackers({ trackers: [] });
    renderTrackerSection();

    const trigger = screen.getByText("Tracker 服务器");
    fireEvent.click(trigger);

    expect(screen.getByText("暂无 Tracker 信息")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("获取失败时应该显示错误信息", () => {
    setupTrackers({ error: "获取 trackers 失败" });
    renderTrackerSection();

    const trigger = screen.getByText("Tracker 服务器");
    fireEvent.click(trigger);

    expect(screen.getByText("获取Tracker列表数据失败")).toBeInTheDocument();
  });

  it("点击刷新按钮应该调用 refetch", () => {
    const refetch = vi.fn();
    setupTrackers({ refetch });
    renderTrackerSection();

    const refreshButton = screen.getByRole("button", {
      name: /刷新 Tracker 列表/i,
    });
    fireEvent.click(refreshButton);

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("刷新按钮在加载时应该禁用", () => {
    setupTrackers({ isLoading: true, refetch: vi.fn() });
    renderTrackerSection();

    const refreshButton = screen.getByRole("button", {
      name: /刷新 Tracker 列表/i,
    });
    expect(refreshButton).toBeDisabled();
  });
});
