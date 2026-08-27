import { describe, expect, it } from "vitest";
import { useBangumiCalendarStore } from "./bangumiCalendarStore";

const mockDay = {
  weekday: { id: 1, en: "monday", cn: "星期一", ja: "月曜日" },
  items: [],
};

describe("日历全局状态 store", () => {
  afterEach(() => {
    useBangumiCalendarStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useBangumiCalendarStore.getState();
    expect(state.calendar).toEqual([]);
    expect(state.calendarActiveDay).toBeNull();
  });

  it("应该能通过 setCalendar 更新日历数据", () => {
    useBangumiCalendarStore.getState().setCalendar([mockDay]);
    expect(useBangumiCalendarStore.getState().calendar).toEqual([mockDay]);
  });

  it("应该能通过 setCalendarActiveDay 更新选中日期", () => {
    useBangumiCalendarStore.getState().setCalendarActiveDay(1);
    expect(useBangumiCalendarStore.getState().calendarActiveDay).toBe(1);
    useBangumiCalendarStore.getState().setCalendarActiveDay(null);
    expect(useBangumiCalendarStore.getState().calendarActiveDay).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useBangumiCalendarStore.getState().setCalendar([mockDay]);
    useBangumiCalendarStore.getState().setCalendarActiveDay(1);
    useBangumiCalendarStore.getState().reset();
    expect(useBangumiCalendarStore.getState()).toMatchObject({
      calendar: [],
      calendarActiveDay: null,
    });
  });
});
