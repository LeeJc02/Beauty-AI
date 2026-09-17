<script setup lang="ts">
import MediaCollectionTaskManage from '../tasks/media-collection/index.vue'

/**
 * 超管「媒体与审计」入口：与 `beauty/tasks/media-collection/index.vue` 是同一份实现。
 *
 * 主体放在 `tasks/media-collection/`，这里只做一层包装，保证两条菜单入口行为一致
 * （超管进入时 `useTaskRole()` 得到 `Super Admin`，自动切到只读+审计的管理视图）。
 */
defineOptions({ name: 'BeautyMediaCollectionAudit' })
</script>

<template>
  <MediaCollectionTaskManage />
</template>
