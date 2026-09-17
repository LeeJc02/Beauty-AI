<script lang="ts" setup>
import { useI18n } from '@/hooks/web/useI18n'

defineOptions({ name: 'ContentStatusBadge' })

const props = withDefaults(
  defineProps<{
    status: 'pending' | 'active'
  }>(),
  {
    status: 'pending'
  }
)

const { t } = useI18n()
</script>

<template>
  <span
    class="status-badge"
    :class="{
      pending: props.status === 'pending',
      active: props.status === 'active'
    }"
  >
    <span class="status-dot" ></span>
    <span>{{ props.status === 'active' ? t('contentStatus.active') : t('contentStatus.pending') }}</span>
  </span>
</template>

<style lang="scss" scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  line-height: 18px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.pending {
  color: #b9822b;
  background: #fff7ea;
  border: 1px solid #e8cca0;

  .status-dot {
    background: #b9822b;
  }
}

.active {
  color: #3b8f72;
  background: #eef8f4;
  border: 1px solid #bfdccf;

  .status-dot {
    background: #3b8f72;
  }
}
</style>
