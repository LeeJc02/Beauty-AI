import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import {
  getInspectionState,
  getInspectionStorageError,
  resetInspectionState,
  setInspectionState,
  subscribeInspectionState
} from '@/beauty/lib/inspectionStore'
import type { InspectionState } from '@/beauty/lib/inspectionTypes'

export interface UseInspectionStateReturn {
  /** 当前审计状态（模板里 `state.tasks`，脚本里 `state.value.tasks`） */
  state: Ref<InspectionState>
  /** 本地存档异常提示；为空表示正常 */
  storageError: ComputedRef<string>
  setState: typeof setInspectionState
  reset: typeof resetInspectionState
  refresh: () => void
}

/**
 * 订阅巡检/审计状态。
 *
 * 等价原型的 `useInspectionState()`，但返回 `Ref`：
 * - 模板：`state.tasks`（ref 自动解包）
 * - 脚本：`state.value.tasks`
 */
export const useInspectionState = (): UseInspectionStateReturn => {
  const state = ref(getInspectionState()) as Ref<InspectionState>
  const storageError = ref(getInspectionStorageError())

  const refresh = () => {
    state.value = getInspectionState()
    storageError.value = getInspectionStorageError()
  }

  const unsubscribe = subscribeInspectionState(refresh)
  onScopeDispose(unsubscribe)

  return {
    state,
    storageError: computed(() => storageError.value),
    setState: setInspectionState,
    reset: resetInspectionState,
    refresh
  }
}
