<script setup lang="ts">
/**
 * 组织架构查看（原型 `src/pages/OrganizationView.tsx`，仅超级管理员可见）。
 *
 * 左侧组织树 + 右侧节点详情（基础属性 / 下级节点列表），数据只读，由「立即同步」演示刷新。
 *
 * 与原型的两点差异：
 * - 原型把展开态放在递归 `TreeNode` 组件里（默认层级 < 2 展开）。这里改为把树拍平成
 *   带层级的行数组 + 一份 `expandedMap`，视觉与缩进完全一致，但避免了递归 SFC，
 *   也让「展开全部」这个原型里的占位按钮可以真正生效；
 * - 左树搜索框在原型里是纯展示，这里接上按节点名过滤（命中节点的祖先链会一并展开）。
 */
import { useBeautyI18n } from '@/beauty/composables'
import {
  isOrgPersonType,
  orgTypeBadgeClass,
  resolveOrgIconName,
  type OrgNode
} from './components/types'

defineOptions({ name: 'BeautyOrganization' })

/** 原型 initialOrgData。 */
const INITIAL_ORG_DATA: OrgNode[] = [
  {
    id: 'org_1',
    name: 'Lumina 全球总部',
    type: '总部',
    icon: 'Building2',
    code: 'HQ-GLOBAL',
    manager: 'Sarah Lee',
    contact: 'contact@lumina.global',
    children: [
      {
        id: 'org_2',
        name: '亚太区 (APAC)',
        type: '大区',
        icon: 'MapPin',
        code: 'REG-APAC',
        manager: 'Kenji Sato',
        contact: 'apac@lumina.global',
        children: [
          {
            id: 'org_3',
            name: '雅加达管辖区 (ID-JKT)',
            type: '区域',
            icon: 'MapPin',
            code: 'AREA-JKT',
            manager: 'Budi Santoso',
            contact: 'jkt@lumina.id',
            children: [
              {
                id: 'org_4',
                name: 'Toko Mal Kelapa Gading',
                type: '门店',
                icon: 'Store',
                code: 'STR-JKT-001',
                manager: 'Ahmad Maulana',
                contact: '+62 812-3456-7890',
                children: [
                  {
                    id: 'usr_1',
                    name: 'Ahmad Maulana',
                    type: '店长',
                    icon: 'User',
                    code: 'EMP-00101',
                    contact: 'ahmad.m@lumina.id'
                  },
                  {
                    id: 'usr_2',
                    name: 'Rina',
                    type: '高级BA',
                    icon: 'User',
                    code: 'EMP-00102',
                    contact: 'rina@lumina.id'
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
]

/** 拍平后的树行（{ node, level }），等价原型递归渲染出的可见节点序列。 */
interface OrgRow {
  node: OrgNode
  level: number
}

const { t } = useBeautyI18n()

const orgData = ref<OrgNode[]>(INITIAL_ORG_DATA)
const selectedNodeId = ref<string>('org_4')
const isSyncing = ref(false)
const searchQuery = ref('')

/**
 * 展开态：等价原型 TreeNode 的 `useState(level < 2)`，即层级 0、1 的节点初始展开。
 * 因为全部节点在初始化时就能拿到层级，所以一次性初始化即可。
 */
const expandedMap = ref<Record<string, boolean>>({})
const initExpandedMap = (nodes: OrgNode[], level: number) => {
  nodes.forEach((node) => {
    expandedMap.value[node.id] = level < 2
    if (node.children?.length) initExpandedMap(node.children, level + 1)
  })
}
initExpandedMap(orgData.value, 0)

const isExpanded = (node: OrgNode) => expandedMap.value[node.id] === true

const toggleNode = (node: OrgNode) => {
  expandedMap.value[node.id] = !isExpanded(node)
}

/** 搜索命中集合（含命中节点的全部祖先），非搜索态为 null。 */
const matchedNodeIds = computed<Set<string> | null>(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return null

  const matched = new Set<string>()
  const walk = (nodes: OrgNode[]): boolean => {
    let hit = false
    nodes.forEach((node) => {
      const childHit = node.children?.length ? walk(node.children) : false
      if (childHit || node.name.toLowerCase().includes(keyword)) {
        matched.add(node.id)
        hit = true
      }
    })
    return hit
  }
  walk(orgData.value)
  return matched
})

const visibleRows = computed<OrgRow[]>(() => {
  const matched = matchedNodeIds.value

  const walk = (nodes: OrgNode[], level: number): OrgRow[] =>
    nodes.flatMap((node) => {
      if (matched && !matched.has(node.id)) return []
      const row: OrgRow = { node, level }
      const children = node.children ?? []
      // 搜索态下强制展开，保证命中节点的祖先链可见
      if (!children.length || !(matched || isExpanded(node))) return [row]
      return [row, ...walk(children, level + 1)]
    })

  return walk(orgData.value, 0)
})

/** 等价原型 findNodeById。 */
const findNodeById = (nodes: OrgNode[], id: string): OrgNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

const selectedNode = computed(() => findNodeById(orgData.value, selectedNodeId.value))

/** 等价原型 handleSync：1.5s 同步动画（顶部「最近同步」文案保持原型写死的值）。 */
const handleSync = () => {
  isSyncing.value = true
  setTimeout(() => {
    isSyncing.value = false
  }, 1500)
}

/** 展开全部可展开节点（原型里这个按钮没有 handler，这里补上）。 */
const expandAll = () => {
  const walk = (nodes: OrgNode[]) => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        expandedMap.value[node.id] = true
        walk(node.children)
      }
    })
  }
  walk(orgData.value)
}
</script>

<template>
  <div class="flex h-[calc(100vh-11.5rem)] min-h-[620px] flex-1 flex-col pt-2">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-[#1F1C1F]">查看组织架构</h2>
        <p class="mt-1 text-sm text-[#766F73]">组织架构数据由外部主系统自动同步，仅提供只读展示</p>
      </div>
      <div class="flex items-center space-x-4">
        <div
          class="flex items-center rounded-lg border border-[#E9E4DF] bg-[#F8F5F3] px-3 py-1.5 text-xs font-medium text-[#766F73]"
        >
          <Icon icon="lucide:refresh-cw" :size="12" class="mr-1.5 text-[#9A9396]" />
          {{ t('最近同步:') }}
          <span class="ml-1 font-bold text-[#3F3A3D]">今天 08:30</span>
        </div>
        <el-button
          type="primary"
          :disabled="isSyncing"
          class="!h-9 !rounded-xl !border-rose-600 !bg-rose-600 !font-bold !text-white shadow-sm hover:!border-rose-700 hover:!bg-rose-700"
          @click="handleSync"
        >
          <Icon icon="lucide:refresh-cw" :size="16" class="mr-2" :class="{ 'animate-spin': isSyncing }" />
          {{ isSyncing ? '同步中...' : '立即同步' }}
        </el-button>
      </div>
    </div>

    <div class="flex h-full min-h-0 gap-6">
      <!-- 左：组织树 -->
      <div
        class="flex w-1/3 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm"
      >
        <div class="shrink-0 border-b border-slate-50 p-4">
          <div class="relative">
            <Icon
              icon="lucide:search"
              :size="16"
              class="absolute top-1/2 left-3 -translate-y-1/2 text-[#9A9396]"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索组织节点或人员名称..."
              class="w-full rounded-xl border border-[#E5DED8] bg-[#F8F5F3] py-2 pr-4 pl-9 text-sm font-medium text-[#3F3A3D] outline-none transition-all focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3">
          <div
            v-for="row in visibleRows"
            :key="row.node.id"
            class="flex cursor-pointer items-center rounded-lg border py-2 px-3 transition-colors hover:bg-[#F8F5F3]"
            :class="
              selectedNodeId === row.node.id
                ? 'border-rose-100 bg-rose-50'
                : 'border-transparent'
            "
            :style="{ paddingLeft: `${row.level * 1.25 + 0.5}rem` }"
            @click="selectedNodeId = row.node.id"
          >
            <div
              class="mr-1 flex h-5 w-5 items-center justify-center"
              @click.stop="toggleNode(row.node)"
            >
              <Icon
                v-if="row.node.children?.length"
                :icon="isExpanded(row.node) ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                :size="16"
                class="text-[#9A9396]"
              />
            </div>
            <Icon
              :icon="resolveOrgIconName(row.node.icon)"
              :size="16"
              class="mr-2"
              :class="selectedNodeId === row.node.id ? 'text-rose-600' : 'text-[#766F73]'"
            />
            <span
              class="truncate text-sm tracking-tight"
              :class="
                selectedNodeId === row.node.id
                  ? 'font-bold text-rose-950'
                  : 'font-medium text-[#3F3A3D]'
              "
            >
              {{ row.node.name }}
            </span>
            <span
              class="ml-auto shrink-0 rounded-full px-1.5 py-0 text-[10px] font-bold"
              :class="orgTypeBadgeClass(row.node.type)"
            >
              {{ row.node.type }}
            </span>
          </div>
        </div>

        <div
          class="flex shrink-0 items-center justify-end rounded-b-2xl border-t border-slate-50 bg-[#F8F5F3]/50 p-4"
        >
          <button
            type="button"
            class="text-[10px] font-bold tracking-widest text-[#9A9396] uppercase transition-colors hover:text-[#5D565A]"
            @click="expandAll"
          >
            展开全部
          </button>
        </div>
      </div>

      <!-- 右：节点详情 -->
      <div
        class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#E9E4DF] bg-white shadow-sm"
      >
        <template v-if="selectedNode">
          <div class="border-b border-slate-50 bg-[#F8F5F3]/30 p-6 pb-4">
            <div class="flex items-start justify-between">
              <div class="flex items-center space-x-4">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5DED8] bg-white text-[#3F3A3D] shadow-sm"
                >
                  <Icon :icon="resolveOrgIconName(selectedNode.icon)" :size="24" />
                </div>
                <div>
                  <h2 class="text-xl font-bold text-[#1F1C1F]">{{ selectedNode.name }}</h2>
                  <div class="mt-1 flex items-center text-sm font-medium">
                    <span
                      class="mr-2 inline-flex h-5 w-fit shrink-0 items-center rounded-full border border-transparent bg-slate-200 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#5D565A]"
                    >
                      {{ selectedNode.type }}
                    </span>
                    <span
                      class="rounded border border-[#E9E4DF] bg-white px-1.5 py-0.5 font-mono text-xs text-[#9A9396]"
                    >
                      ID: {{ selectedNode.code }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="flex space-x-2">
                <span
                  class="pointer-events-none inline-flex h-5 w-fit shrink-0 items-center rounded-full border border-[#E5DED8] bg-[#F8F5F3] px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#766F73]"
                >
                  <Icon icon="lucide:refresh-cw" :size="12" class="mr-1" /> 已同步
                </span>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6">
            <div class="grid grid-cols-2 gap-8">
              <!-- 基础属性 -->
              <div class="space-y-6">
                <h3
                  class="border-b border-[#E9E4DF] pb-2 text-sm font-bold tracking-widest text-[#1F1C1F] uppercase"
                >
                  基础属性
                </h3>

                <div class="space-y-4">
                  <div class="space-y-1.5">
                    <label
                      class="text-xs font-semibold tracking-wider text-[#766F73] uppercase"
                    >
                      节点名称
                    </label>
                    <div
                      class="rounded-lg border border-[#E9E4DF] bg-[#F8F5F3]/50 px-3 py-2 text-sm font-medium text-[#242124]"
                    >
                      {{ selectedNode.name }}
                    </div>
                  </div>

                  <div class="space-y-1.5">
                    <label
                      class="text-xs font-semibold tracking-wider text-[#766F73] uppercase"
                    >
                      节点编码 (唯一标识)
                    </label>
                    <div
                      class="flex items-center rounded-lg border border-[#E9E4DF] bg-[#F8F5F3]/50 px-3 py-2 font-mono text-sm text-[#3F3A3D]"
                    >
                      <Icon icon="lucide:hash" :size="16" class="mr-2 shrink-0 text-[#9A9396]" />
                      {{ selectedNode.code || '-' }}
                    </div>
                  </div>

                  <div class="space-y-1.5">
                    <label
                      class="text-xs font-semibold tracking-wider text-[#766F73] uppercase"
                    >
                      负责人 / 联络人
                    </label>
                    <div
                      class="flex items-center rounded-lg border border-[#E9E4DF] bg-[#F8F5F3]/50 px-3 py-2 text-sm font-medium text-[#3F3A3D]"
                    >
                      <Icon icon="lucide:user" :size="16" class="mr-2 shrink-0 text-[#9A9396]" />
                      <span v-if="selectedNode.manager">{{ selectedNode.manager }}</span>
                      <span v-else class="text-[#9A9396] italic">暂无指定负责人</span>
                    </div>
                  </div>

                  <div class="space-y-1.5">
                    <label
                      class="text-xs font-semibold tracking-wider text-[#766F73] uppercase"
                    >
                      联络方式
                    </label>
                    <div
                      class="flex items-center rounded-lg border border-[#E9E4DF] bg-[#F8F5F3]/50 px-3 py-2 text-sm font-medium text-[#3F3A3D]"
                    >
                      <Icon icon="lucide:mail" :size="16" class="mr-2 shrink-0 text-[#9A9396]" />
                      <span v-if="selectedNode.contact">{{ selectedNode.contact }}</span>
                      <span v-else class="text-[#9A9396] italic">暂无联络方式</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 下级节点列表 -->
              <div class="space-y-6">
                <h3
                  class="border-b border-[#E9E4DF] pb-2 text-sm font-bold tracking-widest text-[#1F1C1F] uppercase"
                >
                  下级节点列表
                </h3>

                <div
                  v-if="isOrgPersonType(selectedNode.type)"
                  class="rounded-xl border border-[#F2DEC0] bg-[#FFF7EA] p-4 text-sm text-[#8B621F]"
                >
                  <p class="mb-1 font-bold">终端节点 (叶子节点)</p>
                  <p class="text-[#B9822B] opacity-80">当前选中的是人员节点类型，没有下级组织机构。</p>
                </div>

                <div
                  v-else-if="!selectedNode.children?.length"
                  class="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E5DED8] bg-[#F8F5F3]/50 py-8 text-[#9A9396]"
                >
                  <Icon icon="lucide:layers" :size="32" class="mb-2 text-[#9A9396] opacity-50" />
                  <p class="text-sm font-medium">该节点下暂无子机构或人员</p>
                </div>

                <div v-else class="mt-4">
                  <p
                    class="mb-3 text-xs font-semibold tracking-wider text-[#766F73] uppercase"
                  >
                    当前直属下级 ({{ selectedNode.children.length }})
                  </p>
                  <div class="max-h-[300px] space-y-2 overflow-y-auto pr-2">
                    <div
                      v-for="child in selectedNode.children"
                      :key="child.id"
                      class="flex items-center justify-between rounded-xl border border-[#E9E4DF] bg-white p-3 shadow-sm"
                    >
                      <div class="flex items-center space-x-3">
                        <div class="rounded-md bg-[#F8F5F3] p-1.5">
                          <Icon
                            :icon="resolveOrgIconName(child.icon)"
                            :size="12"
                            class="text-[#766F73]"
                          />
                        </div>
                        <div>
                          <p class="text-sm leading-none font-bold text-[#242124]">
                            {{ child.name }}
                          </p>
                          <p class="mt-1 font-mono text-[10px] text-[#9A9396]">{{ child.code }}</p>
                        </div>
                      </div>
                      <span
                        class="inline-flex h-5 w-fit shrink-0 items-center rounded-full border border-[#E5DED8] px-2 py-0 text-[10px] font-medium whitespace-nowrap"
                      >
                        {{ child.type }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
          <Icon icon="lucide:building-2" :size="64" class="mb-4 opacity-20" />
          <p class="text-lg font-semibold text-[#5D565A]">选择一个组织节点</p>
          <p class="mt-1 text-sm">在左侧架构树中点击节点以查看详细信息</p>
        </div>
      </div>
    </div>
  </div>
</template>
