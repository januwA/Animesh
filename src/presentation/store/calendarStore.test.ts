import { describe, expect, it } from "vitest";
import { useCalendarStore } from "./calendarStore";

const mockDay = {
  weekday: { id: 1, en: "monday", cn: "星期一", ja: "月曜日" },
  items: [],
};

describe("日历全局状态 store", () => {
  afterEach(() => {
    useCalendarStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useCalendarStore.getState();
    expect(state.calendar).toEqual([]);
    expect(state.calendarActiveDay).toBeNull();
  });

  it("应该能通过 setCalendar 更新日历数据", () => {
    useCalendarStore.getState().setCalendar([mockDay]);
    expect(useCalendarStore.getState().calendar).toEqual([mockDay]);
  });

  it("应该能通过 setCalendarActiveDay 更新选中日期", () => {
    useCalendarStore.getState().setCalendarActiveDay(1);
    expect(useCalendarStore.getState().calendarActiveDay).toBe(1);
    useCalendarStore.getState().setCalendarActiveDay(null);
    expect(useCalendarStore.getState().calendarActiveDay).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useCalendarStore.getState().setCalendar([mockDay]);
    useCalendarStore.getState().setCalendarActiveDay(1);
    useCalendarStore.getState().reset();
    expect(useCalendarStore.getState()).toMatchObject({
      calendar: [],
      calendarActiveDay: null,
    });
  });
});
