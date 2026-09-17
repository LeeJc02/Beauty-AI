import { onScopeDispose, ref, type Ref } from 'vue'
import {
  getQuestionBankState,
  questionBankActions,
  subscribeQuestionBank,
  type QuestionBankActions
} from '@/beauty/lib/questionBankStore'
import type { QuestionBankItem } from '@/beauty/lib/questionBank'
import type { TaxonomyTag } from '@/beauty/lib/questionBank'

export interface UseQuestionBankReturn extends QuestionBankActions {
  /** 题库（模板里 `questions`，脚本里 `questions.value`） */
  questions: Ref<QuestionBankItem[]>
  /** 标签体系 */
  tags: Ref<TaxonomyTag[]>
}

/**
 * 题库 store 的 Vue 入口，返回与原 `useQuestionBank()` 同形状的对象，
 * 区别只是 `questions` / `tags` 是 `Ref`（模板自动解包）。
 */
export const useQuestionBank = (): UseQuestionBankReturn => {
  const snapshot = getQuestionBankState()
  const questions = ref(snapshot.questions) as Ref<QuestionBankItem[]>
  const tags = ref(snapshot.tags) as Ref<TaxonomyTag[]>

  const refresh = () => {
    const next = getQuestionBankState()
    questions.value = next.questions
    tags.value = next.tags
  }

  const unsubscribe = subscribeQuestionBank(refresh)
  onScopeDispose(unsubscribe)

  return {
    ...questionBankActions,
    questions,
    tags
  }
}
