import request from '@/config/axios'

/** 演示角色（Beauty-AI 原型的角色切换器）。真实后端没有这些接口，全部由本地 mock 提供。 */
export interface DemoRoleVO {
  key: string
  label: string
  beautyRole: string
  entryPath: string
}

export const DemoRoleApi = {
  getRoles: async (): Promise<DemoRoleVO[]> => {
    return await request.get({ url: '/beauty/demo/roles' })
  },
  setRole: async (role: string): Promise<{ role: string; entryPath: string }> => {
    return await request.post({ url: '/beauty/demo/role', data: { role } })
  }
}
