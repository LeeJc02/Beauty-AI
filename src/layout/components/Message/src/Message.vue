<script lang="ts" setup>
import { formatDate } from '@/utils/formatTime'
import * as NotifyMessageApi from '@/api/system/notify/message'
import { useUserStoreWithOut } from '@/store/modules/user'
import { propTypes } from '@/utils/propTypes'

defineOptions({ name: 'Message' })

defineProps({
  color: propTypes.string.def('')
})

const { push } = useRouter()
const { t } = useI18n()
const userStore = useUserStoreWithOut()
const activeName = ref('notice')
const unreadCount = ref(0) // 未读消息数量
const activeTaskCount = ref(0) // 活跃任务数量
const list = ref<NotifyMessageApi.NotifyMessageVO[]>([]) // 消息列表
const activeTasks = ref<NotifyMessageApi.NotifyTaskMessageVO[]>([]) // 活跃任务列表
const markingAllRead = ref(false)
let unreadTimer: ReturnType<typeof setInterval> | undefined
let activeTaskTimer: ReturnType<typeof setInterval> | undefined

// 加载消息列表（仅加载数据，不清零小红点；用于预热与轮询）
const loadList = async () => {
  const [messages, tasks] = await Promise.all([
    NotifyMessageApi.getUnreadNotifyMessageList(),
    NotifyMessageApi.getActiveTaskNotifyMessageList()
  ])
  list.value = messages
  activeTasks.value = tasks
  activeTaskCount.value = tasks.length
}

// 点击铃铛：刷新列表并清零小红点，避免轮询太慢导致红点不消失
const getList = async () => {
  await loadList()
  unreadCount.value = 0
}

// 获得未读消息数
const getUnreadCount = async () => {
  NotifyMessageApi.getUnreadNotifyMessageCount().then((data) => {
    unreadCount.value = data
  })
}

// 跳转我的站内信
const goMyList = () => {
  push({
    name: 'MyNotifyMessage'
  })
}

const markAllRead = async () => {
  if (markingAllRead.value || !list.value.length) return
  markingAllRead.value = true
  try {
    await NotifyMessageApi.updateAllNotifyMessageRead()
    list.value = []
    unreadCount.value = 0
  } finally {
    markingAllRead.value = false
  }
}

const getTaskStatusText = (status?: number) => {
  if (status === 10) return t('systemManagement.notifyMessage.taskStatus.queued')
  if (status === 20) return t('systemManagement.notifyMessage.taskStatus.generating')
  return t('systemManagement.notifyMessage.taskStatus.running')
}

const goTask = (task: NotifyMessageApi.NotifyTaskMessageVO) => {
  if (!task.actionUrl) return
  push(task.actionUrl)
}

// ========== 初始化 =========
onMounted(() => {
  // 预热：未读数用于小红点；列表/任务预加载后，点开面板即可秒出
  getUnreadCount()
  loadList()
  // 轮询刷新小红点
  unreadTimer = setInterval(
    () => {
      if (userStore.getIsSetUser) {
        getUnreadCount()
      } else {
        unreadCount.value = 0
      }
    },
    1000 * 60 * 2
  )
  // 30s 轮询刷新列表与任务态，面板打开期间进度条也能自动更新
  activeTaskTimer = setInterval(
    () => {
      if (userStore.getIsSetUser) {
        loadList()
      } else {
        list.value = []
        activeTasks.value = []
        activeTaskCount.value = 0
      }
    },
    1000 * 30
  )
})

onUnmounted(() => {
  if (unreadTimer) clearInterval(unreadTimer)
  if (activeTaskTimer) clearInterval(activeTaskTimer)
})
</script>
<template>
  <div class="message h-full flex items-center !p-0">
    <ElPopover :width="400" placement="bottom" trigger="click">
      <template #reference>
        <ElBadge :is-dot="unreadCount > 0" class="item h-full flex items-center cursor-pointer px-10px">
          <span class="message-trigger flex items-center">
            <Icon :size="18" class="cursor-pointer" icon="ep:bell" :color="color" @click="getList" />
            <span v-if="unreadCount === 0 && activeTaskCount > 0" class="task-running-dot" ></span>
          </span>
        </ElBadge>
      </template>
      <ElTabs v-model="activeName">
        <ElTabPane :label="t('systemManagement.notifyMessage.myMessages')" name="notice">
          <el-scrollbar class="message-list">
            <div v-if="activeTasks.length" class="active-task-section">
              <div class="section-title">{{ t('systemManagement.notifyMessage.activeTasks') }}</div>
              <div v-for="task in activeTasks" :key="task.id" class="task-card">
                <div class="task-card-header">
                  <span class="task-title">{{ task.title || t('systemManagement.notifyMessage.defaultTaskTitle') }}</span>
                  <ElTag size="small" type="primary">{{ getTaskStatusText(task.status) }}</ElTag>
                </div>
                <ElProgress :percentage="task.progress || 0" :stroke-width="8" />
                <div class="task-card-footer">
                  <span>{{ task.progress || 0 }}%</span>
                  <ElButton v-if="task.actionUrl" link type="primary" @click="goTask(task)">
                    {{ t('systemManagement.common.detail') }}
                  </ElButton>
                </div>
              </div>
            </div>
            <template v-for="item in list" :key="item.id">
              <div class="message-item">
                <ElAvatar class="message-icon">
                  <DefaultUserAvatar :size="40" />
                </ElAvatar>
                <div class="message-content">
                  <span class="message-title">
                    {{ item.templateNickname }}：{{ item.templateContent }}
                  </span>
                  <span class="message-date">
                    {{ formatDate(item.createTime) }}
                  </span>
                </div>
              </div>
            </template>
          </el-scrollbar>
        </ElTabPane>
      </ElTabs>
      <!-- 更多 -->
      <div class="message-footer">
        <XButton
          preIcon="ep:circle-check"
          :title="t('systemManagement.notifyMessage.actions.markAllRead')"
          :loading="markingAllRead"
          :disabled="!list.length"
          @click="markAllRead"
        />
        <XButton preIcon="ep:view" :title="t('systemManagement.notifyMessage.viewAll')" type="primary" @click="goMyList" />
      </div>
    </ElPopover>
  </div>
</template>
<style lang="scss" scoped>
.message {
  display: inline-flex;
  align-items: center;
  height: 100%;
}

.message-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.item {
  display: inline-flex;
  align-items: center;
  line-height: 1;

  // 修复 badge 小红点被 viewport 顶部截断：top:0 + translateY(-50%) 导致红点上缘超出
  :deep(.el-badge__content.is-fixed) {
    top: 4px;
    transform: translate(100%, 0);
  }
}

.message-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.task-running-dot {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 8px;
  height: 8px;
  background: var(--el-color-primary);
  border: 1px solid var(--el-bg-color);
  border-radius: 50%;
  animation: task-running-pulse 1.6s ease-in-out infinite;
}

@keyframes task-running-pulse {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.85);
  }

  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

.message-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 260px;
  line-height: 45px;
}

.message-list {
  display: flex;
  height: 400px;
  flex-direction: column;

  .active-task-section {
    padding: 12px 4px 4px;
    border-bottom: 1px solid var(--el-border-color-light);

    .section-title {
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    .task-card {
      padding: 12px;
      margin-bottom: 10px;
      background: var(--el-fill-color-lighter);
      border: 1px solid var(--el-border-color-light);
      border-radius: 10px;

      .task-card-header,
      .task-card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .task-card-header {
        margin-bottom: 10px;
      }

      .task-title {
        max-width: 240px;
        overflow: hidden;
        font-weight: 600;
        color: var(--el-text-color-primary);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .task-card-footer {
        margin-top: 6px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .message-item {
    display: flex;
    align-items: center;
    padding: 20px 0;
    border-bottom: 1px solid var(--el-border-color-light);

    &:last-child {
      border: none;
    }

    .message-icon {
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      margin: 0 20px 0 5px;
    }

    .message-content {
      display: flex;
      flex-direction: column;

      .message-title {
        margin-bottom: 5px;
      }

      .message-date {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }
  }
}
</style>
