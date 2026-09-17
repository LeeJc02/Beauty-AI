import request from '@/config/axios'

export interface TrainingAreaVO {
  id: number
  deptId: number
  deptName?: string
  code: string
  name: string
  managerUserId?: number
  managerUsername?: string
  managerNickname?: string
  managerRoleMatched?: boolean
  status: number
  sort: number
}

export interface TrainingAreaTrainerVO {
  id: number
  trainingAreaId: number
  trainerUserId: number
  trainerUsername?: string
  trainerNickname?: string
  deptId?: number
  deptName?: string
  effectiveFrom?: string
  effectiveTo?: string
  roleMatched?: boolean
}

export interface TrainingBaRelationVO {
  id: number
  baUserId: number
  trainingAreaId: number
  managerUserId?: number
  trainerUserId?: number
  baUsername?: string
  baNickname?: string
  trainingAreaName?: string
  managerNickname?: string
  trainerNickname?: string
  deptId?: number
  deptName?: string
  roleMatched?: boolean
}

export interface TrainingUserCandidateVO {
  userId: number
  username: string
  nickname: string
  deptId: number
  deptName?: string
  status: number
  roleMatched?: boolean
  currentTrainingAreaId?: number
  currentTrainingAreaName?: string
  currentTrainingManagerId?: number
  currentTrainingManagerName?: string
}

export type TrainingRelationTreeNodeType = 'REGION' | 'MANAGER' | 'AREA' | 'TRAINER' | 'UNASSIGNED' | 'BA'

export interface TrainingRelationTreeNodeVO {
  nodeType: TrainingRelationTreeNodeType
  nodeKey: string
  name: string
  displayNameCode?: 'UNASSIGNED_DIRECT_TRAINER' | 'MISSING_BUSINESS_AREA' | 'MISSING_USER' | 'MISSING_TRAINING_MANAGER'
  displayNameRefId?: number
  username?: string
  status?: number
  roleMatched?: boolean
  hasChildren: boolean
  deptId?: number
  managerUserId?: number
  trainingAreaId?: number
  trainerUserId?: number
  baUserId?: number
  areaTrainerRelationId?: number
  baRelationId?: number
  managerCount?: number
  trainingAreaCount?: number
  trainerCount?: number
  traineeCount?: number
  regionalGeneralManagerNames?: string[]
  unassignedTraineeCount?: number
  idleTrainerCount?: number
  inactiveTrainerCount?: number
  inactiveTraineeCount?: number
  trainingManagerRoleMismatchCount?: number
  trainerRoleMismatchCount?: number
  baRoleMismatchCount?: number
  feishuChatId?: string
  feishuChatName?: string
  feishuChatStatus?: string
  feishuBindingHealthStatus?: string
  feishuBindingHealthMessage?: string
  children?: TrainingRelationTreeNodeVO[]
}

export interface TrainingRelationTreeReqVO {
  deptId?: number
  managerKeyword?: string
  areaKeyword?: string
  keyword?: string
  status?: number
  issueType?: 'NO_TRAINER' | 'UNASSIGNED_TRAINER' | 'IDLE_TRAINER' | 'INACTIVE_ACCOUNT' | 'FEISHU_CHAT' | 'ROLE_MISMATCH'
  parentType?: 'ROOT' | TrainingRelationTreeNodeType
  parentDeptId?: number
  parentManagerUserId?: number
  parentTrainingAreaId?: number
  parentTrainerUserId?: number
}

export const TrainingRelationApi = {
  getAreaPage: (params: PageParam & { deptId?: number; managerUserId?: number; managerKeyword?: string; status?: number; keyword?: string }) =>
    request.get<PageResult<TrainingAreaVO[]>>({ url: '/training-relation/area/page', params }),

  getTreeChildren: (params: TrainingRelationTreeReqVO) =>
    request.get<TrainingRelationTreeNodeVO[]>({ url: '/training-relation/tree/children', params }),

  searchTree: (params: TrainingRelationTreeReqVO) =>
    request.get<TrainingRelationTreeNodeVO[]>({ url: '/training-relation/tree/search', params }),

  getArea: (id: number) => request.get<TrainingAreaVO>({ url: '/training-relation/area/get', params: { id } }),

  createArea: (data: Partial<TrainingAreaVO>) => request.post<number>({ url: '/training-relation/area/create', data }),

  updateArea: (data: Partial<TrainingAreaVO>) => request.put<boolean>({ url: '/training-relation/area/update', data }),

  deleteArea: (id: number) => request.delete<boolean>({ url: '/training-relation/area/delete', params: { id } }),

  getTrainerList: (trainingAreaId: number) =>
    request.get<TrainingAreaTrainerVO[]>({ url: '/training-relation/trainer/list', params: { trainingAreaId } }),

  bindTrainer: (data: { trainingAreaId: number; trainerUserId: number }) =>
    request.post<number>({ url: '/training-relation/trainer/create', data }),

  unbindTrainer: (id: number) => request.delete<boolean>({ url: '/training-relation/trainer/delete', params: { id } }),

  getBaRelationList: (trainingAreaId: number) =>
    request.get<TrainingBaRelationVO[]>({ url: '/training-relation/ba/list', params: { trainingAreaId } }),

  getUserCandidatePage: (params: PageParam & { trainingAreaId: number; userType?: 'TRAINER' | 'BA'; keyword?: string }) =>
    request.get<PageResult<TrainingUserCandidateVO[]>>({ url: '/training-relation/user-candidate/page', params }),

  saveBaRelation: (data: { baUserId: number; trainingAreaId: number; trainerUserId: number }) =>
    request.post<number>({ url: '/training-relation/ba/create', data }),

  batchSaveBaRelation: (data: { trainingAreaId: number; trainerUserId: number; baUserIds: number[] }) =>
    request.post<number>({ url: '/training-relation/ba/batch-create', data }),

  batchUpdateBaTrainer: (data: { trainingAreaId: number; trainerUserId: number; baRelationIds: number[] }) =>
    request.put<number>({ url: '/training-relation/ba/batch-update-trainer', data }),

  getBaRelationHistory: (baUserId: number) =>
    request.get<TrainingBaRelationVO[]>({ url: '/training-relation/ba/history', params: { baUserId } }),

  closeBaRelation: (id: number) => request.delete<boolean>({ url: '/training-relation/ba/delete', params: { id } })
}
