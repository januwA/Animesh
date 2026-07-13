import { describe, expect, it, vi } from "vitest";
import type { AiClient } from "../../domain/ai/AiClient";
import { VerifyAiConnectionUseCase } from "./VerifyAiConnectionUseCase";

describe("VerifyAiConnectionUseCase AI 连接验证", () => {
	const mockAiClient = {
		post: vi.fn(),
	} as unknown as AiClient;

	it("当接口地址为空时，应该抛出错误", async () => {
		const useCase = new VerifyAiConnectionUseCase(mockAiClient);
		await expect(
			useCase.execute({
				apiEndpoint: "",
				apiKey: "valid-key",
			}),
		).rejects.toThrow("请输入 AI 接口地址");
	});

	it("当 API 密钥为空时，应该抛出错误", async () => {
		const useCase = new VerifyAiConnectionUseCase(mockAiClient);
		await expect(
			useCase.execute({
				apiEndpoint: "https://api.openai.com/v1",
				apiKey: " ",
			}),
		).rejects.toThrow("请输入 API 密钥");
	});

	it("当接口正常响应且包含 choices 时，应该成功完成", async () => {
		const useCase = new VerifyAiConnectionUseCase(mockAiClient);
		vi.mocked(mockAiClient.post).mockResolvedValueOnce({
			choices: [{ message: { role: "assistant", content: "Pong" } }],
		});

		await expect(
			useCase.execute({
				apiEndpoint: "https://api.openai.com/v1",
				apiKey: "valid-key",
				model: "gpt-4o",
			}),
		).resolves.not.toThrow();

		expect(mockAiClient.post).toHaveBeenCalledWith(
			"https://api.openai.com/v1",
			"valid-key",
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

	it("当模型名称未传时，应该使用默认的 gpt-3.5-turbo", async () => {
		const useCase = new VerifyAiConnectionUseCase(mockAiClient);
		vi.mocked(mockAiClient.post).mockResolvedValueOnce({
			choices: [{ message: { role: "assistant", content: "Pong" } }],
		});

		await useCase.execute({
			apiEndpoint: "https://api.openai.com/v1",
			apiKey: "valid-key",
		});

		expect(mockAiClient.post).toHaveBeenCalledWith(
			"https://api.openai.com/v1",
			"valid-key",
			{
				model: "gpt-3.5-turbo",
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
				apiEndpoint: "https://api.openai.com/v1",
				apiKey: "valid-key",
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
				apiEndpoint: "https://api.openai.com/v1",
				apiKey: "valid-key",
			}),
		).rejects.toThrow("Network Error");
	});
});
