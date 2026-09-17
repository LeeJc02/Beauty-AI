<template>
  <ContentWrap>
    <el-form class="-mb-15px" :model="queryParams" ref="queryFormRef" :inline="true" label-width="80px">
      <el-form-item label="关键词" prop="keyword">
        <el-input v-model="queryParams.keyword" placeholder="音色 ID / 名称" clearable class="!w-240px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="语种" prop="lang">
        <el-select v-model="queryParams.lang" placeholder="全部" clearable class="!w-140px" @change="handleQuery">
          <el-option label="印尼语" value="id" />
          <el-option label="中文" value="cn" />
          <el-option label="英文" value="en" />
        </el-select>
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-select v-model="queryParams.gender" placeholder="全部" clearable class="!w-120px">
          <el-option label="男" :value="1" />
          <el-option label="女" :value="2" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
        <el-button type="primary" plain @click="openForm()" v-hasPermi="['ai:voice:create']">
          <Icon icon="ep:plus" class="mr-5px" /> 新增
        </el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <ContentWrap>
    <el-table v-loading="loading" :data="list">
      <el-table-column label="音色 ID" prop="voiceId" min-width="240" show-overflow-tooltip />
      <el-table-column label="音色名称" prop="voiceName" min-width="220" show-overflow-tooltip />
      <el-table-column label="语种" prop="lang" width="120">
        <template #default="scope">{{ langLabel(scope.row.lang) }}</template>
      </el-table-column>
      <el-table-column label="性别" prop="gender" width="100">
        <template #default="scope">{{ genderLabel(scope.row.gender) }}</template>
      </el-table-column>
      <el-table-column label="标签" prop="tag" min-width="160" show-overflow-tooltip>
        <template #default="scope">{{ (scope.row.tag || []).join('、') }}</template>
      </el-table-column>
      <el-table-column label="描述" prop="describe" min-width="180" show-overflow-tooltip />
      <el-table-column label="更新时间" prop="updateTime" width="180" :formatter="dateFormatter" />
      <el-table-column label="操作" fixed="right" width="150">
        <template #default="scope">
          <el-button link type="primary" @click="openForm(scope.row)" v-hasPermi="['ai:voice:update']">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(scope.row)" v-hasPermi="['ai:voice:delete']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <Pagination :total="total" v-model:page="queryParams.pageNo" v-model:limit="queryParams.pageSize" @pagination="getList" />
  </ContentWrap>

  <el-dialog v-model="formOpen" :title="form.id ? '编辑音色' : '新增音色'" width="640px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="音色 ID" prop="voiceId">
        <el-input v-model="form.voiceId" placeholder="Indonesian_SweetGirl" />
      </el-form-item>
      <el-form-item label="音色名称" prop="voiceName">
        <el-input v-model="form.voiceName" placeholder="默认可与音色 ID 一致" />
      </el-form-item>
      <el-form-item label="语种" prop="lang">
        <el-select v-model="form.lang" class="w-100%">
          <el-option label="中文" value="cn" />
          <el-option label="英文" value="en" />
          <el-option label="印尼文" value="id" />
        </el-select>
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-radio-group v-model="form.gender">
          <el-radio :label="1">男</el-radio>
          <el-radio :label="2">女</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tag" multiple filterable allow-create default-first-option class="w-100%" placeholder="输入标签后回车" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.describe" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="formOpen = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { AiVoiceApi, AiVoiceVO } from '@/api/ai-resource/voice'
import { dateFormatter } from '@/utils/formatTime'
import { ElMessageBox } from 'element-plus'

defineOptions({ name: 'CoursewareVoice' })

const message = useMessage()
const queryFormRef = ref()
const formRef = ref()
const loading = ref(false)
const saving = ref(false)
const formOpen = ref(false)
const list = ref<AiVoiceVO[]>([])
const total = ref(0)

const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  keyword: undefined as string | undefined,
  lang: 'id',
  gender: undefined as number | undefined
})

const form = reactive<AiVoiceVO>({
  voiceId: '',
  voiceName: '',
  lang: 'id',
  gender: 2,
  tag: [],
  describe: ''
})

const rules = {
  voiceId: [{ required: true, message: '音色 ID 不能为空', trigger: 'blur' }],
  voiceName: [{ required: true, message: '音色名称不能为空', trigger: 'blur' }],
  lang: [{ required: true, message: '语种不能为空', trigger: 'change' }],
  gender: [{ required: true, message: '性别不能为空', trigger: 'change' }]
}

const langLabel = (lang?: string) => ({ cn: '中文', en: '英文', id: '印尼文' }[lang || ''] || lang || '-')
const genderLabel = (gender?: number) => ({ 1: '男', 2: '女' }[gender || 0] || '-')

const getList = async () => {
  loading.value = true
  try {
    const data = await AiVoiceApi.getPage(queryParams)
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

const resetQuery = () => {
  queryFormRef.value?.resetFields()
  handleQuery()
}

const resetForm = () => {
  Object.assign(form, { id: undefined, voiceId: '', voiceName: '', lang: 'id', gender: 2, tag: [], describe: '' })
}

const openForm = (row?: AiVoiceVO) => {
  resetForm()
  if (row) Object.assign(form, { ...row, tag: [...(row.tag || [])] })
  formOpen.value = true
}

const submitForm = async () => {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (form.id) {
      await AiVoiceApi.update(form)
    } else {
      await AiVoiceApi.create(form)
    }
    message.success('保存成功')
    formOpen.value = false
    await getList()
  } finally {
    saving.value = false
  }
}

const handleDelete = async (row: AiVoiceVO) => {
  await ElMessageBox.confirm(`确认删除音色 ${row.voiceId}？`, '删除确认', { type: 'warning' })
  await AiVoiceApi.delete(row.id!)
  message.success('删除成功')
  await getList()
}

onMounted(getList)
</script>
