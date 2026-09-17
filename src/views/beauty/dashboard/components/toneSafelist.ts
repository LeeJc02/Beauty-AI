// @unocss-include
/**
 * 动态类名收集文件（unocss 扫描入口）。
 *
 * 背景：unocss 的 vite 插件默认只扫描 `.vue` / `.tsx` / `.html`（`content.pipeline.include`），
 * 而 `@/beauty/lib/visualTones.ts` 里的 `getProgressTone` / `brandTone` / `getScoreTone` /
 * `getTaskStatusBadgeClass` 都是「运行时按数值返回类名字符串」的 .ts 工具函数，
 * 模板里只出现 `tone.barClass`，类名本身不会被提取，颜色就会丢。
 *
 * 该模块用官方约定的 `@unocss-include` 注释把自身纳入扫描，并逐字列出这些函数可能返回的类名。
 * 运行时不做任何事，只是给 unocss 一份「动态类名清单」。
 */

/** getProgressTone(progress) 的三个分支（barClass / indicatorClass / textClass / hoverClass）。 */
export const PROGRESS_TONE_CLASSES = [
  'bg-[#3B8F72]',
  'text-[#3B8F72]',
  'group-hover:text-[#3B8F72]',
  'bg-[#B9822B]',
  'text-[#B9822B]',
  'group-hover:text-[#B9822B]',
  'bg-rose-500',
  'text-rose-600',
  'group-hover:text-rose-600'
]

/** brandTone.textClass / brandTone.bgClass。 */
export const BRAND_TONE_CLASSES = ['text-[#A85F4B]', 'bg-[#FFF0E8]']

/** getScoreTone(score)。 */
export const SCORE_TONE_CLASSES = ['text-[#3B8F72]', 'text-[#B9822B]', 'text-rose-600']

/** getTaskStatusBadgeClass(status)。 */
export const TASK_STATUS_BADGE_CLASSES = [
  'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]',
  'border-[#E8CCA0] bg-[#FFF7EA] text-[#8B621F]',
  'border-[#E8CCA0] bg-[#FFF7EA] text-[#B9822B]',
  'border-[#E5DED8] bg-[#F8F5F3] text-[#766F73]'
]
