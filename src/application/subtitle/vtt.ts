/**
 * 轻量级 WEBVTT 解析与重组工具。
 *
 * 仅处理 MVP 所需的字幕结构：WEBVTT 头、cue 标识符、时间轴、cue 文本。
 * 不解析 STYLE / REGION 块（保留 header 中的非 cue 内容）。
 */

export interface VttCue {
  /** 时间轴上方的可选标识符行（可为空） */
  identifier?: string;
  /** 原始开始时间字符串，例如 "00:00:01.000" */
  start: string;
  /** 原始结束时间字符串，例如 "00:00:03.000" */
  end: string;
  /** 时间轴行（含可能的 cue settings，如 align:start position:0%） */
  timingLine: string;
  /** 字幕文本，多行用 \n 连接 */
  text: string;
}

export interface VttDocument {
  /** WEBVTT 头部行（含可能的描述文本，例如 "WEBVTT - 一些描述"） */
  header: string;
  /** 解析出的所有 cue */
  cues: VttCue[];
}

const TIMING_REGEX =
  /^(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}|\d+\.\d+)\s*-->\s*(\d{1,2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}|\d+\.\d+)/;

/**
 * 把原始 VTT 字符串解析为可修改的文档结构。
 * NOTE 块会被跳过，不进入 cues 列表。
 */
export function parseVtt(vtt: string): VttDocument {
  const lines = normalizeLines(vtt);
  const { header, startIndex } = readHeader(lines);
  const cues = readCues(lines, startIndex);
  return { header, cues };
}

function normalizeLines(vtt: string): string[] {
  return vtt.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function readHeader(lines: string[]): { header: string; startIndex: number } {
  let header = "WEBVTT";
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length) {
    header = lines[i];
    i++;
  }
  return { header, startIndex: i };
}

interface CueBuilder {
  cues: VttCue[];
  current: VttCue | null;
}

function readCues(lines: string[], startIndex: number): VttCue[] {
  const builder: CueBuilder = { cues: [], current: null };
  for (let i = startIndex; i < lines.length; i++) {
    i = consumeLine(lines, i, builder);
  }
  pushCurrent(builder);
  return builder.cues.filter((c) => c.timingLine !== "");
}

function consumeLine(lines: string[], i: number, b: CueBuilder): number {
  const line = lines[i];
  const trimmed = line.trim();

  if (trimmed === "") {
    pushCurrent(b);
    return i;
  }

  if (isSkippableBlock(trimmed)) {
    pushCurrent(b);
    while (i < lines.length && lines[i].trim() !== "") i++;
    return i;
  }

  if (TIMING_REGEX.test(trimmed)) {
    const pendingIdentifier =
      b.current && b.current.timingLine === ""
        ? b.current.identifier
        : undefined;
    pushCurrent(b);
    b.current = makeTimingCue(pendingIdentifier, trimmed);
    return i;
  }

  if (b.current) {
    b.current.text =
      b.current.text === "" ? line : `${b.current.text}\n${line}`;
    return i;
  }

  b.current = makeIdentifierCue(trimmed);
  return i;
}

function pushCurrent(b: CueBuilder): void {
  if (b.current) {
    b.cues.push(b.current);
    b.current = null;
  }
}

function makeTimingCue(
  pendingIdentifier: string | undefined,
  trimmed: string,
): VttCue {
  const match = TIMING_REGEX.exec(trimmed)!;
  return {
    identifier: pendingIdentifier,
    start: match[1],
    end: match[2],
    timingLine: trimmed,
    text: "",
  };
}

function makeIdentifierCue(trimmed: string): VttCue {
  return {
    identifier: trimmed,
    start: "",
    end: "",
    timingLine: "",
    text: "",
  };
}

/** NOTE / STYLE / REGION 等需要整体跳过的块头 */
function isSkippableBlock(trimmed: string): boolean {
  return (
    trimmed.startsWith("NOTE") ||
    trimmed.startsWith("STYLE") ||
    trimmed.startsWith("REGION")
  );
}

/**
 * 从文档中提取去重后的字幕文本列表（保留首次出现顺序）。
 * 空文本会被忽略。
 */
export function extractUniqueTexts(doc: VttDocument): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cue of doc.cues) {
    const text = cue.text;
    if (text === "" || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

/**
 * 用翻译表重建 VTT 字符串。
 * translationMap 的 key 为原文，value 为译文。
 * 未命中翻译表的文本保留原文。
 */
export function buildVtt(
  doc: VttDocument,
  translationMap: Map<string, string>,
): string {
  const parts: string[] = [doc.header, ""];
  for (const cue of doc.cues) {
    if (cue.identifier) parts.push(cue.identifier);
    parts.push(cue.timingLine);
    const text = translationMap.get(cue.text) ?? cue.text;
    if (text !== "") parts.push(text);
    parts.push("");
  }
  return parts.join("\n");
}
