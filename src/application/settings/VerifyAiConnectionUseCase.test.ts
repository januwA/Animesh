import { describe, expect, it, vi } from "vitest";
import { NonEmptyStringSchema } from "@/domain/common/NonEmptyString";
import type { AiClient } from "../../domain/ai/AiClient";
import { VerifyAiConnectionUseCase } from "./VerifyAiConnectionUseCase";

describe("VerifyAiConnectionUseCase AI 连接验证", () => {
  const mockAiClient = {
    post: vi.fn(),
  } as unknown as AiClient;

  it("当接口正常响应且包含 choices 时，应该成功完成", async () => {
    const useCase = new VerifyAiConnectionUseCase(mockAiClient);
    vi.mocked(mockAiClient.post).mockResolvedValueOnce({
      choices: [{ message: { role: "assistant", content: "Pong" } }],
    });

    await expect(
      useCase.execute({
        api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
        api_key: NonEmptyStringSchema.parse("valid-key"),
        ai_model: NonEmptyStringSchema.parse("gpt-4o"),
        alias: NonEmptyStringSchema.parse("test"),
      }),
    ).resolves.not.toThrow();

    expect(mockAiClient.post).toHaveBeenCalledWith(
      NonEmptyStringSchema.parse("https://api.openai.com/v1"),
      NonEmptyStringSchema.parse("valid-key"),
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: "Ping",
          },
        ],
        temperature: 0.1,
        max_tokens: 5,
      },
    );
  });

  it("当响应中无 choices 或 choices 为空时，应该抛出错误", async () => {
    const useCase = new VerifyAiConnectionUseCase(mockAiClient);
    vi.mocked(mockAiClient.post).mockResolvedValueOnce({});

    await expect(
      useCase.execute({
        api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
        api_key: NonEmptyStringSchema.parse("valid-key"),
        alias: NonEmptyStringSchema.parse("test"),
        ai_model: NonEmptyStringSchema.parse("test_model"),
      }),
    ).rejects.toThrow("模型服务未返回有效响应，请检查配置");
  });

  it("当 AI 客户端请求异常时，应该直接抛出客户端的错误", async () => {
    const useCase = new VerifyAiConnectionUseCase(mockAiClient);
    vi.mocked(mockAiClient.post).mockRejectedValueOnce(
      new Error("Network Error"),
    );

    await expect(
      useCase.execute({
        api_endpoint: NonEmptyStringSchema.parse("https://api.openai.com/v1"),
        api_key: NonEmptyStringSchema.parse("valid-key"),
        alias: NonEmptyStringSchema.parse("test"),
        ai_model: NonEmptyStringSchema.parse("test_model"),
      }),
    ).rejects.toThrow("Network Error");
  });
});
