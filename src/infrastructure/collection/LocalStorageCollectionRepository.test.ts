import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageCollectionRepository } from "./LocalStorageCollectionRepository";

describe("LocalStorageCollectionRepository 本地存储收藏仓库", () => {
	let repo: LocalStorageCollectionRepository;

	beforeEach(() => {
		localStorage.clear();
		repo = new LocalStorageCollectionRepository();
	});

	const mockItem = {
		subjectId: 101,
		name: "Original Name",
		nameCn: "中文名称",
		imageUrl: "https://example.com/image.jpg",
		rating: 8.5,
		platform: "TV",
		date: "2026-07-01",
		summary: "剧情简介",
	};

	it("当无数据时应返回空列表", () => {
		expect(repo.getAll()).toEqual([]);
	});

	it("添加收藏后应能在列表中查到", () => {
		repo.add(mockItem);
		expect(repo.getAll()).toHaveLength(1);
		expect(repo.isFavorited(101)).toBe(true);
	});

	it("添加重复 subjectId 不应重复添加", () => {
		repo.add(mockItem);
		repo.add(mockItem);
		expect(repo.getAll()).toHaveLength(1);
	});

	it("移除收藏后应正确删除", () => {
		repo.add(mockItem);
		repo.remove(101);
		expect(repo.isFavorited(101)).toBe(false);
		expect(repo.getAll()).toHaveLength(0);
	});

	it("查询不存在的 subjectId 应返回 false", () => {
		expect(repo.isFavorited(999)).toBe(false);
	});

	it("移除不存在的 subjectId 不应报错", () => {
		expect(() => repo.remove(999)).not.toThrow();
	});

	it("当 localStorage 数据损坏时应返回空状态", () => {
		localStorage.setItem("animesh:collections", "invalid-json");
		expect(repo.getAll()).toEqual([]);
	});

	it("当 localStorage 数据结构不匹配时应返回空状态", () => {
		localStorage.setItem(
			"animesh:collections",
			JSON.stringify({ invalid: true }),
		);
		expect(repo.getAll()).toEqual([]);
	});
});
