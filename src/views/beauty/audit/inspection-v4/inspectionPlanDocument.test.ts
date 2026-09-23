import { describe, expect, it } from 'vitest'
import { planRequest } from '@/beauty/lib/inspectionRequest'
import {
  buildPlanDocument,
  conflictingPlanCondition,
  planDocumentClauses,
  reconcilePlanDocument,
  removedDurationCondition
} from './inspectionPlanDocument'

const plan = () =>
  planRequest('持续监督以后新课件预计学习时长5到10分钟，不合规提醒本人，连续3次汇报')

describe('任务计划文档核对', () => {
  it('详细计划覆盖背景、范围、数据口径、步骤、异常与交付，查询无通知授权', () => {
    const document = buildPlanDocument(plan())
    for (const heading of [
      '背景与目标',
      '范围与时间',
      '数据依据与核验口径',
      '执行步骤',
      '异常处理',
      '交付与执行约定'
    ])
      expect(document).toContain(`## ${heading}`)
    expect(document).toContain('estimatedDurationSeconds')
    expect(document).toContain('targetDurationMinutes 不作为产物时长依据')
    expect(document).toContain('连续第三次未达标')
    const query = buildPlanDocument(planRequest('查一下当前课件预计学习时长，5到10分钟合格'))
    expect(query).toContain('一次查询只输出核验结果，不执行人员提醒或升级汇报')
    expect(query).not.toContain('连续第三次未达标')
  })
  it('标题、斜体、加粗、引用、列表与代码格式不改变执行条件', () => {
    const original = buildPlanDocument(plan())
    const formatted = original
      .replace('# 任务计划', '# 我定义的计划')
      .replaceAll('不少于 5 分钟', '不少于 *5* 分钟')
      .replaceAll('不超过 10 分钟', '不超过 `10` 分钟')
    expect(planDocumentClauses(formatted)).toEqual(planDocumentClauses(original))
    expect(planDocumentClauses(original.replace('时间范围：', '## 时间范围：'))).toEqual(
      planDocumentClauses(original)
    )
    expect(planDocumentClauses('> **文字**\n- *文字*\n1. `文字`')).toEqual(['文字', '文字', '文字'])
  })
  it('混合删除下限和修改上限必须明确取消授权', () => {
    const original = buildPlanDocument(plan())
    const draft = original
      .replaceAll('不少于 5 分钟、', '')
      .replaceAll('不超过 10 分钟', '不超过 20 分钟')
    expect(removedDurationCondition(original, draft)).toContain('时长下限')
    expect(removedDurationCondition(original, `${draft}\n取消下限`)).toBeUndefined()
  })
  it('范围同义改写不误当删除，纯数值修改仍可核对', () => {
    const original = buildPlanDocument(plan())
    const draft = original.replaceAll('不少于 5 分钟、不超过 10 分钟', '12到20分钟')
    expect(removedDurationCondition(original, draft)).toBeUndefined()
  })
  it('仅同步未改写的生成行，保留自定义标题与格式', () => {
    const previous = plan()
    const original = buildPlanDocument(previous)
    const draft = original
      .replace('# 任务计划', '# 新版任务计划')
      .replace('不超过 10 分钟', '不超过 **20** 分钟')
    const next = planRequest('不超过20分钟', previous)
    const reconciled = reconcilePlanDocument(draft, previous, next)
    expect(reconciled).toContain('# 新版任务计划')
    expect(reconciled).toContain('不超过 **20** 分钟')
    expect(reconciled).not.toContain('不超过 10 分钟')
    expect(reconciled).toContain('**核验预计学习时长**：预计学习时长不少于 5 分钟、不超过 20 分钟')
  })
  it('同步其他位置的标准时保留斜体与加粗', () => {
    const previous = plan()
    const draft = buildPlanDocument(previous)
      .replace('不超过 10 分钟', '不超过 20 分钟')
      .replace('不超过 10 分钟', '不超过 *10* 分钟')
    const next = planRequest('不超过20分钟', previous)
    const reconciled = reconcilePlanDocument(draft, previous, next)
    expect(reconciled).toContain('不超过 *20* 分钟')
    expect(conflictingPlanCondition(reconciled, next)).toBeUndefined()
  })
  it('互相矛盾的数值不能进入最终确认', () => {
    const previous = plan()
    const draft = buildPlanDocument(previous)
      .replace('不超过 10 分钟', '不超过 20 分钟')
      .replace('不超过 10 分钟', '不超过 30 分钟')
    const next = planRequest('不超过20分钟', previous)
    expect(conflictingPlanCondition(reconcilePlanDocument(draft, previous, next), next)).toContain(
      '标准不一致'
    )
  })
})
