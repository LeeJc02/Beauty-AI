<script lang="ts" setup>
import { useLocaleStore } from '@/store/modules/locale'
import { useLocale } from '@/hooks/web/useLocale'
import { propTypes } from '@/utils/propTypes'
import { useDesign } from '@/hooks/web/useDesign'

defineOptions({ name: 'LocaleDropdown' })

const { getPrefixCls } = useDesign()

const prefixCls = getPrefixCls('locale-dropdown')

defineProps({
  color: propTypes.string.def('')
})

const localeStore = useLocaleStore()

const langMap = computed(() => localeStore.getLocaleMap)

const currentLang = computed(() => localeStore.getCurrentLocale)

const setLang = async (lang: LocaleType) => {
  if (lang === unref(currentLang).lang) return
  const { changeLocale } = useLocale()
  await changeLocale(lang)
}
</script>

<template>
  <ElDropdown :class="[prefixCls, '!p-0']" trigger="click" @command="setLang">
    <div class="h-full flex items-center cursor-pointer px-10px">
      <Icon
        :class="$attrs.class"
        :color="color"
        :size="18"
        class="!p-0"
        icon="ion:language-sharp"
      />
    </div>
    <template #dropdown>
      <ElDropdownMenu>
        <ElDropdownItem v-for="item in langMap" :key="item.lang" :command="item.lang">
          {{ item.name }}
        </ElDropdownItem>
      </ElDropdownMenu>
    </template>
  </ElDropdown>
</template>
