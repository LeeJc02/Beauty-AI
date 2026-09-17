<script setup lang="ts">
/**
 * 账号管理（原型 `src/pages/UsersManage.tsx`，仅超级管理员可见）。
 *
 * 演示账号列表 + Excel 批量导入弹窗：点「开始导入」1.5s 后追加两个未激活账号（等价原型 setTimeout）。
 *
 * 与原型的两点差异（均为交互补全，不改变视觉）：
 * - 顶部搜索框在原型里是纯展示（无 onChange），这里接上按姓名/邮箱过滤，「共计 N 个账号」跟随过滤结果；
 * - 「单点新增账号 / 下载导入模板 / 发送激活通知 / 编辑 / 查看详情」在原型里是占位按钮（无 handler），保持原样不动作。
 */
import { useBeautyI18n } from '@/beauty/composables'

defineOptions({ name: 'BeautyAccounts' })

const { t } = useBeautyI18n()

type AccountStatus = '已激活' | '未激活'

interface PlatformUser {
  id: string
  name: string
  role: string
  region: string
  email: string
  status: AccountStatus
}

/** 原型 MOCK_USERS（角色名 / 区域名原样保留，交给 DOM 翻译运行时处理）。 */
const MOCK_USERS: PlatformUser[] = [
  {
    id: 'usr_1',
    name: 'Ahmad Maulana',
    role: '店长',
    region: '雅加达南区',
    email: 'ahmad.m@lumina.id',
    status: '已激活'
  },
  {
    id: 'usr_2',
    name: 'Rina',
    role: '高级BA',
    region: '雅加达南区',
    email: 'rina@lumina.id',
    status: '已激活'
  },
  {
    id: 'usr_3',
    name: 'Dewi',
    role: '初级BA',
    region: '万隆区',
    email: 'dewi@lumina.id',
    status: '未激活'
  }
]

/** 原型里「已激活」的行会带一个研发备注气泡。 */
const ACTIVATION_NOTE =
  '研发备注：已激活的定义为已下载APP登录。'

const users = ref<PlatformUser[]>(MOCK_USERS.map((user) => ({ ...user })))
const searchQuery = ref('')
const importDialog = ref(false)
const isImporting = ref(false)

const filteredUsers = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return users.value
  return users.value.filter(
    (user) =>
      user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)
  )
})

/** 备注气泡只挂在筛选结果里第一条「已激活」账号上（等价原型的 firstActiveIndex）。 */
const firstActiveUserId = computed(
  () => filteredUsers.value.find((user) => user.status === '已激活')?.id
)

/** 等价原型 handleImport：1.5s 后追加两个未激活账号并关闭弹窗。 */
const handleImport = () => {
  isImporting.value = true
  setTimeout(() => {
    const stamp = Date.now()
    users.value = [
      ...users.value,
      {
        id: `usr_${stamp}`,
        name: 'Budi Santoso',
        role: '区域经理',
        region: '大区',
        email: 'budi@lumina.id',
        status: '未激活'
      },
      {
        id: `usr_${stamp + 1}`,
        name: 'Fitriani',
        role: '区域培训师主管',
        region: '大区',
        email: 'fitriani@lumina.id',
        status: '未激活'
      }
    ]
    isImporting.value = false
    importDialog.value = false
  }, 1500)
}
</script>

<template>
  <div class="flex h-[calc(100vh-11.5rem)] min-h-[560px] flex-1 flex-col pt-2">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-[#1F1C1F]">账号管理与批量入驻</h2>
        <p class="mt-1 text-sm text-[#766F73]">
          系统管理员可批量导入、激活并管理所有平台用户账号
        </p>
      </div>
      <div class="flex items-center space-x-4">
        <el-button class="!border-[#E5DED8]" @click="importDialog = true">
          <Icon icon="lucide:file-up" :size="16" class="mr-2" /> Excel 批量导入
        </el-button>
        <el-button
          type="primary"
          class="!border-rose-600 !bg-rose-600 !text-white hover:!border-rose-700 hover:!bg-rose-700"
        >
          <Icon icon="lucide:plus" :size="16" class="mr-2" /> 单点新增账号
        </el-button>
      </div>
    </div>

    <div
      class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm"
    >
      <div class="flex items-center justify-between border-b border-slate-50 bg-[#F8F5F3]/50 p-4">
        <div class="relative w-64">
          <Icon
            icon="lucide:search"
            :size="16"
            class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索姓名或邮箱..."
            class="w-full rounded-lg border border-[#E5DED8] bg-white py-1.5 pr-3 pl-9 text-sm text-[#242124] outline-none placeholder:text-[#9A9396] focus:border-[#A85F4B] focus:ring-2 focus:ring-[#A85F4B]/20"
          />
        </div>
        <div class="flex items-center space-x-2 text-sm text-[#766F73]">
          <Icon icon="lucide:database" :size="16" />
          <span>{{ t(`共计 ${filteredUsers.length} 个账号`) }}</span>
        </div>
      </div>

      <div class="flex-1 overflow-auto p-0">
        <table class="w-full border-collapse text-left">
          <thead
            class="sticky top-0 z-10 bg-[#F8F5F3]/80 backdrop-blur-sm"
          >
            <tr>
              <th
                class="border-b border-[#E9E4DF] px-6 py-3 text-xs font-semibold tracking-wider text-[#766F73] uppercase"
              >
                员工姓名
              </th>
              <th
                class="border-b border-[#E9E4DF] px-6 py-3 text-xs font-semibold tracking-wider text-[#766F73] uppercase"
              >
                系统角色
              </th>
              <th
                class="border-b border-[#E9E4DF] px-6 py-3 text-xs font-semibold tracking-wider text-[#766F73] uppercase"
              >
                所属区域
              </th>
              <th
                class="border-b border-[#E9E4DF] px-6 py-3 text-xs font-semibold tracking-wider text-[#766F73] uppercase"
              >
                联系邮箱
              </th>
              <th
                class="border-b border-[#E9E4DF] px-6 py-3 text-xs font-semibold tracking-wider text-[#766F73] uppercase"
              >
                当前状态
              </th>
              <th
                class="border-b border-[#E9E4DF] px-6 py-3 text-right text-xs font-semibold tracking-wider text-[#766F73] uppercase"
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              class="transition-colors hover:bg-[#F8F5F3]/50"
            >
              <td class="px-6 py-3 font-medium text-[#242124]">{{ user.name }}</td>
              <td class="px-6 py-3 text-sm text-[#5D565A]">{{ user.role }}</td>
              <td class="flex items-center px-6 py-3 text-sm text-[#766F73]">{{ user.region }}</td>
              <td class="px-6 py-3 text-sm text-[#5D565A]">{{ user.email }}</td>
              <td class="px-6 py-3">
                <div class="activation-note relative inline-flex items-center overflow-visible">
                  <span
                    class="inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                    :class="
                      user.status === '已激活'
                        ? 'border-emerald-200 bg-[#EEF8F4] text-[#3B8F72]'
                        : 'border-[#E8CCA0] bg-[#FFF7EA] text-[#B9822B]'
                    "
                  >
                    {{ user.status }}
                  </span>
                  <template v-if="user.id === firstActiveUserId">
                    <span
                      class="absolute -top-2 -right-1 z-10 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-center text-[9px] leading-4 font-bold text-white shadow-sm backdrop-blur-sm"
                    >
                      注
                    </span>
                    <div
                      class="activation-note__tip absolute right-0 bottom-full z-[80] mb-2 w-72 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm"
                    >
                      {{ t(ACTIVATION_NOTE) }}
                    </div>
                  </template>
                </div>
              </td>
              <td class="px-6 py-3 text-right">
                <el-button
                  v-if="user.status === '未激活'"
                  size="small"
                  class="!h-7 !border-rose-200 !text-xs !text-rose-600 hover:!bg-rose-50"
                >
                  发送激活通知
                </el-button>
                <el-button v-else size="small" text class="!h-7 !text-xs !text-[#9A9396]">
                  编辑
                </el-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <el-dialog v-model="importDialog" width="480px" append-to-body destroy-on-close>
      <template #header>
        <h3 class="text-base font-semibold text-[#242124]">从 Excel 批量导入账号</h3>
      </template>

      <div class="py-6">
        <div
          class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E5DED8] bg-[#F8F5F3] p-8"
        >
          <Icon icon="lucide:file-up" :size="40" class="mb-4 text-rose-400" />
          <p class="text-sm font-semibold text-[#3F3A3D]">点击上传或将 Excel 文件拖拽至此</p>
          <p class="mt-1 text-xs text-[#9A9396]">支持 .xlsx, .csv 格式，最大 10MB</p>
          <el-button size="small" class="mt-4">下载导入模板</el-button>
        </div>

        <div class="mt-4 flex items-start rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
          <Icon icon="lucide:mail" :size="16" class="mr-2 mt-0.5 shrink-0" />
          <span>导入成功后，系统将自动向所有新账号发送包含验证链接的激活通知邮件。</span>
        </div>
      </div>

      <div class="flex justify-end space-x-3 border-t border-[#E9E4DF] pt-4">
        <el-button @click="importDialog = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="isImporting"
          class="!min-w-[100px] !border-rose-600 !bg-rose-600 !text-white hover:!border-rose-700 hover:!bg-rose-700"
          @click="handleImport"
        >
          {{ isImporting ? '导入中...' : '开始导入' }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
/* 原型用 group-hover/activation-note:block 控制研发备注气泡，unocss 0.58 的命名分组变体不可靠，改用 scoped css。 */
.activation-note__tip {
  display: none;
}

.activation-note:hover .activation-note__tip,
.activation-note:focus-within .activation-note__tip {
  display: block;
}
</style>
