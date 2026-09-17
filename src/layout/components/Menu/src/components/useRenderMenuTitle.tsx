import type { RouteMeta } from 'vue-router'
import { Icon } from '@/components/Icon'
import { useI18nTitle } from '@/utils/i18nTitle'

export const useRenderMenuTitle = () => {
  const renderMenuTitle = (meta: RouteMeta) => {
    const { translateRouteTitle } = useI18nTitle()
    const { title = 'Please set title', icon } = meta
    const titleText = computed(() => translateRouteTitle({ ...meta, title }))

    return icon ? (
      <>
        <Icon icon={meta.icon}></Icon>
        <span class="v-menu__title overflow-hidden overflow-ellipsis whitespace-nowrap">
          {titleText.value}
        </span>
      </>
    ) : (
      <span class="v-menu__title overflow-hidden overflow-ellipsis whitespace-nowrap">
        {titleText.value}
      </span>
    )
  }

  return {
    renderMenuTitle
  }
}
