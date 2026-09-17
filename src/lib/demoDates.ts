import { addDays, inspectionDay, weekStart } from "./inspectionEngine";

/** 任务页和审计页共用的演示时间锚点，避免一个页面停在 2023、另一个页面审计 2026。 */
export const DEMO_WEEK = weekStart(inspectionDay());
export const DEMO_PREVIOUS_WEEK = addDays(DEMO_WEEK, -7);
export const DEMO_NEXT_WEEK = addDays(DEMO_WEEK, 7);
export const demoDate = (offset: number) => addDays(DEMO_WEEK, offset);
export const demoDateTime = (offset: number, time = "09:00") => `${demoDate(offset)} ${time}`;
