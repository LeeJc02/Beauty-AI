<template>
  <div class="default-user-avatar">
    <Icon icon="ep:user-filled" class="default-user-avatar__icon" :size="iconSize" />
  </div>
</template>
<script lang="ts" setup>
defineOptions({ name: 'DefaultUserAvatar' })

const props = withDefaults(
  defineProps<{
    size?: number
  }>(),
  {
    size: 40
  }
)

const iconSize = computed(() => Math.round(props.size * 0.58))
</script>

<style lang="scss" scoped>
.default-user-avatar {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
}

.default-user-avatar__icon {
  color: var(--el-text-color-placeholder);
}
</style>
