import type { DemoDataArea } from './areas'
import { headquarterDataArea, regionalDataArea } from './areas'

export type DemoRoleKey =
  | 'super_admin'
  | 'hq_trainer'
  | 'regional_training_manager'
  | 'regional_trainer'
  | 'regional_manager'

export interface DemoRole {
  key: DemoRoleKey
  /** 与 Beauty-AI 原型的角色名一致，供移植页面共用。 */
  beautyRole: string
  label: string
  nickname: string
  deptId: number
  username: string
  /** 登录后默认进入的路径。 */
  entryPath: string
  permissions: string[]
  dataArea: () => DemoDataArea
}

/** 业务侧权限码（注意：与后端一致，冒号后带一个空格）。 */
const COURSEWARE_PERMISSIONS = [
  'ai:courseware: generate',
  'ai:courseware: homework-generate',
  'ai:category: create',
  'ai:training-product: create',
  'ai:voice: create',
  'ai:voice: update',
  'ai:voice: delete'
]

export const DEMO_ROLES: DemoRole[] = [
  {
    key: 'super_admin',
    beautyRole: 'Super Admin',
    label: '超级管理员',
    nickname: '超级管理员',
    deptId: 100,
    username: 'admin',
    entryPath: '/runtime-overview',
    permissions: ['*:*:*'],
    dataArea: headquarterDataArea
  },
  {
    key: 'hq_trainer',
    beautyRole: 'HQ Trainer',
    label: '总部培训',
    nickname: '总部培训 · Sarah',
    deptId: 101,
    username: 'hq_trainer',
    entryPath: '/national-data',
    permissions: COURSEWARE_PERMISSIONS,
    dataArea: headquarterDataArea
  },
  {
    key: 'regional_training_manager',
    beautyRole: 'Regional Training Manager',
    label: '区域培训负责人',
    nickname: '雅加达南区培训负责人 · Fitriani',
    deptId: 201,
    username: 'regional_tm',
    entryPath: '/regional-data',
    permissions: COURSEWARE_PERMISSIONS,
    dataArea: () => regionalDataArea(2, [3])
  },
  {
    key: 'regional_trainer',
    beautyRole: 'Regional Trainer',
    label: '区域培训师',
    nickname: '雅加达南区培训师 · Dewi',
    deptId: 202,
    username: 'regional_trainer',
    entryPath: '/regional-data',
    permissions: COURSEWARE_PERMISSIONS,
    dataArea: () => regionalDataArea(2, [3])
  },
  {
    key: 'regional_manager',
    beautyRole: 'Regional Manager',
    label: '区域经理',
    nickname: '雅加达南区经理 · Rina',
    deptId: 203,
    username: 'regional_manager',
    entryPath: '/regional-data',
    permissions: COURSEWARE_PERMISSIONS,
    dataArea: () => regionalDataArea(2, [3])
  }
]

export const roleByKey = (key: string): DemoRole =>
  DEMO_ROLES.find((role) => role.key === key) || DEMO_ROLES[0]
