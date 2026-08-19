import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiConfig, Settings } from "@/domain/settings/SettingsSchemas";
import { useSettingsForm } from "./useSettingsForm";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig => ({
  alias: NonEmptyStringSchema.parse("DeepSeek"),
  api_endpoint: NonEmptyStringSchema.parse("http://127.0.0.1:11434/v1"),
  api_key: NonEmptyStringSchema.parse("sk-test"),
  ai_model: NonEmptyStringSchema.parse("deepseek-chat"),
  ...overrides,
});

const makeSettings = (overrides: Partial<Settings> = {}): Settings => ({
  download_dir: NonEmptyStringSchema.parse("/data"),
  proxy: NonEmptyStringSchema.parse("http://127.0.0.1:7890"),
  max_download_speed: 100,
  max_upload_speed: 200,
  ai_configs: [],
  ...overrides,
});

const renderForm = () => renderHook(() => useSettingsForm());

describe("useSettingsForm 设置表单 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applySettings 应该填充表单状态与快照且不标记脏状态", () => {
    const { result } = renderForm();

    act(() =>
      result.current.applySettings(
        makeSettings({ ai_configs: [makeConfig()] }),
      ),
    );

    expect(result.current.downloadDir).toBe("/data");
    expect(result.current.proxy).toBe("http://127.0.0.1:7890");
    expect(result.current.maxDownloadSpeed).toBe(100);
    expect(result.current.maxUploadSpeed).toBe(200);
    expect(result.current.aiConfigs).toHaveLength(1);
    expect(result.current.isDirty).toBe(false);
  });

  it("applySettings 未提供可选字段时使用默认值", () => {
    const { result } = renderForm();

    act(() =>
      result.current.applySettings(
        makeSettings({
          proxy: null,
          max_download_speed: null,
          max_upload_speed: null,
          ai_configs: null,
        }),
      ),
    );

    expect(result.current.proxy).toBe("");
    expect(result.current.maxDownloadSpeed).toBe(0);
    expect(result.current.maxUploadSpeed).toBe(0);
    expect(result.current.aiConfigs).toEqual([]);
  });

  it("修改字段后 isDirty 应该为 true，markSaved 后为 false", () => {
    const { result } = renderForm();

    act(() => result.current.applySettings(makeSettings()));

    act(() => result.current.setDownloadDir("D:\\New"));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.markSaved());
    expect(result.current.isDirty).toBe(false);
  });

  it("AI 配置表单字段为空时保存配置应该提示警告", () => {
    const { result } = renderForm();

    act(() => result.current.handleStartAdd());
    act(() => result.current.handleSaveConfig());
    expect(toast.warning).toHaveBeenCalledWith("请输入别名");

    act(() => result.current.setAliasInput("Ollama"));
    act(() => result.current.handleSaveConfig());
    expect(toast.warning).toHaveBeenCalledWith("请输入接口地址");

    act(() => result.current.setApiEndpointInput("http://localhost:11434"));
    act(() => result.current.handleSaveConfig());
    expect(toast.warning).toHaveBeenCalledWith("请输入 API 密钥");
  });

  it("AI 配置别名重复时保存配置应该提示警告", () => {
    const { result } = renderForm();

    act(() =>
      result.current.applySettings(
        makeSettings({ ai_configs: [makeConfig()] }),
      ),
    );

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("deepseek"));
    act(() => result.current.setApiEndpointInput("http://localhost:11434"));
    act(() => result.current.setApiKeyInput("sk-123"));
    act(() => result.current.handleSaveConfig());

    expect(toast.warning).toHaveBeenCalledWith("该别名已存在，请使用其他别名");
    expect(result.current.aiConfigs).toHaveLength(1);
  });

  it("添加新的 AI 配置成功后应该追加到列表", () => {
    const { result } = renderForm();

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("Ollama"));
    act(() => result.current.setApiEndpointInput("http://localhost:11434"));
    act(() => result.current.setApiKeyInput("sk-123"));
    act(() => result.current.setModelInput("llama3"));
    act(() => result.current.handleSaveConfig());

    expect(result.current.aiConfigs).toHaveLength(1);
    expect(result.current.aiConfigs[0].alias).toBe("Ollama");
    expect(result.current.editingIndex).toBe(null);
  });

  it("编辑 AI 配置时应该预填输入并保存修改", () => {
    const { result } = renderForm();

    act(() =>
      result.current.applySettings(
        makeSettings({ ai_configs: [makeConfig()] }),
      ),
    );

    act(() => result.current.handleStartEdit(0));

    expect(result.current.aliasInput).toBe("DeepSeek");
    expect(result.current.apiEndpointInput).toBe("http://127.0.0.1:11434/v1");
    expect(result.current.apiKeyInput).toBe("sk-test");
    expect(result.current.modelInput).toBe("deepseek-chat");

    act(() => result.current.setAliasInput("Ollama"));
    act(() => result.current.handleSaveConfig());

    expect(result.current.aiConfigs[0].alias).toBe("Ollama");
    expect(result.current.editingIndex).toBe(null);
  });

  it("取消编辑时应该重置编辑索引", () => {
    const { result } = renderForm();

    act(() => result.current.handleStartAdd());
    expect(result.current.editingIndex).toBe(-1);

    act(() => result.current.handleCancelEdit());
    expect(result.current.editingIndex).toBe(null);
  });

  it("删除配置时应该移除并修正编辑索引", () => {
    const { result } = renderForm();

    act(() =>
      result.current.applySettings(
        makeSettings({
          ai_configs: [
            makeConfig({ alias: NonEmptyStringSchema.parse("A") }),
            makeConfig({ alias: NonEmptyStringSchema.parse("B") }),
            makeConfig({ alias: NonEmptyStringSchema.parse("C") }),
          ],
        }),
      ),
    );

    act(() => result.current.handleStartEdit(2));
    act(() => result.current.handleDeleteConfig(1));

    expect(result.current.aiConfigs.map((c) => c.alias)).toEqual(["A", "C"]);
    expect(result.current.editingIndex).toBe(1);

    act(() => result.current.handleDeleteConfig(0));
    expect(result.current.aiConfigs.map((c) => c.alias)).toEqual(["C"]);
  });

  it("删除编辑目标之后的配置时应该保留编辑索引", () => {
    const { result } = renderForm();

    act(() =>
      result.current.applySettings(
        makeSettings({
          ai_configs: [
            makeConfig({ alias: NonEmptyStringSchema.parse("A") }),
            makeConfig({ alias: NonEmptyStringSchema.parse("B") }),
            makeConfig({ alias: NonEmptyStringSchema.parse("C") }),
          ],
        }),
      ),
    );

    act(() => result.current.handleStartEdit(0));
    act(() => result.current.handleDeleteConfig(2));

    expect(result.current.aiConfigs.map((c) => c.alias)).toEqual(["A", "B"]);
    expect(result.current.editingIndex).toBe(0);
  });

  it("删除正在编辑的配置时应该重置编辑索引", () => {
    const { result } = renderForm();

    act(() =>
      result.current.applySettings(
        makeSettings({
          ai_configs: [
            makeConfig({ alias: NonEmptyStringSchema.parse("A") }),
            makeConfig({ alias: NonEmptyStringSchema.parse("B") }),
          ],
        }),
      ),
    );

    act(() => result.current.handleStartEdit(1));
    act(() => result.current.handleDeleteConfig(1));

    expect(result.current.editingIndex).toBe(null);
  });

  it("编辑目标不存在时不做处理", () => {
    const { result } = renderForm();

    act(() => result.current.handleStartEdit(0));

    expect(result.current.editingIndex).toBe(null);
  });
});
