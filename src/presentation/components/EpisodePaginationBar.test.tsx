import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EpisodePaginationBar } from "./EpisodePaginationBar";

describe("EpisodePaginationBar 剧集分页栏", () => {
	const defaultProps = {
		page: 1,
		totalPages: 3,
		total: 103,
		onPageChange: vi.fn(),
		onJumpToEpisode: vi.fn(),
	};

	const renderBar = (props: Partial<typeof defaultProps> = {}) =>
		render(<EpisodePaginationBar {...defaultProps} {...props} />);

	const getEllipsisCount = () =>
		document.querySelectorAll('[data-slot="pagination-ellipsis"]').length;

	it("应该展示总集数与当前页码概览", () => {
		renderBar();
		expect(screen.getByText("共 103 集 · 第 1 / 3 页")).toBeInTheDocument();
	});

	it("总页数不超过 7 页时应该直接展示所有页码按钮", () => {
		renderBar({ page: 2, totalPages: 5 });
		expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
		expect(getEllipsisCount()).toBe(0);
	});

	it("总页数超过 7 页时应该使用省略号窗口展示页码", () => {
		renderBar({ page: 5, totalPages: 10 });

		expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "6" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
		expect(getEllipsisCount()).toBe(2);
	});

	it("当前页靠近开头时只在末尾显示省略号", () => {
		renderBar({ page: 2, totalPages: 10 });

		expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
		expect(getEllipsisCount()).toBe(1);
	});

	it("当前页靠近末尾时不再显示末尾省略号", () => {
		renderBar({ page: 9, totalPages: 10 });

		expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "9" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
		expect(getEllipsisCount()).toBe(1);
	});

	it("位于第一页时上一页按钮禁用，下一页按钮可用并触发回调", () => {
		const onPageChange = vi.fn();
		renderBar({ page: 1, totalPages: 3, onPageChange });

		expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();

		fireEvent.click(screen.getByRole("button", { name: "下一页" }));
		expect(onPageChange).toHaveBeenCalledWith(2);
	});

	it("位于最后一页时下一页按钮禁用，上一页按钮可用并触发回调", () => {
		const onPageChange = vi.fn();
		renderBar({ page: 3, totalPages: 3, onPageChange });

		expect(screen.getByRole("button", { name: "下一页" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "上一页" })).toBeEnabled();

		fireEvent.click(screen.getByRole("button", { name: "上一页" }));
		expect(onPageChange).toHaveBeenCalledWith(2);
	});

	it("点击页码按钮时应该触发对应页回调，当前页使用高亮样式", () => {
		const onPageChange = vi.fn();
		renderBar({ page: 2, totalPages: 3, onPageChange });

		const activeButton = screen.getByRole("button", { name: "2" });
		expect(activeButton).toHaveAttribute("data-variant", "outline");

		fireEvent.click(screen.getByRole("button", { name: "3" }));
		expect(onPageChange).toHaveBeenCalledWith(3);
	});

	it("页码跳转输入超出范围时应该被钳制在有效页内", () => {
		const onPageChange = vi.fn();
		renderBar({ page: 1, totalPages: 3, onPageChange });

		const pageInput = screen.getByLabelText("跳转页码");
		fireEvent.change(pageInput, { target: { value: "99" } });
		fireEvent.keyDown(pageInput, { key: "Enter" });

		expect(onPageChange).toHaveBeenCalledWith(3);
	});

	it("页码跳转输入无效时不应该触发跳转", () => {
		const onPageChange = vi.fn();
		renderBar({ page: 1, totalPages: 3, onPageChange });

		const pageInput = screen.getByLabelText("跳转页码");
		fireEvent.change(pageInput, { target: { value: "abc" } });
		fireEvent.keyDown(pageInput, { key: "Enter" });

		expect(onPageChange).not.toHaveBeenCalled();
	});

	it("集数跳转输入按回车时应该触发对应集数回调", () => {
		const onJumpToEpisode = vi.fn();
		renderBar({ page: 1, totalPages: 3, onJumpToEpisode });

		const episodeInput = screen.getByLabelText("跳转集数");
		fireEvent.change(episodeInput, { target: { value: "123" } });
		fireEvent.keyDown(episodeInput, { key: "Enter" });

		expect(onJumpToEpisode).toHaveBeenCalledWith(123);
	});

	it("集数跳转输入为 0 或无效值时不应该触发跳转", () => {
		const onJumpToEpisode = vi.fn();
		renderBar({ page: 1, totalPages: 3, onJumpToEpisode });

		const episodeInput = screen.getByLabelText("跳转集数");
		fireEvent.change(episodeInput, { target: { value: "0" } });
		fireEvent.keyDown(episodeInput, { key: "Enter" });
		expect(onJumpToEpisode).not.toHaveBeenCalled();

		fireEvent.change(episodeInput, { target: { value: "-5" } });
		fireEvent.keyDown(episodeInput, { key: "Enter" });
		expect(onJumpToEpisode).not.toHaveBeenCalled();
	});
});
