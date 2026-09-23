import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'

/** 只在可见详情内推进；任务、权限、页签或 KeepAlive 状态变化均撤销旧计时。 */
export function useInspectionPresentation(
  taskId: () => string | undefined,
  advance: (id: string) => boolean,
  delay = 1600
) {
  const mounted = ref(false)
  const activated = ref(true)
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  const activeId = () => (mounted.value && activated.value && visible.value ? taskId() : undefined)
  function stop() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  function tick(id: string) {
    if (activeId() !== id) return
    advance(id)
    if (activeId() === id) timer = setTimeout(() => tick(id), delay)
  }
  const updateVisibility = () => {
    visible.value = document.visibilityState !== 'hidden'
  }
  watch(
    activeId,
    (id) => {
      stop()
      if (id) tick(id)
    },
    { flush: 'sync' }
  )
  onMounted(() => {
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    mounted.value = true
  })
  onActivated(() => {
    activated.value = true
  })
  onDeactivated(() => {
    activated.value = false
    stop()
  })
  onBeforeUnmount(() => {
    mounted.value = false
    stop()
    document.removeEventListener('visibilitychange', updateVisibility)
  })
}
