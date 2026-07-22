import { render, screen } from "@testing-library/react";
import { AppContextProvider, useAppContext } from "./AppContext";

function TestComponent() {
	const { calendar, setCalendar, calendarActiveDay, setCalendarActiveDay } =
		useAppContext();
	return (
		<div>
			<span data-testid="calendar-length">{calendar.length}</span>
			<span data-testid="active-day">
				{calendarActiveDay === null ? "null" : calendarActiveDay}
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
});
