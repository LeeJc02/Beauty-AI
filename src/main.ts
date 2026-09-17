// 引入unocss css
import '@/plugins/unocss'

// 导入全局的svg图标
import '@/plugins/svgIcon'

// 初始化多语言
import { setupI18n } from '@/plugins/vueI18n'

// 引入状态管理
import { setupStore } from '@/store'

// 全局组件
import { setupGlobCom } from '@/components'

// 引入 element-plus
import { setupElementPlus } from '@/plugins/elementPlus'

// 引入全局样式
import '@/styles/index.scss'

// 引入动画
import '@/plugins/animate.css'

// 路由
import router, { setupRouter } from '@/router'

// 指令
import { setupAuth, setupMountedFocus } from '@/directives'

import { createApp } from 'vue'

import App from './App.vue'

import './permission'

import Logger from '@/utils/Logger'

import VueDOMPurifyHTML from 'vue-dompurify-html' // 解决v-html 的安全隐患

import print from 'vue3-print-nb' // 打印插件

// 创建实例
const setupAll = async () => {
  const app = createApp(App)

  await setupI18n(app)

  setupStore(app)

  setupGlobCom(app)

  setupElementPlus(app)

  setupRouter(app)

  // directives 指令
  setupAuth(app)
  setupMountedFocus(app)

  await router.isReady()

  app.use(VueDOMPurifyHTML)

  // 打印
  app.use(print)

  app.mount('#app')
}

setupAll().catch((error) => {
  // 启动阶段失败时把错误暴露到页面上，避免白屏无从排查。
  console.error('[beauty-ai] 应用启动失败', error)
  const el = document.getElementById('app')
  if (el) {
    el.innerHTML = `<pre style="padding:24px;font-size:12px;line-height:1.6;white-space:pre-wrap;color:#d9485f">应用启动失败：\n${String(
      (error && error.stack) || error
    )}</pre>`
  }
})

Logger.prettyPrimary(`欢迎使用`, import.meta.env.VITE_APP_TITLE)
