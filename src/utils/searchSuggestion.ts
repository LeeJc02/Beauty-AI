export interface SearchSuggestion {
  value: string
}

type SuggestionCandidate = string | number | null | undefined | SuggestionCandidate[]

const flattenCandidates = (candidate: SuggestionCandidate): string[] => {
  if (Array.isArray(candidate)) return candidate.flatMap(flattenCandidates)
  if (candidate === null || candidate === undefined) return []
  return [String(candidate)]
}

const normalizeCandidate = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const buildSearchSuggestions = <T>(
  items: T[],
  keyword: string,
  candidateOf: (item: T) => SuggestionCandidate
): SearchSuggestion[] => {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase()
  if (!normalizedKeyword) return []

  const values = items
    .flatMap((item) => flattenCandidates(candidateOf(item)))
    .map(normalizeCandidate)
    .filter((value) => value.toLocaleLowerCase().includes(normalizedKeyword))

  return Array.from(new Set(values)).map((value) => ({ value }))
}

/**
 * 适配 el-autocomplete 的 `fetch-suggestions`。
 *
 * Element Plus 的 `AutocompleteFetchSuggestions` 只接受同步回调式签名，可接受的返回值
 * 是 `AutocompleteData | Promise<AutocompleteData> | void`；项目里的取数函数普遍是
 * async 且不返回数据（只通过 callback 回填），其 `Promise<void>` 不满足该联合类型，
 * 直接绑定会报 TS2322。这里用一个同步外壳包一层，语义与原先完全一致：组件本来就
 * 忽略取数函数返回的 promise。
 */
export const toAutocompleteFetchSuggestions = <T>(
  fetcher: (keyword: string, callback: (suggestions: T[]) => void) => Promise<void>
) => {
  return (keyword: string, callback: (suggestions: T[]) => void): void => {
    void fetcher(keyword, callback)
  }
}
