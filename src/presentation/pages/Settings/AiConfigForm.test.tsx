import { zodResolver } from "@hookform/resolvers/zod";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useForm } from "react-hook-form";
import { vi } from "vitest";
import type {
  AiConfig,
  AiConfigInput,
} from "@/domain/settings/SettingsSchemas";
import { AiConfigSchema } from "@/domain/settings/SettingsSchemas";
import { AiConfigForm } from "./AiConfigForm";

const makeConfig = (overrides: Partial<AiConfig> = {}): AiConfig =>
  ({
    alias: "DeepSeek",
    api_endpoint: "http://127.0.0.1:11434/v1",
    api_key: "sk-test",
    ai_model: "deepseek-chat",
    ...overrides,
  }) as AiConfig;

function renderForm(
  overrides: Partial<Parameters<typeof AiConfigForm>[0]> = {},
  defaultValues?: Partial<AiConfigInput>,
) {
  function Wrapper() {
    const form = useForm<AiConfigInput>({
      defaultValues: {
        alias: "",
        api_endpoint: "",
        api_key: "",
        ai_model: "",
        ...defaultValues,
      },
    });

    return (
      <AiConfigForm
        form={form}
        editingIndex={-1}
        aiConfigs={[]}
        testingAi={false}
        onTestConnection={vi.fn()}
        onCancel={vi.fn()}
        onSave={vi.fn()}
        {...overrides}
      />
    );
  }

  return render(<Wrapper />);
}

describe("AiConfigForm AI 配置表单组件", () => {
  it("添加模式下应该渲染添加标题", () => {
    renderForm();

    expect(screen.getByText("添加 AI 配置")).toBeInTheDocument();
  });

  it("编辑模式下应该渲染编辑标题与预填值", () => {
    renderForm(
      {
        editingIndex: 0,
        aiConfigs: [makeConfig()],
      },
      {
        alias: "DeepSeek",
        api_endpoint: "http://127.0.0.1:11434/v1",
        api_key: "sk-test",
        ai_model: "deepseek-chat",
      },
    );

    expect(screen.getByText("编辑 AI 配置: DeepSeek")).toBeInTheDocument();
    expect(screen.getByLabelText("配置别名 (Alias) *")).toHaveValue("DeepSeek");
    expect(screen.getByLabelText("AI 接口地址 (Endpoint) *")).toHaveValue(
      "http://127.0.0.1:11434/v1",
    );
    expect(screen.getByLabelText("API 密钥 (API Key) *")).toHaveValue(
      "sk-test",
    );
    expect(screen.getByLabelText("模型名称 (Model)")).toHaveValue(
      "deepseek-chat",
    );
  });

  it("点击测试/取消/保存按钮时应该触发对应回调", () => {
    const onTestConnection = vi.fn();
    const onCancel = vi.fn();
    const onSave = vi.fn();
    renderForm({ onTestConnection, onCancel, onSave });

    fireEvent.click(screen.getByRole("button", { name: "测试模型连接" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    expect(onTestConnection).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });

  it("测试中时应该显示正在测试状态", () => {
    renderForm({ testingAi: true });

    expect(screen.getByText("正在测试连接...")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "正在测试连接..." }),
    ).toBeDisabled();
  });

  it("表单验证失败时应该显示各字段的错误信息", async () => {
    let formInstance: ReturnType<typeof useForm<AiConfigInput>>;

    function Wrapper() {
      formInstance = useForm<AiConfigInput>({
        resolver: zodResolver(AiConfigSchema),
        defaultValues: {
          alias: "",
          api_endpoint: "",
          api_key: "",
          ai_model: "",
        },
      });
      return (
        <AiConfigForm
          form={formInstance}
          editingIndex={-1}
          aiConfigs={[]}
          testingAi={false}
          onTestConnection={vi.fn()}
          onCancel={vi.fn()}
          onSave={vi.fn()}
        />
      );
    }

    render(<Wrapper />);
    await act(async () => {
      await formInstance!.trigger();
    });

    await waitFor(() => {
      expect(screen.getAllByText("不能为空字符串")).toHaveLength(4);
    });
  });
});
