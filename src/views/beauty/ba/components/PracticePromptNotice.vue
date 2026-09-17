<script setup lang="ts">
/**
 * 陪练提示词告知条（原型 components/PracticePromptNotice.tsx）。
 */
defineOptions({ name: 'BeautyPracticePromptNotice' })
</script>

<template>
  <div
    class="flex w-full items-start gap-3 rounded-xl border border-[#F2DEC0] bg-[#FFF7EA] px-4 py-3 text-[#5D565A] shadow-sm"
  >
    <div
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-[#B9822B] ring-1 ring-[#E8CCA0]"
    >
      <Icon icon="lucide:info" :size="16" />
    </div>
    <div class="min-w-0 text-sm leading-relaxed">
      <span class="font-bold text-[#242124]">提示词会直接影响最终 AI 陪练效果。</span>
      <span class="ml-1"
        >请尽量详细、准确填写角色背景、场景流程、回答提示和金句使用提示；内容越清晰，学员端对话、判定和反馈越稳定。</span
      >
    </div>
  </div>
</template>
