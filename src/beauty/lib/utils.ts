/**
 * 极简 className 合并工具。
 *
 * 原型里用的是 `clsx` + `tailwind-merge`（React/Tailwind 生态）；
 * Vue 版本用 unocss，且页面模板里的 class 直接写在模板上，不需要 tailwind 冲突消解，
 * 因此这里只保留「过滤假值 + 拼接」的等价行为，去掉两个前端依赖。
 */
type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, boolean>

const flatten = (input: ClassValue, output: string[]) => {
  if (!input) return
  if (typeof input === 'string' || typeof input === 'number') {
    output.push(String(input))
    return
  }
  if (Array.isArray(input)) {
    input.forEach((item) => flatten(item, output))
    return
  }
  Object.entries(input).forEach(([key, enabled]) => {
    if (enabled) output.push(key)
  })
}

export function cn(...inputs: ClassValue[]) {
  const output: string[] = []
  inputs.forEach((input) => flatten(input, output))
  return output.join(' ')
}
