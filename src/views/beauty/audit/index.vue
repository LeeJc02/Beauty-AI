<script setup lang="ts">
import { computed } from 'vue'
import CoursewareInspectionWorkspace from './inspection-v4/CoursewareInspectionWorkspace.vue'
import { actorForRole, useAuditRole } from './components/shared'

defineOptions({ name: 'BeautyAudit' })
const role = useAuditRole()
const actor = computed(() => actorForRole(role.value))
</script>

<template>
  <CoursewareInspectionWorkspace :key="role" :read-only="Boolean(actor.readOnly)" />
</template>
