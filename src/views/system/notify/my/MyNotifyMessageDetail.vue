<template>
  <Dialog v-model="dialogVisible" :max-height="500" :scroll="true" :title="t('systemManagement.notifyMessage.messageDetail')">
    <el-descriptions :column="1" border>
      <el-descriptions-item :label="t('systemManagement.notifyMessage.fields.sender')">
        {{ detailData.templateNickname }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemManagement.notifyMessage.fields.sendTime')">
        {{ formatDate(detailData.createTime) }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemManagement.notifyMessage.fields.messageType')">
        <el-tag :type="getNotifyTypeTagType(detailData.templateType)">
          {{ getNotifyTypeLabel(detailData.templateType) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemManagement.notifyMessage.fields.readStatus')">
        <el-tag :type="detailData.readStatus ? 'success' : 'info'">
          {{ getReadStatusLabel(detailData.readStatus) }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item v-if="detailData.readStatus" :label="t('systemManagement.notifyMessage.fields.readTime')">
        {{ formatDate(detailData.readTime) }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('systemManagement.notifyMessage.fields.content')">
        {{ detailData.templateContent }}
      </el-descriptions-item>
    </el-descriptions>
  </Dialog>
</template>
<script lang="ts" setup>
import { formatDate } from '@/utils/formatTime'
import * as NotifyMessageApi from '@/api/system/notify/message'

const { t } = useI18n() // 国际化

defineOptions({ name: 'MyNotifyMessageDetailDetail' })

const dialogVisible = ref(false) // 弹窗的是否展示
const detailLoading = ref(false) // 表单的加载中
const detailData = ref({} as NotifyMessageApi.NotifyMessageVO) // 详情数据
const getReadStatusLabel = (readStatus: boolean) =>
  readStatus ? t('systemManagement.common.yes') : t('systemManagement.common.no')
const notifyTypeLabels = computed<Record<number, string>>(() => ({
  1: t('systemManagement.notifyMessage.types.announcement'),
  2: t('systemManagement.notifyMessage.types.system')
}))
const getNotifyTypeLabel = (type?: number) =>
  notifyTypeLabels.value[Number(type)] || t('systemManagement.common.notSet')
const getNotifyTypeTagType = (type?: number) => (Number(type) === 2 ? 'success' : 'primary')

/** 打开弹窗 */
const open = async (data: NotifyMessageApi.NotifyMessageVO) => {
  dialogVisible.value = true
  // 设置数据
  detailLoading.value = true
  try {
    detailData.value = data
  } finally {
    detailLoading.value = false
  }
}
defineExpose({ open }) // 提供 open 方法，用于打开弹窗
</script>
