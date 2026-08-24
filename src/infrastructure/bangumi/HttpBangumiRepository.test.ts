import { Background } from "ajanuw-context";
import { describe, expect, it, vi } from "vitest";
import { createFakeHttpClient } from "@/test/FakeHttpClient";
import { HttpBangumiRepository } from "./HttpBangumiRepository";

const rawRankedSubject = {
  id: 326,
  name: "Shin Seiki Evangelion",
  name_cn: "新世纪福音战士",
  images: {
    large: "https://img.example/l.jpg",
    medium: "https://img.example/m.jpg",
    small: "https://img.example/s.jpg",
    grid: "https://img.example/g.jpg",
  },
  rating: { score: 9.1, rank: 1 },
};

describe("HttpBangumiRepository 榜单条目获取", () => {
  it("应按年份月份 rank 排序请求指定类型榜单并解析响应", async () => {
    const client = createFakeHttpClient();
    vi.mocked(client.getJson).mockResolvedValueOnce({
      total: 1,
      limit: 5,
      offset: 0,
      data: [rawRankedSubject],
    });

    const repo = new HttpBangumiRepository(client);
    const subjects = await repo.getRankedSubjects(Background, 2026, 8, 5);

    expect(client.getJson).toHaveBeenCalledWith(
      "https://api.bgm.tv/v0/subjects",
      {
        ctx: Background,
        params: {
          cat: "1",
          limit: 5,
          month: 8,
          offset: undefined,
          sort: "rank",
          type: "2",
          year: 2026,
        },
      },
    );
    expect(subjects).toEqual({
      items: [
        {
          id: 326,
          name: "新世纪福音战士",
          image: "https://img.example/m.jpg",
          rating: 9.1,
          summary: "",
        },
      ],
      total: 1,
    });
  });

  it("响应结构异常时应抛出包含 cause 的错误", async () => {
    const client = createFakeHttpClient();
    vi.mocked(client.getJson).mockResolvedValueOnce({ unexpected: true });

    const repo = new HttpBangumiRepository(client);

    const promise = repo.getRankedSubjects(Background, 2026, 8, 5);
    await expect(promise).rejects.toThrow(
      "Ranked subjects API response structure mismatch",
    );
    await expect(promise).rejects.toMatchObject({ cause: expect.any(Error) });
  });
});
