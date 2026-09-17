<script lang="ts" setup>
import { useTagsViewStore } from '@/store/modules/tagsView'
import { useAppStore } from '@/store/modules/app'
import { useLocaleStore } from '@/store/modules/locale'
import { useRoute } from 'vue-router'
import { Footer } from '@/layout/components/Footer'

defineOptions({ name: 'AppView' })

const appStore = useAppStore()
const localeStore = useLocaleStore()

const footer = computed(() => appStore.getFooter)
const route = useRoute()
const coursewareWorkspace = computed(() => route.path === '/courseware/create')

const tagsViewStore = useTagsViewStore()

const getCaches = computed((): string[] => {
  return tagsViewStore.getCachedViews
})

// 查询型工作台在同一路径下复用实例，避免筛选参数变化产生多份 KeepAlive 缓存。
const pathStableViewNames = new Set(['AiTrainingQuoteOverview'])
const getRouteViewKey = (route: {
  name?: string | symbol | null
  path: string
  fullPath: string
}) => (route.name && pathStableViewNames.has(String(route.name)) ? route.path : route.fullPath)

/**
 * 语言切换时强制重建当前页面。
 *
 * 原因：界面文案由 vue-i18n 渲染，而部分页面（如复制的课件页）的文本只在 setup 阶段
 * 取一次 `useI18n()`，热切换语言时不会重新渲染（刷新后才正确）。
 * 这里把语言并入视图 key，切语言即重建页面，保证全局文案一致。
 */
const viewKey = computed(() => `${getRouteViewKey(route)}::${localeStore.getCurrentLocale.lang}`)

//region 无感刷新
const routerAlive = ref(true)
// 无感刷新，防止出现页面闪烁白屏
const reload = () => {
  routerAlive.value = false
  nextTick(() => (routerAlive.value = true))
}
// 为组件后代提供刷新方法
provide('reload', reload)
//endregion
</script>

<template>
  <section
    :style="
      coursewareWorkspace
        ? { '--workspace-footer-height': footer ? 'var(--app-footer-height)' : '0px' }
        : undefined
    "
    :class="[
      'p-[var(--app-content-padding)] w-full bg-[var(--app-content-bg-color)] dark:bg-[var(--el-bg-color)]',
      {
        '!min-h-[calc(100vh-var(--top-tool-height)-var(--tags-view-height)-var(--app-footer-height))] pb-0':
          footer && !coursewareWorkspace,
        'courseware-workspace': coursewareWorkspace
      }
    ]"
  >
    <router-view v-if="routerAlive">
      <template #default="{ Component }">
        <keep-alive :include="getCaches">
          <component :is="Component" :key="viewKey" />
        </keep-alive>
      </template>
    </router-view>
  </section>
  <Footer v-if="footer" />
</template>

<style scoped>
.courseware-workspace {
  /* 课件工作台与版权栏直接相接，不额外留下底部空白。 */
  padding-bottom: 0;
  height: calc(
    100dvh - var(--top-tool-height) - var(--tags-view-height) - var(--workspace-footer-height)
  );
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  /* 旧版创建页内容高度超过视口时由工作区承担纵向滚动。 */
  overflow-x: hidden;
  overflow-y: auto;
}
</style>
