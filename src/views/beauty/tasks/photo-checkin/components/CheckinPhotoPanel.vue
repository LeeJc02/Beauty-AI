<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PhotoCheckinPhoto } from '@/beauty/types'

/**
 * 打卡照片面板：对应原型 `PhotoCheckinRecords.tsx` 里的 `PhotoPanel`。
 * 单独拆出是因为「加载失败」是每个面板各自的局部状态。
 */
defineOptions({ name: 'CheckinPhotoPanel' })

const props = defineProps<{
  title: string
  description: string
  photo?: PhotoCheckinPhoto
}>()

const loadError = ref(false)

watch(
  () => props.photo?.previewUrl,
  () => {
    loadError.value = false
  }
)

const sourceLabel = computed(() => (props.photo?.source === 'camera' ? '相机拍摄' : '相册上传'))
</script>

<template>
  <section class="rounded-lg border border-solid border-[#E9E4DF] bg-white p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-bold text-[#242124]">{{ title }}</h3>
        <p class="mt-1 text-xs text-[#9A9396]">{{ description }}</p>
      </div>
      <span
        class="inline-flex h-5 shrink-0 items-center rounded-full border border-solid px-2 text-xs font-medium whitespace-nowrap"
        :class="
          photo
            ? 'border-[#BFDCCF] bg-[#EEF8F4] text-[#3B8F72]'
            : 'border-[#E5DED8] bg-[#F8F5F3] text-[#766F73]'
        "
      >
        {{ photo ? '已上传' : '缺失' }}
      </span>
    </div>
    <img
      v-if="photo && !loadError"
      :src="photo.previewUrl"
      :alt="`${title}预览`"
      loading="lazy"
      class="mt-4 aspect-[16/10] w-full rounded-lg bg-[#F8F5F3] object-cover"
      @error="loadError = true"
    />
    <div
      v-else
      class="mt-4 flex aspect-[16/10] flex-col items-center justify-center rounded-lg border border-dashed border-[#D8D0CB] bg-[#FCFAF8] text-center"
    >
      <Icon :icon="loadError ? 'lucide:image-off' : 'lucide:camera'" :size="28" :class="loadError ? 'text-red-400' : 'text-[#C7BFBB]'" />
      <p class="mt-2 text-xs font-bold text-[#766F73]">
        {{ loadError ? '照片资源加载失败' : '该照片尚未提交' }}
      </p>
      <p class="mt-1 text-[10px] text-[#9A9396]">
        {{ loadError ? '请检查对象存储资源或签名 URL' : '需要 BA 补齐两张照片后才能完成打卡' }}
      </p>
    </div>
    <div
      v-if="photo"
      class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#9A9396]"
    >
      <span class="truncate">{{ photo.fileName }}</span>
      <span>{{ sourceLabel }} · {{ photo.capturedAt }}</span>
    </div>
  </section>
</template>
