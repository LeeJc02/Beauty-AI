import { i18n } from '@/plugins/vueI18n'
import { useLocaleStoreWithOut } from '@/store/modules/locale'

type I18nGlobalTranslation = {
  (key: string): string
  (key: string, locale: string): string
  (key: string, locale: string, list: unknown[]): string
  (key: string, locale: string, named: Record<string, unknown>): string
  (key: string, list: unknown[]): string
  (key: string, named: Record<string, unknown>): string
}

type I18nTranslationRestParameters = [string, any]

const getKey = (namespace: string | undefined, key: string) => {
  if (!namespace) {
    return key
  }
  if (key.startsWith(namespace)) {
    return key
  }
  return `${namespace}.${key}`
}

export const useI18n = (
  namespace?: string
): {
  t: I18nGlobalTranslation
} => {
  const localeStore = useLocaleStoreWithOut()
  const normalFn = {
    t: (key: string) => {
      return getKey(namespace, key)
    }
  }

  if (!i18n) {
    return normalFn
  }

  const { t, ...methods } = i18n.global

  const tFn: I18nGlobalTranslation = (key: string, ...arg: any[]) => {
    // 建立对语言设置的反应式依赖。
    // i18n.global.t 是脱离组件上下文的调用，不会自己收集渲染依赖，
    // 导致热切换语言时只有 Layout 重新渲染、页面正文仍是旧语言（刷新后才正确）。
    // 这里读一下当前语言，让调用它的渲染副作用在语言变化时重新执行。
    localeStore.getCurrentLocale.lang

    if (!key) return ''
    if (!key.includes('.') && !namespace) return key
    //@ts-ignore
    return t(getKey(namespace, key), ...(arg as I18nTranslationRestParameters))
  }
  return {
    ...methods,
    t: tFn
  }
}

export const t = (key: string) => key
