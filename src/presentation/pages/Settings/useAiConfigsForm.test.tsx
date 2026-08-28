import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { type DIContainer, DIContext } from "@/di/DIContext";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import { useAiConfigsForm } from "./useAiConfigsForm";

function makeDI(overrides?: Partial<DIContainer>): DIContainer {
  return {
    getAiConfigsUseCase: {
      execute: vi.fn().mockResolvedValue({ aiConfigs: [] }),
    },
    setAiConfigsUseCase: { execute: vi.fn().mockResolvedValue(undefined) },
    verifyAiConnectionUseCase: {
      execute: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  } as unknown as DIContainer;
}

function createWrapper(mockDI: DIContainer) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <DIContext value={mockDI}>{children}</DIContext>;
  };
}

describe("useAiConfigsForm AI 配置表单 hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应加载 AI 配置列表", async () => {
    const configs = [
      {
        alias: "DeepSeek",
        api_endpoint: "http://test",
        api_key: "sk-1",
        ai_model: "deepseek",
      },
    ];
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: configs }),
      },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.aiConfigs).toEqual(configs);
  });

  it("handleStartAdd 应进入添加模式", async () => {
    const mockDI = makeDI();
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());

    expect(result.current.editingIndex).toBe(-1);
    expect(result.current.aliasInput).toBe("");
    expect(result.current.apiEndpointInput).toBe("");
    expect(result.current.apiKeyInput).toBe("");
    expect(result.current.modelInput).toBe("");
  });

  it("handleStartEdit 应进入编辑模式并预填值", async () => {
    const config = {
      alias: "DeepSeek",
      api_endpoint: "http://test",
      api_key: "sk-1",
      ai_model: "deepseek",
    };
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [config] }),
      },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
    });

    act(() => result.current.handleStartEdit(0));

    expect(result.current.editingIndex).toBe(0);
    expect(result.current.aliasInput).toBe("DeepSeek");
    expect(result.current.apiEndpointInput).toBe("http://test");
    expect(result.current.apiKeyInput).toBe("sk-1");
    expect(result.current.modelInput).toBe("deepseek");
  });

  it("handleCancelEdit 应退出编辑模式", async () => {
    const mockDI = makeDI();
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.handleCancelEdit());

    expect(result.current.editingIndex).toBeNull();
  });

  it("handleDeleteConfig 应删除配置并保存", async () => {
    const config = {
      alias: "DeepSeek",
      api_endpoint: "http://test",
      api_key: "sk-1",
      ai_model: "deepseek",
    };
    const saveExecute = vi.fn().mockResolvedValue(undefined);
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [config] }),
      },
      setAiConfigsUseCase: { execute: saveExecute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
    });

    await act(async () => {
      result.current.handleDeleteConfig(0);
    });

    expect(result.current.aiConfigs).toHaveLength(0);
    expect(saveExecute).toHaveBeenCalledWith([]);
  });

  it("删除当前编辑的配置应退出编辑模式", async () => {
    const config = {
      alias: "DeepSeek",
      api_endpoint: "http://test",
      api_key: "sk-1",
      ai_model: "deepseek",
    };
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [config] }),
      },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
    });

    act(() => result.current.handleStartEdit(0));
    await act(async () => {
      result.current.handleDeleteConfig(0);
    });

    expect(result.current.editingIndex).toBeNull();
  });

  it("删除编辑中之前的配置应调整 editingIndex", async () => {
    const configs = [
      { alias: "A", api_endpoint: "http://a", api_key: "sk-a", ai_model: "a" },
      { alias: "B", api_endpoint: "http://b", api_key: "sk-b", ai_model: "b" },
    ];
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: configs }),
      },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(2);
    });

    act(() => result.current.handleStartEdit(1));
    await act(async () => {
      result.current.handleDeleteConfig(0);
    });

    expect(result.current.editingIndex).toBe(0);
  });

  it("handleSaveConfig 别名为空时应提示警告", async () => {
    const mockDI = makeDI();
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.handleSaveConfig());

    expect(toast.warning).toHaveBeenCalledWith("请输入别名");
  });

  it("handleSaveConfig 接口地址为空时应提示警告", async () => {
    const mockDI = makeDI();
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("test"));
    act(() => result.current.handleSaveConfig());

    expect(toast.warning).toHaveBeenCalledWith("请输入接口地址");
  });

  it("handleSaveConfig API 密钥为空时应提示警告", async () => {
    const mockDI = makeDI();
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("test"));
    act(() => result.current.setApiEndpointInput("http://test"));
    act(() => result.current.handleSaveConfig());

    expect(toast.warning).toHaveBeenCalledWith("请输入 API 密钥");
  });

  it("handleSaveConfig 别名重复时应提示警告", async () => {
    const config = {
      alias: "DeepSeek",
      api_endpoint: "http://test",
      api_key: "sk-1",
      ai_model: "deepseek",
    };
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [config] }),
      },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("DeepSeek"));
    act(() => result.current.setApiEndpointInput("http://new"));
    act(() => result.current.setApiKeyInput("sk-new"));
    act(() => result.current.handleSaveConfig());

    expect(toast.warning).toHaveBeenCalledWith("该别名已存在，请使用其他别名");
  });

  it("handleSaveConfig 添加模式应追加配置", async () => {
    const saveExecute = vi.fn().mockResolvedValue(undefined);
    const mockDI = makeDI({
      setAiConfigsUseCase: { execute: saveExecute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("NewAI"));
    act(() => result.current.setApiEndpointInput("http://new"));
    act(() => result.current.setApiKeyInput("sk-new"));
    act(() => result.current.setModelInput("model-v1"));
    await act(async () => {
      result.current.handleSaveConfig();
    });

    expect(saveExecute).toHaveBeenCalledWith([
      {
        alias: "NewAI",
        api_endpoint: "http://new",
        api_key: "sk-new",
        ai_model: "model-v1",
      },
    ]);
    expect(result.current.editingIndex).toBeNull();
  });

  it("handleSaveConfig 编辑模式应更新配置", async () => {
    const config = {
      alias: "DeepSeek",
      api_endpoint: "http://test",
      api_key: "sk-1",
      ai_model: "deepseek",
    };
    const saveExecute = vi.fn().mockResolvedValue(undefined);
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [config] }),
      },
      setAiConfigsUseCase: { execute: saveExecute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
    });

    act(() => result.current.handleStartEdit(0));
    act(() => result.current.setAliasInput("Updated"));
    await act(async () => {
      result.current.handleSaveConfig();
    });

    expect(saveExecute).toHaveBeenCalledWith([
      {
        alias: "Updated",
        api_endpoint: "http://test",
        api_key: "sk-1",
        ai_model: "deepseek",
      },
    ]);
  });

  it("handleTestConfig 应调用 verifyAiConnectionUseCase", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const mockDI = makeDI({
      verifyAiConnectionUseCase: { execute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const config = {
      alias: NonEmptyStringSchema.parse("DeepSeek"),
      api_endpoint: NonEmptyStringSchema.parse("http://test"),
      api_key: NonEmptyStringSchema.parse("sk-1"),
      ai_model: NonEmptyStringSchema.parse("deepseek"),
    };
    act(() => result.current.handleTestConfig(config));

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith(config);
    });
  });

  it("handleTestCurrentConnection 接口地址为空时应提示警告", async () => {
    const mockDI = makeDI();
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.handleTestCurrentConnection());

    expect(toast.warning).toHaveBeenCalledWith("请输入 AI 接口地址");
  });

  it("handleTestCurrentConnection API 密钥为空时应提示警告", async () => {
    const mockDI = makeDI();
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setApiEndpointInput("http://test"));
    act(() => result.current.handleTestCurrentConnection());

    expect(toast.warning).toHaveBeenCalledWith("请输入 API 密钥");
  });

  it("handleTestCurrentConnection 应构造配置并调用验证", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const mockDI = makeDI({
      verifyAiConnectionUseCase: { execute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("TestAI"));
    act(() => result.current.setApiEndpointInput("http://test"));
    act(() => result.current.setApiKeyInput("sk-test"));
    act(() => result.current.setModelInput("model-v1"));
    act(() => result.current.handleTestCurrentConnection());

    await waitFor(() => {
      expect(execute).toHaveBeenCalledWith({
        alias: "TestAI",
        api_endpoint: "http://test",
        api_key: "sk-test",
        ai_model: "model-v1",
      });
    });
  });

  it("测试连接中时 testingAi 应为 true", async () => {
    const execute = vi.fn().mockImplementation(() => new Promise(() => {}));
    const mockDI = makeDI({
      verifyAiConnectionUseCase: { execute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const config = {
      alias: NonEmptyStringSchema.parse("DeepSeek"),
      api_endpoint: NonEmptyStringSchema.parse("http://test"),
      api_key: NonEmptyStringSchema.parse("sk-1"),
      ai_model: NonEmptyStringSchema.parse("deepseek"),
    };
    act(() => result.current.handleTestConfig(config));

    await waitFor(() => {
      expect(result.current.testingAi).toBe(true);
    });
  });

  it("别名大小写不敏感的重复检查", async () => {
    const config = {
      alias: "deepseek",
      api_endpoint: "http://test",
      api_key: "sk-1",
      ai_model: "deepseek",
    };
    const mockDI = makeDI({
      getAiConfigsUseCase: {
        execute: vi.fn().mockResolvedValue({ aiConfigs: [config] }),
      },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.aiConfigs).toHaveLength(1);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("DeepSeek"));
    act(() => result.current.setApiEndpointInput("http://new"));
    act(() => result.current.setApiKeyInput("sk-new"));
    act(() => result.current.handleSaveConfig());

    expect(toast.warning).toHaveBeenCalledWith("该别名已存在，请使用其他别名");
  });

  it("保存配置失败时应显示错误提示", async () => {
    const saveExecute = vi.fn().mockRejectedValue(new Error("保存出错"));
    const mockDI = makeDI({
      setAiConfigsUseCase: { execute: saveExecute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => result.current.handleStartAdd());
    act(() => result.current.setAliasInput("NewAI"));
    act(() => result.current.setApiEndpointInput("http://new"));
    act(() => result.current.setApiKeyInput("sk-new"));
    act(() => result.current.setModelInput("model-v1"));
    await act(async () => {
      result.current.handleSaveConfig();
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("保存失败: 保存出错");
    });
  });

  it("测试连接失败时应显示错误提示", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("连接超时"));
    const mockDI = makeDI({
      verifyAiConnectionUseCase: { execute },
    } as unknown as DIContainer);
    const { result } = renderHook(() => useAiConfigsForm(), {
      wrapper: createWrapper(mockDI),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const config = {
      alias: NonEmptyStringSchema.parse("DeepSeek"),
      api_endpoint: NonEmptyStringSchema.parse("http://test"),
      api_key: NonEmptyStringSchema.parse("sk-1"),
      ai_model: NonEmptyStringSchema.parse("deepseek"),
    };
    await act(async () => {
      result.current.handleTestConfig(config);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "AI 模型连接测试失败: 连接超时",
        {
          duration: 5000,
        },
      );
    });
  });
});
