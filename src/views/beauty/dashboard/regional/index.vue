<script setup lang="ts">
import { useDashboardRole } from '../components/useDashboardRole'
import RegionalManagerView from '../components/RegionalManagerView.vue'
import RegionalTrainerView from '../components/RegionalTrainerView.vue'
import RegionalTrainingManagerView from '../components/RegionalTrainingManagerView.vue'

/**
 * 区域数据：对应原型 `pages/Dashboard.tsx`（RMDashboard）+ `RTDashboard.tsx` + `RTMDashboard.tsx`。
 *
 * 原型 `App.tsx` 里三个区域角色都渲染 `RMDashboard`，但 RT/RTM 两页同属区域口径；
 * 按任务要求改为按登录角色选视图：区域培训负责人 → RTM、区域培训师 → RT、区域经理 → RM。
 * 角色来自登录用户（`useDashboardRole`），页面内不再提供角色切换。
 */
defineOptions({ name: 'BeautyDashboardRegional' })

const role = useDashboardRole()
</script>

<template>
  <RegionalTrainingManagerView v-if="role === 'Regional Training Manager'" />
  <RegionalTrainerView v-else-if="role === 'Regional Trainer'" />
  <RegionalManagerView v-else />
</template>
