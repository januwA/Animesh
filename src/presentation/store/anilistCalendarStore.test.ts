import { describe, expect, it } from "vitest";
import { useAnilistCalendarStore } from "./anilistCalendarStore";

const mockDay = {
  weekday: { id: 1 },
  items: [{ id: 1, name: "测试动漫", image: "", rating: 0 }],
};

describe("Anilist 日历全局状态 store", () => {
  afterEach(() => {
    useAnilistCalendarStore.getState().reset();
  });

  it("应该提供默认状态", () => {
    const state = useAnilistCalendarStore.getState();
    expect(state.calendar).toEqual([]);
    expect(state.calendarActiveDay).toBeNull();
  });

  it("应该能通过 setCalendar 更新日历数据", () => {
    useAnilistCalendarStore.getState().setCalendar([mockDay]);
    expect(useAnilistCalendarStore.getState().calendar).toEqual([mockDay]);
  });

  it("应该能通过 setCalendarActiveDay 更新选中日期", () => {
    useAnilistCalendarStore.getState().setCalendarActiveDay(1);
    expect(useAnilistCalendarStore.getState().calendarActiveDay).toBe(1);
    useAnilistCalendarStore.getState().setCalendarActiveDay(null);
    expect(useAnilistCalendarStore.getState().calendarActiveDay).toBeNull();
  });

  it("应该能通过 reset 恢复初始状态", () => {
    useAnilistCalendarStore.getState().setCalendar([mockDay]);
    useAnilistCalendarStore.getState().setCalendarActiveDay(1);
    useAnilistCalendarStore.getState().reset();
    expect(useAnilistCalendarStore.getState()).toMatchObject({
      calendar: [],
      calendarActiveDay: null,
    });
  });
});
