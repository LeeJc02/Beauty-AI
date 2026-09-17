<template>
  <doc-alert :title="t('systemManagement.notifyMessage.docTitle')" url="https://doc.iocoder.cn/notify/" />

  <ContentWrap>
    <!-- 搜索工作栏 -->
    <el-form
      class="-mb-15px"
      :model="queryParams"
      ref="queryFormRef"
      :inline="true"
      label-width="104px"
    >
      <el-form-item :label="t('systemManagement.notifyMessage.fields.readStatus')" prop="readStatus">
        <el-select
          v-model="queryParams.readStatus"
          :placeholder="t('systemManagement.placeholder.selectStatus')"
          clearable
          class="!w-240px"
        >
          <el-option
            v-for="option in readStatusOptions"
            :key="String(option.value)"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('systemManagement.notifyMessage.fields.sendTime')" prop="createTime">
        <el-date-picker
          v-model="queryParams.createTime"
          value-format="YYYY-MM-DD HH:mm:ss"
          type="daterange"
          :start-placeholder="t('systemManagement.placeholder.startDate')"
          :end-placeholder="t('systemManagement.placeholder.endDate')"
          :default-time="[new Date('1 00:00:00'), new Date('1 23:59:59')]"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> {{ t('systemManagement.common.search') }}</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> {{ t('systemManagement.common.reset') }}</el-button>
        <el-button @click="handleUpdateList">
          <Icon icon="ep:reading" class="mr-5px" /> {{ t('systemManagement.notifyMessage.actions.markRead') }}
        </el-button>
        <el-button @click="handleUpdateAll">
          <Icon icon="ep:reading" class="mr-5px" /> {{ t('systemManagement.notifyMessage.actions.markAllRead') }}
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- 列表 -->
  <ContentWrap>
    <el-table
      v-loading="loading"
      :data="list"
      ref="tableRef"
      row-key="id"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" :selectable="selectable" :reserve-selection="true" />
      <el-table-column :label="t('systemManagement.notifyMessage.fields.sender')" align="center" prop="templateNickname" width="180" />
      <el-table-column
        :label="t('systemManagement.notifyMessage.fields.sendTime')"
        align="center"
        prop="createTime"
        width="200"
        :formatter="dateFormatter"
      />
      <el-table-column :label="t('systemManagement.notifyMessage.fields.type')" align="center" prop="templateType" width="180">
        <template #default="scope">
          <el-tag :type="getNotifyTypeTagType(scope.row.templateType)">
            {{ getNotifyTypeLabel(scope.row.templateType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemManagement.notifyMessage.fields.messageContent')"
        align="center"
        prop="templateContent"
        show-overflow-tooltip
      />
      <el-table-column :label="t('systemManagement.notifyMessage.fields.readStatus')" align="center" prop="readStatus" width="180">
        <template #default="scope">
          <el-tag :type="scope.row.readStatus ? 'success' : 'info'">
            {{ getReadStatusLabel(scope.row.readStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        :label="t('systemManagement.notifyMessage.fields.readTime')"
        align="center"
        prop="readTime"
        width="200"
        :formatter="dateFormatter"
      />
      <el-table-column :label="t('systemManagement.common.operation')" align="center" width="160">
        <template #default="scope">
          <el-button
            link
            :type="scope.row.readStatus ? 'primary' : 'warning'"
            @click="openDetail(scope.row)"
          >
            {{ scope.row.readStatus ? t('systemManagement.common.detail') : t('systemManagement.notifyMessage.actions.read') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <!-- 分页 -->
    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>

  <!-- 表单弹窗：详情 -->
  <MyNotifyMessageDetail ref="detailRef" />
</template>

<script lang="ts" setup>
import { dateFormatter } from '@/utils/formatTime'
import * as NotifyMessageApi from '@/api/system/notify/message'
import MyNotifyMessageDetail from './MyNotifyMessageDetail.vue'

defineOptions({ name: 'SystemMyNotify' })

const message = useMessage() // 消息
const { t } = useI18n() // 国际化

const loading = ref(true) // 列表的加载中
const total = ref(0) // 列表的总页数
const list = ref([]) // 列表的数据
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  readStatus: undefined,
  createTime: []
})
const queryFormRef = ref() // 搜索的表单
const tableRef = ref() // 表格的 Ref
const selectedIds = ref<number[]>([]) // 表格的选中 ID 数组
const readStatusOptions = computed(() => [
  { label: t('systemManagement.common.yes'), value: true },
  { label: t('systemManagement.common.no'), value: false }
])
const getReadStatusLabel = (readStatus: boolean) =>
  readStatus ? t('systemManagement.common.yes') : t('systemManagement.common.no')
const notifyTypeLabels = computed<Record<number, string>>(() => ({
  1: t('systemManagement.notifyMessage.types.announcement'),
  2: t('systemManagement.notifyMessage.types.system')
}))
const getNotifyTypeLabel = (type?: number) =>
  notifyTypeLabels.value[Number(type)] || t('systemManagement.common.notSet')
const getNotifyTypeTagType = (type?: number) => (Number(type) === 2 ? 'success' : 'primary')

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    const data = await NotifyMessageApi.getMyNotifyMessagePage(queryParams)
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

/** 搜索按钮操作 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置按钮操作 */
const resetQuery = () => {
  queryFormRef.value.resetFields()
  tableRef.value.clearSelection()
  handleQuery()
}

/** 详情操作 */
const detailRef = ref()
const openDetail = (data: NotifyMessageApi.NotifyMessageVO) => {
  if (!data.readStatus) {
    handleReadOne(data.id)
  }
  detailRef.value.open(data)
}

/** 标记一条站内信已读 */
const handleReadOne = async (id) => {
  await NotifyMessageApi.updateNotifyMessageRead(id)
  await getList()
}

/** 标记全部站内信已读 **/
const handleUpdateAll = async () => {
  await NotifyMessageApi.updateAllNotifyMessageRead()
  message.success(t('systemManagement.notifyMessage.messages.markAllReadSuccess'))
  tableRef.value.clearSelection()
  await getList()
}

/** 标记一些站内信已读 **/
const handleUpdateList = async () => {
  if (selectedIds.value.length === 0) {
    return
  }
  await NotifyMessageApi.updateNotifyMessageRead(selectedIds.value)
  message.success(t('systemManagement.notifyMessage.messages.markSelectedReadSuccess'))
  tableRef.value.clearSelection()
  await getList()
}

/** 某一行，是否允许选中 */
const selectable = (row) => {
  return !row.readStatus
}

/** 当表格选择项发生变化时会触发该事件  */
const handleSelectionChange = (array: NotifyMessageApi.NotifyMessageVO[]) => {
  selectedIds.value = []
  if (!array) {
    return
  }
  array.forEach((row) => selectedIds.value.push(row.id))
}

/** 初始化 **/
onMounted(() => {
  getList()
})
</script>
