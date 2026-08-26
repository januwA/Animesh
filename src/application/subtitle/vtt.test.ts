import { describe, expect, it } from "vitest";
import { buildVtt, extractUniqueTexts, parseVtt } from "./vtt";

describe("parseVtt", () => {
  it("应该解析基本的 WEBVTT 文件，包含时间轴与字幕文本", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
你好世界

00:00:04.000 --> 00:00:06.000
第二段字幕
`;
    const doc = parseVtt(vtt);
    expect(doc.header).toBe("WEBVTT");
    expect(doc.cues).toHaveLength(2);
    expect(doc.cues[0]).toMatchObject({
      start: "00:00:01.000",
      end: "00:00:03.000",
      text: "你好世界",
    });
    expect(doc.cues[1].text).toBe("第二段字幕");
  });

  it("应该保留多行字幕文本，用 \\n 连接", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000
第一行
第二行
`;
    const doc = parseVtt(vtt);
    expect(doc.cues[0].text).toBe("第一行\n第二行");
  });

  it("应该跳过 NOTE 块", () => {
    const vtt = `WEBVTT

NOTE 这是注释，应该被忽略

00:00:01.000 --> 00:00:03.000
正文
`;
    const doc = parseVtt(vtt);
    expect(doc.cues).toHaveLength(1);
    expect(doc.cues[0].text).toBe("正文");
  });

  it("应该跳过 STYLE 与 REGION 块", () => {
    const vtt = `WEBVTT

STYLE
::cue { color: lime; }

REGION
id:bill width:40%

00:00:01.000 --> 00:00:03.000
正文
`;
    const doc = parseVtt(vtt);
    expect(doc.cues).toHaveLength(1);
    expect(doc.cues[0].text).toBe("正文");
  });

  it("应该保留 cue 标识符（时间轴上方的可选行）", () => {
    const vtt = `WEBVTT

cue-1
00:00:01.000 --> 00:00:03.000
正文
`;
    const doc = parseVtt(vtt);
    expect(doc.cues[0].identifier).toBe("cue-1");
    expect(doc.cues[0].text).toBe("正文");
  });

  it("应该保留带设置的时间轴行", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:03.000 align:start position:0%
正文
`;
    const doc = parseVtt(vtt);
    expect(doc.cues[0].start).toBe("00:00:01.000");
    expect(doc.cues[0].end).toBe("00:00:03.000");
    expect(doc.cues[0].text).toBe("正文");
  });

  it("应该保留 header 后的元数据行（如 NOTE 之外的注释）", () => {
    const vtt = `WEBVTT - 一些描述

00:00:01.000 --> 00:00:03.000
正文
`;
    const doc = parseVtt(vtt);
    expect(doc.header).toBe("WEBVTT - 一些描述");
    expect(doc.cues).toHaveLength(1);
  });

  it("空字符串应该返回空 cue 列表", () => {
    const doc = parseVtt("");
    expect(doc.cues).toHaveLength(0);
  });
});

describe("extractUniqueTexts", () => {
  it("应该返回去重后的字幕文本列表", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
你好

00:00:02.000 --> 00:00:03.000
世界

00:00:03.000 --> 00:00:04.000
你好
`;
    const doc = parseVtt(vtt);
    const unique = extractUniqueTexts(doc);
    expect(unique).toEqual(["你好", "世界"]);
  });

  it("空 cue 文本不应该出现在结果里", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000


00:00:02.000 --> 00:00:03.000
正文
`;
    const doc = parseVtt(vtt);
    const unique = extractUniqueTexts(doc);
    expect(unique).toEqual(["正文"]);
  });
});

describe("buildVtt", () => {
  it("应该把翻译表回填并重建合法的 WEBVTT", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
你好

00:00:02.000 --> 00:00:03.000
世界
`;
    const doc = parseVtt(vtt);
    const translations = new Map<string, string>([
      ["你好", "Hello"],
      ["世界", "World"],
    ]);
    const rebuilt = buildVtt(doc, translations);
    expect(rebuilt).toContain("WEBVTT");
    expect(rebuilt).toContain("00:00:01.000 --> 00:00:02.000");
    expect(rebuilt).toContain("Hello");
    expect(rebuilt).toContain("World");
    expect(rebuilt).not.toContain("你好");
    expect(rebuilt).not.toContain("世界");
  });

  it("翻译表中缺失的文本应该保留原文", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`;
    const doc = parseVtt(vtt);
    const rebuilt = buildVtt(doc, new Map());
    expect(rebuilt).toContain("你好");
  });

  it("应该保留多行字幕文本的换行", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
第一行
第二行
`;
    const doc = parseVtt(vtt);
    const translations = new Map<string, string>([
      ["第一行\n第二行", "Line1\nLine2"],
    ]);
    const rebuilt = buildVtt(doc, translations);
    expect(rebuilt).toContain("Line1\nLine2");
  });

  it("应该保留 cue 标识符与时间轴设置", () => {
    const vtt = `WEBVTT

cue-1
00:00:01.000 --> 00:00:02.000 align:start position:0%
你好
`;
    const doc = parseVtt(vtt);
    const rebuilt = buildVtt(doc, new Map([["你好", "Hello"]]));
    expect(rebuilt).toContain("cue-1");
    expect(rebuilt).toContain(
      "00:00:01.000 --> 00:00:02.000 align:start position:0%",
    );
    expect(rebuilt).toContain("Hello");
  });

  it("翻译结果为空字符串时，应该跳过该行文本", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
你好
`;
    const doc = parseVtt(vtt);
    const rebuilt = buildVtt(doc, new Map([["你好", ""]]));
    expect(rebuilt).not.toContain("你好");
    expect(rebuilt).toContain("00:00:01.000 --> 00:00:02.000");
  });
});
