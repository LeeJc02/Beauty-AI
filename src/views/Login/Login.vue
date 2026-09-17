<template>
  <div
    :class="prefixCls"
    class="relative h-[100%] lt-md:px-10px lt-sm:px-10px lt-xl:px-10px"
  >
    <div class="relative mx-auto h-full flex flex-col items-center justify-center">
      <!-- 顶部 logo + 主题语言切换 -->
      <div
        class="flex items-center justify-between w-full max-w-500px mb-20px"
        style="color: var(--el-text-color-primary);"
      >
        <div class="flex items-center">
          <div class="beauty-login-logo-mark mr-10px"></div>
          <span class="text-20px font-bold">{{ underlineToHump(appStore.getTitle) }}</span>
        </div>
        <div class="flex items-center justify-end space-x-10px h-48px">
          <LocaleDropdown />
        </div>
      </div>
      <!-- 登录表单 -->
      <Transition appear enter-active-class="animate__animated animate__bounceInRight">
        <div class="w-full max-w-500px">
          <LoginForm class="m-auto h-auto p-20px lt-xl:(rounded-3xl light:bg-white)" />
          <SSOLoginVue class="m-auto h-auto p-20px lt-xl:(rounded-3xl light:bg-white)" />
          <ForgetPasswordForm class="m-auto h-auto p-20px lt-xl:(rounded-3xl light:bg-white)" />
        </div>
      </Transition>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { underlineToHump } from '@/utils'

import { useDesign } from '@/hooks/web/useDesign'
import { useAppStore } from '@/store/modules/app'
import { LocaleDropdown } from '@/layout/components/LocaleDropdown'

import { LoginForm, SSOLoginVue, ForgetPasswordForm } from './components'

defineOptions({ name: 'Login' })

const appStore = useAppStore()
const { getPrefixCls } = useDesign()
const prefixCls = getPrefixCls('login')

onMounted(() => {
  if (appStore.getIsDark) {
    appStore.setIsDark(false)
  }
})
</script>

<style lang="scss" scoped>
$prefix-cls: #{$namespace}-login;

.#{$prefix-cls} {
  overflow: auto;
  background: radial-gradient(circle at 20% 10%, #fff0e8 0, transparent 28%),
    radial-gradient(circle at 80% 15%, #eef1ff 0, transparent 24%), var(--beauty-bg);
}

.beauty-login-logo-mark {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #fb7185 0%, #f7c982 100%);
  border-radius: 14px;
  box-shadow: 0 10px 24px rgb(251 113 133 / 18%);
  flex: 0 0 48px;
}
</style>
