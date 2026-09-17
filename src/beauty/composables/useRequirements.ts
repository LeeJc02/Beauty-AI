import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import {
  createRequirement,
  deleteRequirement,
  getRequirementStorageError,
  getRequirements,
  markRequirementViewed,
  subscribeRequirements,
  updateRequirement
} from '@/beauty/lib/requirementStore'
import type { InspectionRequirement } from '@/beauty/lib/inspectionRequirements'

export interface UseRequirementsReturn {
  /** 自定义巡检需求列表（模板里 `requirements`，脚本里 `requirements.value`） */
  requirements: Ref<InspectionRequirement[]>
  storageError: ComputedRef<string>
  create: typeof createRequirement
  update: typeof updateRequirement
  remove: typeof deleteRequirement
  markViewed: typeof markRequirementViewed
  refresh: () => void
}

/**
 * 订阅自定义巡检需求。
 *
 * 等价原型的 `useRequirements()`，返回 `Ref<InspectionRequirement[]>`。
 */
export const useRequirements = (): UseRequirementsReturn => {
  const requirements = ref(getRequirements()) as Ref<InspectionRequirement[]>
  const storageError = ref(getRequirementStorageError())

  const refresh = () => {
    requirements.value = getRequirements()
    storageError.value = getRequirementStorageError()
  }

  const unsubscribe = subscribeRequirements(refresh)
  onScopeDispose(unsubscribe)

  return {
    requirements,
    storageError: computed(() => storageError.value),
    create: createRequirement,
    update: updateRequirement,
    remove: deleteRequirement,
    markViewed: markRequirementViewed,
    refresh
  }
}
