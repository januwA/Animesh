import { fireEvent, render, screen } from "@testing-library/react";
import { TORRENT_SEARCH_ENGINES } from "@/domain/torrent/TorrentEngines";
import { AppContextProvider, useAppContext } from "./AppContext";

const mockCountry = { name: "日本", code: "JP", flag: "🇯🇵" };
const mockChannel = {
	tvgId: "nhk",
	name: "NHK",
	logo: null,
	category: "综合",
	url: "http://example.com/nhk.m3u8",
};
const mockSearchResult = {
	title: "xxx 第1集",
	link: "http://example.com/1",
	pub_date: "2026-06-23",
	magnet: "magnet:?xt=urn:btih:TEST1",
	size: 350000000,
};

function TestComponent() {
	const {
		calendar,
		setCalendar,
		calendarActiveDay,
		setCalendarActiveDay,
		iptvCountries,
		setIptvCountries,
		iptvSelectedCountry,
		setIptvSelectedCountry,
		iptvChannels,
		setIptvChannels,
		iptvChannelsCountry,
		setIptvChannelsCountry,
		iptvSelectedCategory,
		setIptvSelectedCategory,
		iptvKeyword,
		setIptvKeyword,
		searchKeyword,
		setSearchKeyword,
		searchEngine,
		setSearchEngine,
		searchResults,
		setSearchResults,
		searchHasSearched,
		setSearchHasSearched,
	} = useAppContext();
	return (
		<div>
			<span data-testid="calendar-length">{calendar.length}</span>
			<span data-testid="active-day">
				{calendarActiveDay === null ? "null" : calendarActiveDay}
			</span>
			<span data-testid="iptv-countries-length">{iptvCountries.length}</span>
			<span data-testid="iptv-selected-country">{iptvSelectedCountry}</span>
			<span data-testid="iptv-channels-length">{iptvChannels.length}</span>
			<span data-testid="iptv-channels-country">
				{iptvChannelsCountry === null ? "null" : iptvChannelsCountry}
			</span>
			<span data-testid="iptv-selected-category">{iptvSelectedCategory}</span>
			<span data-testid="iptv-keyword">{iptvKeyword}</span>
			<span data-testid="search-keyword">{searchKeyword}</span>
			<span data-testid="search-engine">{searchEngine}</span>
			<span data-testid="search-results-length">{searchResults.length}</span>
			<span data-testid="search-has-searched">
				{searchHasSearched ? "true" : "false"}
			</span>
			<button
				type="button"
				data-testid="set-calendar"
				onClick={() => setCalendar([])}
			>
				set
			</button>
			<button
				type="button"
				data-testid="set-active-day"
				onClick={() => setCalendarActiveDay(1)}
			>
				setActive
			</button>
			<button
				type="button"
				data-testid="set-iptv-countries"
				onClick={() => setIptvCountries([mockCountry])}
			>
				setCountries
			</button>
			<button
				type="button"
				data-testid="set-iptv-selected-country"
				onClick={() => setIptvSelectedCountry("JP")}
			>
				setSelectedCountry
			</button>
			<button
				type="button"
				data-testid="set-iptv-channels"
				onClick={() => setIptvChannels([mockChannel])}
			>
				setChannels
			</button>
			<button
				type="button"
				data-testid="set-iptv-channels-country"
				onClick={() => setIptvChannelsCountry("JP")}
			>
				setChannelsCountry
			</button>
			<button
				type="button"
				data-testid="set-iptv-selected-category"
				onClick={() => setIptvSelectedCategory("综合")}
			>
				setSelectedCategory
			</button>
			<button
				type="button"
				data-testid="set-iptv-keyword"
				onClick={() => setIptvKeyword("nhk")}
			>
				setKeyword
			</button>
			<button
				type="button"
				data-testid="set-search-keyword"
				onClick={() => setSearchKeyword("xxx")}
			>
				setSearchKeyword
			</button>
			<button
				type="button"
				data-testid="set-search-engine"
				onClick={() => setSearchEngine("nyaa")}
			>
				setSearchEngine
			</button>
			<button
				type="button"
				data-testid="set-search-results"
				onClick={() => setSearchResults([mockSearchResult])}
			>
				setSearchResults
			</button>
			<button
				type="button"
				data-testid="set-search-has-searched"
				onClick={() => setSearchHasSearched(true)}
			>
				setSearchHasSearched
			</button>
		</div>
	);
}

describe("AppContext 状态上下文", () => {
	it("应该提供日历状态和方法", () => {
		render(
			<AppContextProvider>
				<TestComponent />
			</AppContextProvider>,
		);
		expect(screen.getByTestId("calendar-length").textContent).toBe("0");
		expect(screen.getByTestId("active-day").textContent).toBe("null");
	});

	it("应该提供 IPTV 状态的默认值，并支持通过 setter 更新", () => {
		render(
			<AppContextProvider>
				<TestComponent />
			</AppContextProvider>,
		);

		expect(screen.getByTestId("iptv-countries-length").textContent).toBe("0");
		expect(screen.getByTestId("iptv-selected-country").textContent).toBe("CN");
		expect(screen.getByTestId("iptv-channels-length").textContent).toBe("0");
		expect(screen.getByTestId("iptv-channels-country").textContent).toBe(
			"null",
		);
		expect(screen.getByTestId("iptv-selected-category").textContent).toBe(
			"all",
		);
		expect(screen.getByTestId("iptv-keyword").textContent).toBe("");

		fireEvent.click(screen.getByTestId("set-iptv-countries"));
		fireEvent.click(screen.getByTestId("set-iptv-selected-country"));
		fireEvent.click(screen.getByTestId("set-iptv-channels"));
		fireEvent.click(screen.getByTestId("set-iptv-channels-country"));
		fireEvent.click(screen.getByTestId("set-iptv-selected-category"));
		fireEvent.click(screen.getByTestId("set-iptv-keyword"));

		expect(screen.getByTestId("iptv-countries-length").textContent).toBe("1");
		expect(screen.getByTestId("iptv-selected-country").textContent).toBe("JP");
		expect(screen.getByTestId("iptv-channels-length").textContent).toBe("1");
		expect(screen.getByTestId("iptv-channels-country").textContent).toBe("JP");
		expect(screen.getByTestId("iptv-selected-category").textContent).toBe(
			"综合",
		);
		expect(screen.getByTestId("iptv-keyword").textContent).toBe("nhk");
	});

	it("应该提供首页搜索状态的默认值，并支持通过 setter 更新", () => {
		render(
			<AppContextProvider>
				<TestComponent />
			</AppContextProvider>,
		);

		expect(screen.getByTestId("search-keyword").textContent).toBe("");
		expect(screen.getByTestId("search-engine").textContent).toBe(
			TORRENT_SEARCH_ENGINES[0],
		);
		expect(screen.getByTestId("search-results-length").textContent).toBe("0");
		expect(screen.getByTestId("search-has-searched").textContent).toBe("false");

		fireEvent.click(screen.getByTestId("set-search-keyword"));
		fireEvent.click(screen.getByTestId("set-search-engine"));
		fireEvent.click(screen.getByTestId("set-search-results"));
		fireEvent.click(screen.getByTestId("set-search-has-searched"));

		expect(screen.getByTestId("search-keyword").textContent).toBe("xxx");
		expect(screen.getByTestId("search-engine").textContent).toBe("nyaa");
		expect(screen.getByTestId("search-results-length").textContent).toBe("1");
		expect(screen.getByTestId("search-has-searched").textContent).toBe("true");
	});
});
