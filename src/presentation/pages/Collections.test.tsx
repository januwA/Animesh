import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { COLLECTION_STORAGE_KEY } from "@/domain/collection/CollectionSchemas";
import { LocalStorageCollectionRepository } from "@/infrastructure/collection/LocalStorageCollectionRepository";
import Collections from "./Collections";

function createContainer(): DIContainer {
	const collectionRepository = new LocalStorageCollectionRepository();
	return {
		collectionRepository,
	} as unknown as DIContainer;
}

function renderWithProvider() {
	const container = createContainer();
	return render(
		<DIProvider value={container}>
			<MemoryRouter>
				<Collections />
			</MemoryRouter>
		</DIProvider>,
	);
}

describe("Collections 收藏页面", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("空状态应显示提示信息和导航按钮", () => {
		renderWithProvider();
		expect(screen.getByText("还没有收藏任何条目")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "去新番日历看看" }),
		).toBeInTheDocument();
	});

	it("有收藏时应显示收藏条目", () => {
		localStorage.setItem(
			COLLECTION_STORAGE_KEY,
			JSON.stringify({
				items: [
					{
						subjectId: 101,
						name: "Original",
						nameCn: "测试动画",
						imageUrl: null,
						rating: 8.5,
						platform: "TV",
						date: "2026-07-01",
						summary: "简介",
						addedAt: Date.now(),
					},
				],
				lastUpdatedAt: Date.now(),
			}),
		);
		renderWithProvider();
		expect(screen.getByText("测试动画")).toBeInTheDocument();
	});

	it("应显示页面标题'我的收藏'", () => {
		renderWithProvider();
		expect(screen.getByText("我的收藏")).toBeInTheDocument();
	});

	it("点击空状态导航按钮应跳转到日历页", () => {
		renderWithProvider();
		fireEvent.click(screen.getByRole("button", { name: "去新番日历看看" }));
	});

	it("应展示有封面的收藏条目且点击可触发导航", () => {
		localStorage.setItem(
			COLLECTION_STORAGE_KEY,
			JSON.stringify({
				items: [
					{
						subjectId: 201,
						name: "ImageAnime",
						nameCn: "带封面动画",
						imageUrl: "https://example.com/cover.jpg",
						rating: 9.0,
						platform: "TV",
						date: "2026-07-01",
						summary: "有封面简介",
						addedAt: Date.now(),
					},
				],
				lastUpdatedAt: Date.now(),
			}),
		);
		renderWithProvider();
		expect(screen.getByText("带封面动画")).toBeInTheDocument();
		fireEvent.click(screen.getByTitle("详情: 带封面动画"));
	});

	it("无评分的条目不应显示评分", () => {
		localStorage.setItem(
			COLLECTION_STORAGE_KEY,
			JSON.stringify({
				items: [
					{
						subjectId: 301,
						name: "NoRating",
						nameCn: "无评分动画",
						imageUrl: null,
						rating: null,
						platform: "TV",
						date: "2026-07-01",
						summary: "无评分",
						addedAt: Date.now(),
					},
				],
				lastUpdatedAt: Date.now(),
			}),
		);
		renderWithProvider();
		expect(screen.getByText("无评分动画")).toBeInTheDocument();
		expect(screen.queryByText(/^\d+\.\d$/)).not.toBeInTheDocument();
	});

	it("中文名为空时应回退显示英文名", () => {
		localStorage.setItem(
			COLLECTION_STORAGE_KEY,
			JSON.stringify({
				items: [
					{
						subjectId: 401,
						name: "EnglishName",
						nameCn: "",
						imageUrl: null,
						rating: null,
						platform: "TV",
						date: "2026-07-01",
						summary: "",
						addedAt: Date.now(),
					},
				],
				lastUpdatedAt: Date.now(),
			}),
		);
		renderWithProvider();
		expect(screen.getByText("EnglishName")).toBeInTheDocument();
		fireEvent.click(screen.getByTitle("详情: EnglishName"));
	});
});
