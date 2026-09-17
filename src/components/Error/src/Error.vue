<script lang="ts" setup>
import pageError from '@/assets/svgs/404.svg'
import networkError from '@/assets/svgs/500.svg'
import noPermission from '@/assets/svgs/403.svg'
import { propTypes } from '@/utils/propTypes'

defineOptions({ name: 'Error' })

interface ErrorMap {
  url: string
  message: string
  buttonText: string
}

const { t } = useI18n()

const errorMap: {
  [key: string]: ErrorMap
} = {
  '404': {
    url: pageError,
    message: t('error.pageError'),
    buttonText: t('error.returnToHome')
  },
  '500': {
    url: networkError,
    message: t('error.networkError'),
    buttonText: t('error.returnToHome')
  },
  '403': {
    url: noPermission,
    message: t('error.noPermission'),
    buttonText: t('error.returnToHome')
  }
}

const props = defineProps({
  type: propTypes.string.validate((v: string) => ['404', '500', '403'].includes(v)).def('404'),
  message: propTypes.string.def(''),
  buttonText: propTypes.string.def(''),
  showButton: propTypes.bool.def(true)
})

const emit = defineEmits(['errorClick'])

const btnClick = () => {
  emit('errorClick', props.type)
}
</script>

<template>
  <div class="flex justify-center">
    <div class="text-center">
      <img :src="errorMap[type].url" alt="" width="350" />
      <div class="text-14px text-[var(--el-color-info)]">{{ message || errorMap[type].message }}</div>
      <div v-if="showButton || $slots.actions" class="mt-20px">
        <slot name="actions">
          <ElButton type="primary" @click="btnClick">
            {{ buttonText || errorMap[type].buttonText }}
          </ElButton>
        </slot>
      </div>
    </div>
  </div>
</template>
