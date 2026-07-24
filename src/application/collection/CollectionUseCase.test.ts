import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectionRepository } from "@/domain/collection/CollectionRepository";
import { AddFavoriteUseCase } from "./AddFavoriteUseCase";
import { GetCollectionsUseCase } from "./GetCollectionsUseCase";
import { GetFavoriteStatusUseCase } from "./GetFavoriteStatusUseCase";
import { RemoveFavoriteUseCase } from "./RemoveFavoriteUseCase";

describe("收藏相关的 UseCase 业务编排", () => {
	const mockRepo = {
		getAll: vi.fn(),
		isFavorited: vi.fn(),
		add: vi.fn(),
		remove: vi.fn(),
	} as unknown as CollectionRepository;

	beforeEach(() => {
		vi.resetAllMocks();
	});

	describe("GetCollectionsUseCase 获取所有收藏", () => {
		it("应该调用 repo.getAll() 并返回结果", () => {
			const fakeData = [{ subjectId: 1 }] as any;
			vi.mocked(mockRepo.getAll).mockReturnValue(fakeData);

			const useCase = new GetCollectionsUseCase(mockRepo);
			const result = useCase.execute();

			expect(mockRepo.getAll).toHaveBeenCalledOnce();
			expect(result).toBe(fakeData);
		});
	});

	describe("AddFavoriteUseCase 添加收藏", () => {
		it("应该添加收藏条目", () => {
			const useCase = new AddFavoriteUseCase(mockRepo);
			const item = {
				subjectId: 101,
				name: "Name",
				nameCn: "名称",
				imageUrl: null,
				rating: null,
				platform: null,
				date: null,
				summary: null,
			};

			useCase.execute(item);

			expect(mockRepo.add).toHaveBeenCalledWith(item);
		});
	});

	describe("RemoveFavoriteUseCase 移除收藏", () => {
		it("应该使用 subjectId 调用 repo.remove()", () => {
			const useCase = new RemoveFavoriteUseCase(mockRepo);
			useCase.execute(101);

			expect(mockRepo.remove).toHaveBeenCalledWith(101);
		});
	});

	describe("GetFavoriteStatusUseCase 查询收藏状态", () => {
		it("当条目已被收藏时应该返回 true", () => {
			vi.mocked(mockRepo.isFavorited).mockReturnValue(true);

			const useCase = new GetFavoriteStatusUseCase(mockRepo);
			const result = useCase.execute(101);

			expect(result).toBe(true);
		});

		it("当条目未被收藏时应该返回 false", () => {
			vi.mocked(mockRepo.isFavorited).mockReturnValue(false);

			const useCase = new GetFavoriteStatusUseCase(mockRepo);
			const result = useCase.execute(101);

			expect(result).toBe(false);
		});
	});
});
