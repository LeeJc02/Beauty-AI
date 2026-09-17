<script setup lang="ts">
/**
 * 下钻页签头：对应原型 `components/ui/tabs.tsx` 里 TabsList + TabsTrigger 的样式。
 *
 * 原型用 `data-active:` 变体切换选中态，unocss 0.58 不支持该变体，改用 scoped css 的
 * `.beauty-tab--active`（rose-700 文字 + rose-600 下划线，与原型一致）。
 * 内容区由页面自己用 v-show 控制，保持与原型 TabsContent 相同的挂载行为。
 */
defineProps<{
  /** 页签：[{ key, label }] */
  tabs: { key: string; label: string }[]
  /** 当前选中页签 key */
  modelValue: string
  /** TabsList 上的布局类（各页面容器不同） */
  listClass?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()
</script>

<template>
  <div class="flex items-center" :class="listClass">
    <button
      v-for="(tab, index) in tabs"
      :key="tab.key"
      type="button"
      class="beauty-tab h-full flex-1 px-6 text-sm font-bold text-[#766F73]"
      :class="[
        index < tabs.length - 1 ? 'border-r border-[#E9E4DF]' : '',
        modelValue === tab.key ? 'beauty-tab--active' : ''
      ]"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style lang="scss" scoped>
.beauty-tab {
  position: relative;
  transition: all 0.15s;

  &:hover {
    color: #be123c;
  }
}

.beauty-tab--active {
  background-color: #fff;
  color: #be123c;

  &::after {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    content: '';
    background-color: #e11d48;
  }
}
</style>
