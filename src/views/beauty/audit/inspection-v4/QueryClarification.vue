<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { Scenario } from './model'
import type { QueryConfig } from './taskFlow'
import {
  clarificationQuestion,
  clarificationOptions,
  confirmedConfig,
  parseClarification,
  scenarioLabels,
  type ClarificationState
} from './clarification'
import { policySummary, toolLabels } from './executionPlan'

const props = defineProps<{
  question: string
  scenario?: Scenario
  readOnly?: boolean
  initialConfig?: QueryConfig
  confirmLabel?: string
}>()
const emit = defineEmits<{ confirm: [config: QueryConfig]; cancel: [] }>()
const state = ref<ClarificationState>({})
const messages = ref<Array<{ question: string; answer: string }>>([])
const answer = ref('')
const selection = ref('')
const editing = ref(false)
const panel = ref<HTMLElement>()
const config = computed(() => confirmedConfig(state.value))
const options = computed(() => clarificationOptions(state.value))
const blocked = computed(
  () =>
    props.readOnly &&
    !!config.value &&
    (config.value.mode === 'scheduled' ||
      config.value.toolPlan?.reportToCreator ||
      config.value.toolPlan?.remindEmployees ||
      config.value.toolPlan?.escalateToCreator)
)
watch(
  () => props.question,
  (question) => {
    // 入口 scenario 不是用户授权；只能从明确回答取得条件。
    state.value = props.initialConfig
      ? {
          ...props.initialConfig,
          regions: [...props.initialConfig.regions],
          toolPlan: props.initialConfig.toolPlan ? { ...props.initialConfig.toolPlan } : undefined,
          actionsExplicit: true
        }
      : parseClarification(question)
    messages.value = []
    answer.value = ''
    selection.value = ''
    editing.value = false
  },
  { immediate: true }
)
async function send() {
  const text =
    selection.value && selection.value !== 'custom' ? selection.value : answer.value.trim()
  if (!text) return
  messages.value.push({
    question: editing.value ? '补充或修改需求' : clarificationQuestion(state.value),
    answer: text
  })
  state.value = parseClarification(text, state.value)
  answer.value = ''
  selection.value = ''
  editing.value = false
  await nextTick()
  const scroller = panel.value?.closest('.iv-conversation-body')
  if (scroller) scroller.scrollTop = scroller.scrollHeight
}
function revise() {
  editing.value = true
  selection.value = 'custom'
}
function confirm() {
  const value = confirmedConfig(state.value)
  if (!value || editing.value || answer.value.trim() || blocked.value) return
  emit('confirm', {
    ...value,
    escalationRecipient: props.initialConfig?.escalationRecipient,
    clarificationSummary: [props.question, ...messages.value.map((message) => message.answer)].join(
      '\n'
    )
  })
}
</script>
<template>
  <section ref="panel" class="iv-query" aria-label="自然语言需求澄清">
    <div class="iv-query-head">巡检助手 · 先把需求聊清楚</div>
    <p class="iv-query-hint">本地演示规则解析，非真实 LLM。不会查询业务库或发送真实消息。</p>
    <details class="iv-original"
      ><summary :title="question">你的目标：{{ question }}</summary
      ><p>{{ question }}</p></details
    >
    <details v-if="messages.length" class="iv-clarify-history">
      <summary>已回答 {{ messages.length }} 轮 · 展开查看</summary>
      <div v-for="(message, index) in messages" :key="index" class="iv-history-round">
        <small>{{ message.question }}</small
        ><p>你的回答：{{ message.answer }}</p>
      </div>
    </details>
    <p v-if="messages.length" class="iv-receipt" role="status"
      >已记录你的回答：{{ messages[messages.length - 1].answer }}</p
    >
    <div v-if="config && !editing" class="iv-summary" aria-live="polite">
      <h3>我理解了，请确认这次需求</h3>
      <p
        >在 {{ config.startsOn }} 至 {{ config.endsOn }}，针对{{ config.regions.join('、') }}的{{
          config.product
        }}做{{ scenarioLabels[config.scenario] }}，{{
          config.mode === 'once' ? '只查询一次。' : `按${config.cadence}定时复查。`
        }}</p
      >
      <div class="iv-chips" aria-label="确认的工具链路"
        ><span v-for="tool in toolLabels(config.toolPlan!)" :key="tool">{{ tool }}</span></div
      >
      <p v-if="config.mode === 'scheduled'"
        >频率来源：{{
          config.toolPlan?.cadenceSource === 'recommended' ? '助手推荐，待你确认' : '用户指定'
        }}
        · {{ config.cadence }}（Asia/Jakarta）</p
      >
      <p>{{ policySummary(config.toolPlan!) }}</p>
      <p>演示判定口径：课程完成且考核 ≥ 80 分；数据缺失单列。</p>
      <p v-if="config.scenario === 'workload'"
        >样本缺少任务工时、可用工时及排班，只能检查人员覆盖和数据缺口，不能判定超负荷。</p
      >
      <p class="iv-authorization"
        >点击最终确认才授权执行上述工具的本地模拟；不创建后台调度，不发送真实消息。</p
      >
      <button class="iv-subtle" @click="revise">补充或修改需求</button>
    </div>
    <form v-else class="iv-answer" @submit.prevent="send">
      <h3>{{
        editing ? '想修改哪部分需求？' : clarificationQuestion(state) || '请确认如何调整需求'
      }}</h3>
      <p v-if="state.issue" role="alert">{{ state.issue }}</p>
      <p class="iv-query-hint"
        >选择一个回答，或自己输入。可以一次说明多个条件；不会自动开始查询。</p
      >
      <div class="iv-options" role="group" aria-label="本轮回答选项">
        <label
          v-for="option in options"
          :key="option.answer"
          class="iv-option"
          :class="{ selected: selection === option.answer }"
        >
          <input
            v-model="selection"
            type="radio"
            name="clarification-option"
            :value="option.answer"
          />
          <span
            ><strong>{{ option.label }}</strong
            ><small>{{ option.reason }}</small></span
          >
          <em v-if="option.recommended">推荐</em>
        </label>
        <label class="iv-option" :class="{ selected: selection === 'custom' }">
          <input v-model="selection" type="radio" name="clarification-option" value="custom" />
          <span
            ><strong>自己输入</strong
            ><small>其他想法、任意多个演示地区或一次补齐多个条件。</small></span
          >
        </label>
      </div>
      <p v-if="selection && selection !== 'custom'" role="status"
        >已选择：{{
          options.find((option) => option.answer === selection)?.label
        }}。点击“发送回答”进入下一轮。</p
      >
      <template v-if="selection === 'custom' || editing">
        <label for="clarification-answer">用你自己的话回答</label>
        <textarea
          id="clarification-answer"
          v-model="answer"
          @input="selection = 'custom'"
          aria-label="回答澄清问题"
          rows="3"
          maxlength="1000"
          placeholder="例如：查北区新品培训，本周只查一次。其他产品请说“产品是X”。"
        ></textarea>
        <small
          >演示基准 2026-09-14（Asia/Jakarta）：本周 9/14–9/18，未来一个月 9/15–10/15。也可输入
          YYYY-MM-DD 至 YYYY-MM-DD。</small
        >
      </template>
      <div class="iv-query-actions"
        ><button
          type="submit"
          class="iv-primary"
          :disabled="(!selection || selection === 'custom') && !answer.trim()"
          >发送回答</button
        ></div
      >
    </form>
    <div class="iv-query-actions">
      <button class="iv-subtle" @click="emit('cancel')">取消</button>
      <p v-if="blocked" role="alert"
        >当前为只读模式，只允许查询。请修改为“只查询一次”，不能创建定时任务或启用任何外发动作。</p
      >
      <button v-if="config && !editing" class="iv-primary" :disabled="blocked" @click="confirm">{{
        confirmLabel ||
        (config.mode === 'once'
          ? '确认，开始查询'
          : config.toolPlan?.remindEmployees || config.toolPlan?.escalateToCreator
            ? '确认，创建监督任务'
            : '确认，创建定时任务')
      }}</button>
    </div>
  </section>
</template>
<style scoped lang="scss">
.iv-query {
  container-type: inline-size;
  padding: 20px;
  border: 1px solid var(--iv-line);
  border-radius: 16px;
  background: var(--iv-soft, #faf8f6);
  color: var(--iv-ink);
}
.iv-query-head {
  color: var(--iv-accent);
  font-size: 13px;
  font-weight: 600;
}
p {
  font-size: 12px;
  line-height: 1.85;
  margin: 8px 0 !important;
  overflow-wrap: anywhere;
}
small,
.iv-query-hint {
  font-size: 11px;
  line-height: 1.8;
  color: var(--iv-muted);
}
h3 {
  font-size: 16px;
  line-height: 1.5;
  margin: 8px 0 !important;
}
.iv-original,
.iv-authorization {
  padding: 10px 12px;
  background: var(--iv-accent-subtle, #fbf3f0);
  border-radius: 8px;
}
.iv-options,
.iv-answer {
  display: grid;
  gap: 7px;
}
.iv-answer,
.iv-summary {
  margin-top: 18px;
}
.iv-options {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.iv-option:last-child {
  grid-column: 1 / -1;
}
@container (max-width: 380px) {
  .iv-options {
    grid-template-columns: 1fr;
  }
}
.iv-option {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px 12px;
  border: 1px solid var(--iv-line);
  border-radius: 10px;
  background: var(--iv-surface, #fff);
  cursor: pointer;
}
.iv-option:hover {
  border-color: var(--iv-accent);
}
.iv-option.selected {
  border-color: var(--iv-accent);
  background: var(--iv-accent-subtle, #fbf3f0);
  box-shadow: 0 0 0 1px var(--iv-accent);
}
.iv-option input {
  margin-top: 3px;
  accent-color: var(--iv-accent);
}
.iv-option span {
  flex: 1;
}
.iv-option strong {
  font-size: 13px;
  font-weight: 600;
}
.iv-option small {
  display: block;
  margin-top: 3px;
}
.iv-option em {
  font-style: normal;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--iv-accent);
  background: var(--iv-accent-subtle, #fbf3f0);
}
.iv-clarify-history {
  margin-top: 14px;
  font-size: 12px;
}
.iv-clarify-history summary {
  cursor: pointer;
  color: var(--iv-muted);
}
.iv-history-round {
  border-bottom: 1px solid var(--iv-line);
  padding: 8px 0;
}
.iv-receipt {
  border-left: 2px solid var(--iv-accent);
  padding-left: 10px;
}
.iv-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}
.iv-chips span {
  padding: 4px 8px;
  border: 1px solid var(--iv-line);
  border-radius: 6px;
  font-size: 11px;
  color: var(--iv-accent);
}
textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  padding: 12px;
  border: 1px solid var(--iv-line);
  border-radius: 10px;
  background: var(--iv-surface, #fff);
  color: var(--iv-ink);
  font: inherit;
  font-size: 12px;
  line-height: 1.8;
}
input:focus-visible,
summary:focus-visible,
textarea:focus-visible,
button:focus-visible {
  outline: 2px solid var(--iv-accent);
  outline-offset: 3px;
}
.iv-query-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}
@media (max-width: 480px) {
  .iv-query {
    padding: 14px;
  }
}
.iv-original summary {
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
}
@media (max-height: 760px) {
  .iv-query {
    padding: 14px;
  }
  .iv-query > .iv-query-hint {
    display: none;
  }
  .iv-original {
    padding: 8px 10px;
    margin: 8px 0;
  }
  .iv-answer {
    margin-top: 10px;
  }
}
</style>
