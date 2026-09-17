import { computed, onMounted, onScopeDispose, watch, type ComputedRef } from 'vue'
import { useLocaleStore } from '@/store/modules/locale'
import {
  persistLanguage,
  startTranslationRuntime,
  translateText,
  type Language
} from '@/beauty/lib/i18n'

/** yudao 的语言标识 → Beauty-AI 原型的语言标识（zh-CN → zh）。 */
export const toBeautyLanguage = (lang: string | undefined): Language => {
  if (lang === 'en') return 'en'
  if (lang === 'id') return 'id'
  return 'zh'
}

export interface BeautyI18n {
  /** 'zh' | 'en' | 'id'，跟随 yudao 的语言设置响应式变化 */
  language: ComputedRef<Language>
  /** 与原型一致的翻译函数：入参是中文原文，返回当前语言文案 */
  t: (text: string) => string
}

/**
 * Beauty-AI 原型自带的翻译字典（中文原文 → 英文/印尼语）与 yudao 语言设置之间的桥。
 *
 * 用法：
 * ```ts
 * const { t, language } = useBeautyI18n()
 * t('生成新课件') // 跟随界面语言输出
 * ```
 * 模板里 `language` 会自动解包，脚本里需要 `language.value`。
 */
export const useBeautyI18n = (): BeautyI18n => {
  const localeStore = useLocaleStore()
  const language = computed<Language>(() => toBeautyLanguage(localeStore.getCurrentLocale.lang))

  // 兼容原型里读取 `salesboost-ai-language` 的逻辑
  watch(language, (value) => persistLanguage(value), { immediate: true })

  const t = (text: string) => translateText(text, language.value)

  return { language, t }
}

/**
 * 启动 DOM 翻译运行时（对应原型里的 `<TranslationRuntime />` 全局组件）。
 *
 * 该运行时会把页面上「写在模板里的中文原文」按当前语言替换，语言切换时重建。
 * 需要在根组件（App.vue）调用一次。
 */
export const useBeautyTranslationRuntime = () => {
  const { language } = useBeautyI18n()
  let stop: (() => void) | undefined

  const restart = () => {
    stop?.()
    stop = startTranslationRuntime(() => language.value)
  }

  onMounted(restart)
  watch(language, restart)
  onScopeDispose(() => stop?.())
}
