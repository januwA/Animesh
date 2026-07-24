import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { COLLECTION_STORAGE_KEY } from "@/domain/collection/CollectionSchemas";
import { LocalStorageCollectionRepository } from "@/infrastructure/collection/LocalStorageCollectionRepository";
import { FavoriteButton } from "./FavoriteButton";

function createContainer(): DIContainer {
	const collectionRepository = new LocalStorageCollectionRepository();
	return {
		collectionRepository,
	} as unknown as DIContainer;
}

describe("FavoriteButton 收藏按钮", () => {
	const mockSubject = {
		subjectId: 101,
		name: "Original Name",
		nameCn: "中文名称",
		imageUrl: "https://example.com/image.jpg",
		rating: 8.5,
		platform: "TV",
		date: "2026-07-01",
		summary: "剧情简介",
	};

	function renderWithProvider() {
		const container = createContainer();
		return render(
			<DIProvider value={container}>
				<FavoriteButton subject={mockSubject} />
			</DIProvider>,
		);
	}

	beforeEach(() => {
		localStorage.clear();
	});

	it("初始状态应该显示'收藏'文字", () => {
		renderWithProvider();
		expect(screen.getByText("收藏")).toBeInTheDocument();
	});

	it("点击未收藏按钮后应显示已收藏", () => {
		renderWithProvider();
		act(() => screen.getByRole("button").click());
		expect(screen.getByText("已收藏")).toBeInTheDocument();
	});

	it("已收藏状态下点击按钮应取消收藏", () => {
		localStorage.setItem(
			COLLECTION_STORAGE_KEY,
			JSON.stringify({
				items: [
					{
						subjectId: mockSubject.subjectId,
						name: "Original",
						nameCn: "已收藏",
						imageUrl: null,
						rating: null,
						platform: null,
						date: null,
						summary: null,
						addedAt: Date.now(),
					},
				],
				lastUpdatedAt: Date.now(),
			}),
		);
		renderWithProvider();
		act(() => screen.getByRole("button").click());
		expect(screen.getByText("收藏")).toBeInTheDocument();
	});
});
