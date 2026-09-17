<script setup lang="ts">
/**
 * 「下载APP」按钮：对应原型 `components/AppDownloadButton.tsx`。
 *
 * 原型的悬浮菜单靠 `group-hover/app-download:block` + `group-focus-within/...` 实现；
 * unocss 0.58 的命名分组变体不稳，这里改用 scoped css 实现同样的悬浮/聚焦展开。
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const APP_DOWNLOAD_LINKS = {
  appStore: 'https://apps.apple.com/app/salesboost-ai/id0000000000',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.salesboost.ai'
}
</script>

<template>
  <div class="app-download relative shrink-0">
    <button
      type="button"
      class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E5DED8] bg-white px-3 py-2 text-xs font-bold text-[#3F3A3D] shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/15"
      aria-haspopup="menu"
    >
      <Icon icon="lucide:download" :size="14" />
      <span>下载APP</span>
    </button>

    <div class="app-download__menu absolute right-0 top-full z-50 hidden w-60 pt-2">
      <div class="rounded-xl border border-[#E5DED8] bg-white p-2 shadow-xl">
        <div v-if="!compact" class="mb-1 flex items-start gap-2 rounded-lg bg-[#F8F5F3] px-2.5 py-2">
          <Icon icon="lucide:smartphone" :size="16" class="mt-0.5 shrink-0 text-rose-500" />
          <div>
            <p class="text-xs font-bold text-[#242124]">移动端 APP 下载</p>
            <p class="mt-0.5 text-[10px] leading-relaxed text-[#766F73]">
              BA 可在移动端查看课件、附加题、考试和陪练任务。
            </p>
          </div>
        </div>

        <a
          :href="APP_DOWNLOAD_LINKS.appStore"
          target="_blank"
          rel="noreferrer"
          class="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3] hover:text-rose-700"
        >
          <span data-i18n-skip="true">Apple App Store</span>
          <Icon icon="lucide:external-link" :size="14" class="text-[#9A9396]" />
        </a>
        <a
          :href="APP_DOWNLOAD_LINKS.googlePlay"
          target="_blank"
          rel="noreferrer"
          class="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-bold text-[#3F3A3D] transition-colors hover:bg-[#F8F5F3] hover:text-rose-700"
        >
          <span data-i18n-skip="true">Google Play</span>
          <Icon icon="lucide:external-link" :size="14" class="text-[#9A9396]" />
        </a>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.app-download:hover .app-download__menu,
.app-download:focus-within .app-download__menu {
  display: block;
}
</style>
