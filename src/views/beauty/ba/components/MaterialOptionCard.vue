<script setup lang="ts">
/**
 * 黄金素材可选项卡片（原型 MaterialReferenceDialog 里的 MaterialOptionCard）。
 */
import type { GoldenMaterial, MaterialRecommendation } from '@/beauty/types'
import { formatMaterialTime, materialTargetKind } from './materialReference'

defineOptions({ name: 'BeautyMaterialOptionCard' })

defineProps<{
  material: GoldenMaterial
  selected: boolean
  recommendation?: MaterialRecommendation
}>()

const emit = defineEmits<{ (e: 'toggle', id: string): void }>()
</script>

<template>
  <label
    class="block cursor-pointer rounded-lg border p-4 transition-colors"
    :class="
      selected
        ? 'border-[#6974E8] bg-[#F4F5FF] shadow-sm'
        : 'border-[#E5DED8] bg-white hover:border-[#BDB8DD]'
    "
  >
    <div class="flex gap-3">
      <input
        type="checkbox"
        :checked="selected"
        class="mt-1 h-4 w-4 rounded border-[#BDB5B1] accent-[#515BCB]"
        :aria-label="`引用素材 ${material.title}`"
        @change="emit('toggle', material.id)"
      />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-bold text-[#242124]">{{ material.title }}</span>
          <span
            v-if="recommendation"
            class="inline-flex items-center rounded-md border border-[#D8DEFF] bg-[#EEF1FF] px-2.5 py-0.5 text-xs font-semibold text-[#515BCB]"
            ><Icon icon="lucide:sparkles" :size="12" class="mr-1" />AI 推荐</span
          >
          <span
            class="inline-flex items-center rounded-md border border-[#D8DEFF] bg-[#EEF1FF] px-2.5 py-0.5 text-xs font-semibold text-[#515BCB]"
            >{{ material.mediaKind === 'video' ? '视频' : '音频' }}</span
          >
          <span
            class="inline-flex items-center rounded-md border border-[#E5DED8] bg-[#F8F5F3] px-2.5 py-0.5 text-xs font-semibold text-[#766F73]"
            >{{ materialTargetKind(material) === 'scenario' ? '场景' : '产品' }}</span
          >
          <span
            class="inline-flex items-center rounded-md border border-[#BFDCCF] bg-[#EEF8F4] px-2.5 py-0.5 text-xs font-semibold text-[#3B8F72]"
            >{{ material.scope }}</span
          >
        </div>
        <p data-i18n-skip="true" class="mt-2 text-sm leading-relaxed text-[#242124]">
          {{ material.transcript ?? material.summary }}
        </p>
        <div class="mt-2 rounded-md bg-[#F8F5F3] px-3 py-2 text-xs leading-relaxed text-[#5D565A]">
          <span class="font-bold text-[#766F73]">AI 总结：</span
          >{{ material.aiSummary ?? material.summary }}
        </div>
        <div
          v-if="recommendation"
          class="mt-2 rounded-md border border-[#D8DEFF] bg-[#F7F8FF] px-3 py-2 text-xs leading-relaxed text-[#515BCB]"
        >
          <span class="font-bold">AI 推荐理由：</span>{{ recommendation.recommendationReason }}
        </div>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <span
            v-for="tag in material.tags"
            :key="tag"
            class="rounded-md bg-[#F8F5F3] px-2 py-1 text-[11px] font-medium text-[#766F73]"
            >{{ tag }}</span
          >
        </div>
        <div
          v-if="material.evidence[0]"
          class="mt-3 rounded-md border border-[#E9E4DF] bg-[#FCFAF8] px-3 py-2"
        >
          <div class="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#766F73]">
            <Icon
              :icon="material.mediaKind === 'video' ? 'lucide:file-video' : 'lucide:file-audio'"
              :size="14"
            />
            <span
              >证据 {{ formatMaterialTime(material.evidence[0].startSec) }} -
              {{ formatMaterialTime(material.evidence[0].endSec) }}</span
            >
            <span class="text-[#C9C1C4]">|</span>
            <span>{{ material.targetLabel }}</span>
            <span class="text-[#C9C1C4]">|</span>
            <span class="inline-flex items-center gap-1"
              ><Icon icon="lucide:map-pin" :size="14" />{{ material.region }}</span
            >
          </div>
          <p
            data-i18n-skip="true"
            class="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#5D565A]"
          >
            {{ material.evidence[0].transcript }}
          </p>
        </div>
        <div class="mt-3 flex items-center gap-1.5 text-[11px] text-[#9A9396]">
          <Icon icon="lucide:link-2" :size="14" />
          <span>审核人 {{ material.reviewerName }} · v{{ material.version }}</span>
        </div>
      </div>
      <Icon v-if="selected" icon="lucide:check" :size="20" class="shrink-0 text-[#515BCB]" />
    </div>
  </label>
</template>
