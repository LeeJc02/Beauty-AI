import type { App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const store = createPinia()
store.use(piniaPluginPersistedstate)

// 立即激活 pinia 实例。
// 原因：权限指令（@/directives/permission/hasPermi）与 @/utils/permission 在**模块顶层**就调用了
// `useUserStore()`，而 main.ts 里 `@/directives` 的静态导入先于 `setupStore(app)` 执行；
// 不提前 setActivePinia 会在启动时报 “getActivePinia() was called but there was no active Pinia” 并白屏。
setActivePinia(store)

export const setupStore = (app: App<Element>) => {
  app.use(store)
}

export { store }
