import type { App } from 'vue'
import { createI18n } from 'vue-i18n'
import { useLocaleStoreWithOut } from '@/store/modules/locale'
import type { I18n, I18nOptions } from 'vue-i18n'
import { setHtmlPageLang } from './helper'

export let i18n: ReturnType<typeof createI18n>

const createI18nOptions = async (): Promise<I18nOptions> => {
  const localeStore = useLocaleStoreWithOut()
  const locale = localeStore.getCurrentLocale
  const localeMap = localeStore.getLocaleMap
  // 防御性校验：如果 store 侧没拦住非法 lang，在此兜底回退
  const supportedLangs = localeMap.map((v) => v.lang)
  const lang = supportedLangs.includes(locale.lang) ? locale.lang : 'zh-CN'
  const defaultLocal = await import(`../../locales/${lang}.ts`)
  const message = defaultLocal.default ?? {}

  setHtmlPageLang(lang)

  localeStore.setCurrentLocale({
    lang
    // elLocale: elLocal
  })

  return {
    legacy: false,
    locale: lang,
    fallbackLocale: lang,
    messages: {
      [lang]: message
    },
    availableLocales: localeMap.map((v) => v.lang),
    sync: true,
    silentTranslationWarn: true,
    missingWarn: false,
    silentFallbackWarn: true
  }
}

export const setupI18n = async (app: App<Element>) => {
  const options = await createI18nOptions()
  i18n = createI18n(options) as I18n
  app.use(i18n)
}
