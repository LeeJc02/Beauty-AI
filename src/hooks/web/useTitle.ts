import { watch, ref } from 'vue'
import { isString } from '@/utils/is'
import { useAppStoreWithOut } from '@/store/modules/app'
import { useI18nTitle } from '@/utils/i18nTitle'

const appStore = useAppStoreWithOut()

export const useTitle = (newTitle?: string, rawTitle?: string) => {
  const { translateTitle } = useI18nTitle()
  const title = ref(
    newTitle ? `${appStore.getTitle} - ${translateTitle(newTitle, rawTitle)}` : appStore.getTitle
  )

  watch(
    title,
    (n, o) => {
      if (isString(n) && n !== o && document) {
        document.title = n
      }
    },
    { immediate: true }
  )

  return title
}
