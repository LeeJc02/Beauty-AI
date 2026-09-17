/**
 * 试题库 · 模块级 store（Vue 版）
 *
 * 由原型的 `lib/QuestionBankContext.tsx` 移植：
 * - 去掉 React context / useState / useMemo，改成「模块级 state + subscribe + 变更通知」；
 * - `addTagToCollection` / `buildInitialTags` / `normalizeQuestionWithTags` /
 *   `createInitialQuestionBankState` 以及 9 个操作方法的实现逐字保留；
 * - Vue 侧由 `@/beauty/composables/useQuestionBank` 的 `useQuestionBank()` 消费，
 *   返回与原 context value 完全同形状的对象。
 *
 * 说明：原型的 QuestionBankProvider 只有内存状态（没有任何 localStorage 持久化），
 * 这里保持同样行为——刷新即回到演示题库。
 */

import {
  createTaxonomyTag,
  createVariantQuestion,
  getTagNameKey,
  INITIAL_QUESTIONS,
  limitQuestionTags,
  normalizeQuestionForType,
  normalizeTagName,
  QuestionBankItem,
  QuestionStatus,
  QUESTION_TAXONOMY,
  TaxonomyTag,
} from './questionBank';

interface QuestionBankState {
  questions: QuestionBankItem[];
  tags: TaxonomyTag[];
}

/** 试题库的全部操作方法（与原 context value 的方法一一对应）。 */
export interface QuestionBankActions {
  addQuestions: (questions: QuestionBankItem[]) => void;
  updateQuestion: (question: QuestionBankItem) => void;
  removeQuestion: (id: string) => void;
  bulkAddTags: (ids: string[], tags: string[]) => void;
  bulkSetStatus: (ids: string[], status: QuestionStatus) => void;
  generateVariants: (ids: string[]) => QuestionBankItem[];
  addTag: (name: string) => void;
  renameTag: (id: string, name: string) => void;
  deleteTag: (id: string) => void;
}

/** `useQuestionBank()` 的返回形状（等价原 `QuestionBankContextValue`）。 */
export interface QuestionBankStore extends QuestionBankState, QuestionBankActions {}

function addTagToCollection(tags: TaxonomyTag[], name: string) {
  const normalized = normalizeTagName(name);
  if (!normalized) return { tags, tagId: '' };

  const existing = tags.find(tag => getTagNameKey(tag.name) === getTagNameKey(normalized));
  if (existing) return { tags, tagId: existing.id };

  let nextTag = createTaxonomyTag(normalized);
  if (tags.some(tag => tag.id === nextTag.id)) {
    nextTag = { ...nextTag, id: `${nextTag.id}-${tags.length + 1}` };
  }
  return { tags: [...tags, nextTag], tagId: nextTag.id };
}

function buildInitialTags() {
  return INITIAL_QUESTIONS.flatMap(question => question.customTags).reduce((currentTags, name) => {
    return addTagToCollection(currentTags, name).tags;
  }, QUESTION_TAXONOMY.tags);
}

function normalizeQuestionWithTags(question: QuestionBankItem, tags: TaxonomyTag[], promoteCustomTags: boolean) {
  let workingTags = tags;
  let normalizedQuestion = normalizeQuestionForType(question);

  if (promoteCustomTags && normalizedQuestion.customTags.length > 0) {
    const nextTagIds = [...normalizedQuestion.tagIds];

    normalizedQuestion.customTags.forEach(name => {
      const result = addTagToCollection(workingTags, name);
      workingTags = result.tags;
      if (result.tagId) nextTagIds.push(result.tagId);
    });

    normalizedQuestion = {
      ...normalizedQuestion,
      tagIds: Array.from(new Set(nextTagIds)),
      customTags: [],
    };
  }

  return {
    tags: workingTags,
    question: limitQuestionTags(normalizedQuestion),
  };
}

function createInitialQuestionBankState(): QuestionBankState {
  const initialTags = buildInitialTags();
  const questions = INITIAL_QUESTIONS.map(question => normalizeQuestionWithTags(question, initialTags, true).question);
  return { questions, tags: initialTags };
}

/* -------------------------------------------------- 模块级状态与订阅 */

let state: QuestionBankState = createInitialQuestionBankState();
const listeners = new Set<() => void>();

function update(updater: (previous: QuestionBankState) => QuestionBankState) {
  state = updater(state);
  listeners.forEach(listener => listener());
}

/** 读取当前快照（等价 React 版 context value 里的 questions / tags）。 */
export function getQuestionBankState(): QuestionBankState {
  return state;
}

/**
 * 订阅试题库变更（等价 React 版 context 的重渲染通知）。
 * 返回值是取消订阅函数。
 */
export function subscribeQuestionBank(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 试题库操作方法（原 QuestionBankProvider 内 useMemo 里的实现逐条搬迁）。 */
export const questionBankActions: QuestionBankActions = {
  addQuestions: (nextQuestions) => {
    update(prev => {
      let workingTags = prev.tags;
      const normalizedQuestions = nextQuestions.map(question => {
        const result = normalizeQuestionWithTags(question, workingTags, question.status !== 'pending_review');
        workingTags = result.tags;
        return result.question;
      });

      return {
        tags: workingTags,
        questions: [...normalizedQuestions, ...prev.questions],
      };
    });
  },
  updateQuestion: (question) => {
    update(prev => {
      const result = normalizeQuestionWithTags(question, prev.tags, question.status !== 'pending_review');
      return {
        tags: result.tags,
        questions: prev.questions.map(item => item.id === question.id ? result.question : item),
      };
    });
  },
  removeQuestion: (id) => {
    update(prev => ({ ...prev, questions: prev.questions.filter(item => item.id !== id) }));
  },
  bulkAddTags: (ids, names) => {
    update(prev => {
      let workingTags = prev.tags;
      const tagIdsToApply: string[] = [];

      names.forEach(name => {
        const result = addTagToCollection(workingTags, name);
        workingTags = result.tags;
        if (result.tagId) tagIdsToApply.push(result.tagId);
      });

      return {
        tags: workingTags,
        questions: prev.questions.map(item => ids.includes(item.id)
          ? limitQuestionTags({
            ...item,
            tagIds: Array.from(new Set([...item.tagIds, ...tagIdsToApply])),
          })
          : item
        ),
      };
    });
  },
  bulkSetStatus: (ids, status) => {
    update(prev => ({
      ...prev,
      questions: prev.questions.map(item => ids.includes(item.id) ? { ...item, status } : item),
    }));
  },
  generateVariants: (ids) => {
    const sources = getQuestionBankState().questions.filter(item => ids.includes(item.id));
    const variants = sources.flatMap(source => [0, 1, 2].map(index => createVariantQuestion(source, index)));
    update(prev => ({ ...prev, questions: [...variants, ...prev.questions] }));
    return variants;
  },
  addTag: (name) => {
    update(prev => ({ ...prev, tags: addTagToCollection(prev.tags, name).tags }));
  },
  renameTag: (id, name) => {
    update(prev => {
      const target = prev.tags.find(tag => tag.id === id);
      const normalizedName = normalizeTagName(name);
      if (!target || !normalizedName) return prev;

      const duplicate = prev.tags.find(tag => tag.id !== id && getTagNameKey(tag.name) === getTagNameKey(normalizedName));
      if (duplicate) {
        return {
          tags: prev.tags.filter(tag => tag.id !== id),
          questions: prev.questions.map(question => ({
            ...question,
            tagIds: Array.from(new Set(question.tagIds.map(tagId => tagId === id ? duplicate.id : tagId))),
            customTags: question.customTags.filter(tag => getTagNameKey(tag) !== getTagNameKey(normalizedName)),
          })),
        };
      }

      return {
        tags: prev.tags.map(tag => tag.id === id ? { ...tag, name: normalizedName } : tag),
        questions: prev.questions.map(question => ({
          ...question,
          customTags: question.customTags.map(tag => getTagNameKey(tag) === getTagNameKey(target.name) ? normalizedName : tag),
        })),
      };
    });
  },
  deleteTag: (id) => {
    update(prev => {
      const target = prev.tags.find(tag => tag.id === id);
      if (!target) return prev;

      return {
        tags: prev.tags.filter(tag => tag.id !== id),
        questions: prev.questions.map(question => ({
          ...question,
          tagIds: question.tagIds.filter(tagId => tagId !== id),
          customTags: question.customTags.filter(tag => getTagNameKey(tag) !== getTagNameKey(target.name)),
        })),
      };
    });
  },
};

/** 仅供测试：把 store 重置回初始演示数据。 */
export function resetQuestionBankStore() {
  state = createInitialQuestionBankState();
  listeners.forEach(listener => listener());
}
