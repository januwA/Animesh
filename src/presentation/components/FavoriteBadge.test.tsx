import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { DIContainer } from "@/di/DIContext";
import { DIProvider } from "@/di/DIContext";
import { COLLECTION_STORAGE_KEY } from "@/domain/collection/CollectionSchemas";
import { LocalStorageCollectionRepository } from "@/infrastructure/collection/LocalStorageCollectionRepository";
import { FavoriteBadge } from "./FavoriteBadge";

function createContainer(): DIContainer {
	const collectionRepository = new LocalStorageCollectionRepository();
	return {
		collectionRepository,
	} as unknown as DIContainer;
}

describe("FavoriteBadge 收藏徽标", () => {
	const subjectId = 101;

	beforeEach(() => {
		localStorage.clear();
	});

	it("当未收藏时不应渲染", () => {
		const container = createContainer();
		const { container: dom } = render(
			<DIProvider value={container}>
				<FavoriteBadge subjectId={subjectId} />
			</DIProvider>,
		);
		expect(dom.querySelector(".h-6.w-6")).toBeNull();
	});

	it("当已收藏时应渲染心形图标", () => {
		localStorage.setItem(
			COLLECTION_STORAGE_KEY,
			JSON.stringify({
				items: [
					{
						subjectId,
						name: "Name",
						nameCn: "名称",
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
		const container = createContainer();
		const { container: dom } = render(
			<DIProvider value={container}>
				<FavoriteBadge subjectId={subjectId} />
			</DIProvider>,
		);
		const badge = dom.querySelector(".absolute");
		expect(badge).toBeInTheDocument();
	});
});
