import { describe, expect, it } from "vitest";
import { TorrentStatusInfoSchema } from "./TorrentSchemas";

const baseTorrent = {
  info_hash: "hash111",
  name: "测试种子",
  progress_bytes: 100,
  total_bytes: 1000,
  finished: false,
  download_speed_bytes_per_sec: 50,
  upload_speed_bytes_per_sec: 100,
  paused: false,
  peers_connected: 0,
  peers_total: 0,
  created_at: 1700000000000,
  trackers: [],
};

describe("TorrentStatusInfoSchema 下载任务状态 Schema", () => {
  it("没有绑定字段时应该校验通过且字段为 undefined", () => {
    const result = TorrentStatusInfoSchema.safeParse(baseTorrent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject_id).toBeUndefined();
      expect(result.data.subject_name).toBeUndefined();
    }
  });

  it("携带 subject_id 与 subject_name 时应该正确解析", () => {
    const result = TorrentStatusInfoSchema.safeParse({
      ...baseTorrent,
      subject_id: 42,
      subject_name: "测试条目",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject_id).toBe(42);
      expect(result.data.subject_name).toBe("测试条目");
    }
  });
});
