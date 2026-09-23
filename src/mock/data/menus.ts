import type { DemoRoleKey } from './roles'

/**
 * 菜单定义。
 *
 * 路径规则与 yudao 一致：顶层菜单用绝对路径（/courseware），子菜单用相对路径（create），
 * 这样 vue-router 嵌套解析出来的完整路径是 /courseware/create，
 * layout 侧 pathResolve(parentPath, childPath) 也能得到同样的结果。
 */
interface MenuNode {
  path: string
  name: string
  i18nKey: string
  icon: string
  component?: string
  children?: MenuNode[]
}

const leaf = (path: string, name: string, i18nKey: string, icon: string, component: string): MenuNode => ({
  path,
  name,
  i18nKey,
  icon,
  component
})

const group = (path: string, name: string, i18nKey: string, icon: string, children: MenuNode[]): MenuNode => ({
  path,
  name,
  i18nKey,
  icon,
  children
})

/* ------------------------------------------------------------------ *
 * 看板 / 审计
 * ------------------------------------------------------------------ */
const menuOverview = leaf('/runtime-overview', '运行概览', 'beautyMenu.runtimeOverview', 'ep:data-line', 'beauty/dashboard/overview/index')
const menuNational = leaf('/national-data', '全国数据', 'beautyMenu.nationalData', 'ep:data-analysis', 'beauty/dashboard/national/index')
const menuRegional = leaf('/regional-data', '区域数据', 'beautyMenu.regionalData', 'ep:trend-charts', 'beauty/dashboard/regional/index')
const menuAudit = leaf('/data-audit', '智能巡检', 'beautyMenu.dataAudit', 'lucide:shield-check', 'beauty/audit/index')

/* ------------------------------------------------------------------ *
 * 课件（直接跑 SalesBoost-vue 的课件页）
 * ------------------------------------------------------------------ */
const coursewareCreate = () => leaf('create', '生成新课件', 'beautyMenu.coursewareCreate', 'ep:document-add', 'courseware/create/index')
const coursewareManage = (regional: boolean) =>
  leaf(
    'manage',
    regional ? '区域课件管理' : '课件管理',
    regional ? 'beautyMenu.regionalCoursewareManage' : 'beautyMenu.coursewareManage',
    'ep:folder-opened',
    'courseware/manage/index'
  )

/* ------------------------------------------------------------------ *
 * AI 陪练
 * ------------------------------------------------------------------ */
const baAvatars = (regional: boolean) =>
  leaf(
    'avatars',
    regional ? '区域数字人顾客' : '数字人顾客',
    regional ? 'beautyMenu.regionalBaAvatars' : 'beautyMenu.baAvatars',
    'ep:avatar',
    'beauty/ba/avatars/index'
  )
const baScripts = (regional: boolean) =>
  leaf(
    'scripts',
    regional ? '区域场景剧本' : '场景剧本',
    regional ? 'beautyMenu.regionalBaScripts' : 'beautyMenu.baScripts',
    'ep:notebook',
    'beauty/ba/scripts/index'
  )
const baQuotes = leaf('quotes', '金句库', 'beautyMenu.baQuotes', 'ep:collection', 'beauty/ba/quotes/index')
const materialLibrary = (path = '/material-library', name = '素材库', i18nKey = 'beautyMenu.materialLibrary'): MenuNode =>
  leaf(path, name, i18nKey, 'ep:folder', 'beauty/material-library/index')

/* ------------------------------------------------------------------ *
 * 题目与考试
 * ------------------------------------------------------------------ */
const examGroup = () =>
  group('/exam', '题目与考试', 'beautyMenu.examGroup', 'ep:list', [
    leaf('generate', '生成题目', 'beautyMenu.examGenerate', 'ep:magic-stick', 'beauty/exam/generate/index'),
    leaf('bank', '题库管理', 'beautyMenu.examBank', 'ep:files', 'beauty/exam/bank/index'),
    leaf('homework', '关联附加题管理', 'beautyMenu.examHomework', 'ep:link', 'beauty/exam/homework/index'),
    leaf('assemble', '考试组卷', 'beautyMenu.examAssemble', 'ep:edit-pen', 'beauty/exam/assemble/index')
  ])

/* ------------------------------------------------------------------ *
 * 周期任务
 * ------------------------------------------------------------------ */
const taskChildren = (withExam = true): MenuNode[] => [
  leaf('study', '学习任务管理', 'beautyMenu.taskStudy', 'ep:reading', 'beauty/tasks/study/index'),
  leaf('practice', '练习任务管理', 'beautyMenu.taskPractice', 'ep:refresh', 'beauty/tasks/practice/index'),
  leaf('media-collection', '音视频采集任务', 'beautyMenu.taskMedia', 'ep:video-camera', 'beauty/tasks/media-collection/index'),
  leaf('photo-checkin', 'BA打卡记录', 'beautyMenu.taskPhotoCheckin', 'ep:camera', 'beauty/tasks/photo-checkin/index'),
  materialLibrary('material-library'),
  ...(withExam
    ? [leaf('exam', '考试任务管理', 'beautyMenu.taskExam', 'ep:document-checked', 'beauty/tasks/exam/index')]
    : [])
]

const tasksGroup = (name = '周期任务', i18nKey = 'beautyMenu.tasksGroup') =>
  group('/tasks', name, i18nKey, 'ep:folder-opened', taskChildren())

/* ------------------------------------------------------------------ *
 * 组织与档案
 * ------------------------------------------------------------------ */
const archivesGroup = (regional: boolean) =>
  group('/archives', '组织与档案', 'beautyMenu.archivesGroup', 'ep:user', [
    leaf(
      'stores',
      regional ? '门店总档案' : '全国门店总档案',
      regional ? 'beautyMenu.regionalArchiveStores' : 'beautyMenu.archiveStores',
      'ep:office-building',
      'beauty/archives/stores/index'
    ),
    leaf(
      'personnel',
      regional ? '人员档案' : '全国人员档案',
      regional ? 'beautyMenu.regionalArchivePersonnel' : 'beautyMenu.archivePersonnel',
      'ep:user',
      'beauty/archives/personnel/index'
    )
  ])

/* ------------------------------------------------------------------ *
 * 超管专属
 * ------------------------------------------------------------------ */
const menuOrganization = leaf('/organization', '组织架构', 'beautyMenu.organization', 'ep:share', 'beauty/organization/index')
const menuAccounts = leaf('/accounts', '账号管理', 'beautyMenu.accounts', 'ep:user-filled', 'beauty/accounts/index')
const menuCategories = leaf('/categories', '品类设置', 'beautyMenu.categories', 'ep:goods', 'beauty/categories/index')
const menuNotifications = leaf('/notifications', '通知设置', 'beautyMenu.notifications', 'ep:bell', 'beauty/notifications/index')
const menuMediaAudit = leaf('/media-audit', '媒体与审计', 'beautyMenu.mediaAudit', 'ep:video-camera', 'beauty/tasks/media-collection/index')
const menuPhotoCheckin = leaf('/photo-checkin', 'BA打卡记录', 'beautyMenu.photoCheckin', 'ep:camera', 'beauty/tasks/photo-checkin/index')
const menuKnowledgeGraph = leaf('/knowledge-graph', '知识图谱', 'beautyMenu.knowledgeGraph', 'ep:connection', 'beauty/knowledge-graph/index')

/* ------------------------------------------------------------------ *
 * 各角色菜单树（严格对齐 Beauty-AI 原型的角色导航）
 * ------------------------------------------------------------------ */
export const MENUS_BY_ROLE: Record<DemoRoleKey, MenuNode[]> = {
  super_admin: [
    menuOverview,
    menuOrganization,
    menuAccounts,
    menuCategories,
    menuNotifications,
    menuMediaAudit,
    menuPhotoCheckin,
    materialLibrary(),
    menuKnowledgeGraph
  ],
  hq_trainer: [
    menuNational,
    menuAudit,
    group('/courseware', '在线课件', 'beautyMenu.coursewareGroup', 'ep:notebook', [
      coursewareCreate(),
      coursewareManage(false)
    ]),
    group('/ba', 'AI陪练', 'beautyMenu.baGroup', 'ep:user', [
      baAvatars(false),
      baScripts(false),
      baQuotes,
      materialLibrary()
    ]),
    examGroup(),
    tasksGroup(),
    archivesGroup(false)
  ],
  regional_training_manager: [
    menuRegional,
    menuAudit,
    group('/courseware', '区域补充内容', 'beautyMenu.regionalContentGroup', 'ep:notebook', [
      coursewareCreate(),
      coursewareManage(true),
      baScripts(true),
      baAvatars(true),
      materialLibrary()
    ]),
    tasksGroup(),
    archivesGroup(true)
  ],
  regional_trainer: [
    menuRegional,
    menuAudit,
    group('/courseware', '区域补充内容', 'beautyMenu.regionalContentGroup', 'ep:notebook', [
      coursewareCreate(),
      coursewareManage(true),
      baScripts(true),
      baAvatars(true),
      materialLibrary()
    ]),
    group('/tasks', '周期任务', 'beautyMenu.tasksGroup', 'ep:target', taskChildren())
  ],
  regional_manager: [
    menuRegional,
    menuAudit,
    group('/tasks', '周期任务监控', 'beautyMenu.tasksMonitorGroup', 'ep:list', taskChildren()),
    archivesGroup(true)
  ]
}

/** 展开成后端菜单树的形状（自动补 id / parentId / visible / keepAlive）。 */
export const buildMenus = (nodes: MenuNode[]) => {
  let nextId = 1000

  const walk = (list: MenuNode[], parentId: number): any[] =>
    list.map((node) => {
      const id = nextId++
      const children = node.children ? walk(node.children, id) : undefined
      return {
        id,
        parentId,
        name: node.name,
        i18nKey: node.i18nKey,
        path: node.path,
        component: node.component || '',
        componentName: undefined,
        icon: node.icon,
        visible: true,
        keepAlive: true,
        alwaysShow: Boolean(children?.length),
        ...(children ? { children } : {})
      }
    })

  return walk(nodes, 0)
}
