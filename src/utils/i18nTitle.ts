import { useI18n } from '@/hooks/web/useI18n'

export const useI18nTitle = () => {
  const { t } = useI18n()

  const translateTitle = (title?: string, rawTitle?: string) => {
    if (!title) return rawTitle || ''
    const translated = t(title)
    return translated === title ? rawTitle || title : translated
  }

  const translateRouteTitle = (meta?: { title?: unknown; rawTitle?: unknown }) =>
    translateTitle(meta?.title as string | undefined, meta?.rawTitle as string | undefined)

  return {
    translateTitle,
    translateRouteTitle
  }
}
