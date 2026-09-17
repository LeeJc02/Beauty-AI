<script lang="ts" setup>
import { useI18n } from '@/hooks/web/useI18n'

defineOptions({ name: 'ClientCard' })

const { t } = useI18n()
</script>

<template>
  <div class="client-card">
    <p class="client-label">{{ t('sidebar.clientLabel') }}</p>
    <p class="client-name" data-i18n-skip>Hebe Beauty</p>
  </div>
</template>

<style lang="scss" scoped>
.client-card {
  margin: 12px 8px 0;
  padding: 8px 12px;
  background: rgb(255 255 255 / 6%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 12px;
}

.client-label {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 40%);
}

.client-name {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.375;
  color: #fff;
}
</style>
