import { defineStore } from 'pinia'
import { store } from '../index'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import id from 'element-plus/es/locale/lang/id'
import { CACHE_KEY, useCache } from '@/hooks/web/useCache'
import { LocaleDropdownType } from '@/types/localeDropdown'

const { wsCache } = useCache()

const elLocaleMap = {
  'zh-CN': zhCn,
  en: en,
  id: id
}
interface LocaleState {
  currentLocale: LocaleDropdownType
  localeMap: LocaleDropdownType[]
}

const SUPPORTED_LANGS = ['zh-CN', 'en', 'id'] as const

const isSupportedLang = (value: unknown): value is LocaleType =>
  typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value)

const resolveCachedLang = (): LocaleType => {
  const cached = wsCache.get(CACHE_KEY.LANG)
  return isSupportedLang(cached) ? cached : 'id'
}

export const useLocaleStore = defineStore('locales', {
  state: (): LocaleState => {
    const lang = resolveCachedLang()
    return {
      currentLocale: {
        lang,
        elLocale: elLocaleMap[lang]
      },
      // 多语言
      localeMap: [
        {
          lang: 'zh-CN',
          name: '简体中文'
        },
        {
          lang: 'en',
          name: 'English'
        },
        {
          lang: 'id',
          name: 'Bahasa Indonesia'
        }
      ]
    }
  },
  getters: {
    getCurrentLocale(): LocaleDropdownType {
      return this.currentLocale
    },
    getLocaleMap(): LocaleDropdownType[] {
      return this.localeMap
    }
  },
  actions: {
    setCurrentLocale(localeMap: LocaleDropdownType) {
      const lang = localeMap?.lang
      // 仅允许已支持的语言，避免缓存非法值导致后续启动崩溃
      if (!lang || !(SUPPORTED_LANGS as readonly string[]).includes(lang)) {
        console.warn(`[locale] Unsupported lang: ${lang}, ignored`)
        return
      }
      this.currentLocale.lang = lang
      this.currentLocale.elLocale = elLocaleMap[lang]
      wsCache.set(CACHE_KEY.LANG, lang)
    }
  }
})

export const useLocaleStoreWithOut = () => {
  return useLocaleStore(store)
}
