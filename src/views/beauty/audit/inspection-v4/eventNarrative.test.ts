import { describe, expect, it } from 'vitest'
import { eventNarrative } from './eventNarrative'
import type { AgentEvent } from './taskFlow'
const event = (title: string, output: string): AgentEvent => ({
  id: 'test',
  kind: 'tool',
  title,
  output,
  detail: '原始执行依据'
})
describe('执行记录自然语言转述', () => {
  it('依据当前事件结果，不读取其他轮次人员数据', () => {
    const result = eventNarrative(
      event(
        'qualification.evaluate',
        JSON.stringify({ total: 30, qualified: 26, unqualified: 2, missing: 2 })
      )
    )
    expect(result.title).toBe('核对课程与考核是否达标')
    expect(result.detail).toContain('26 人达标，2 人未达标，2 人数据缺失')
    expect(result.detail).toContain('缺数据人员不触发提醒')
  })
  it('保留通知对象与动作且不声称发送成功', () => {
    const result = eventNarrative(
      event(
        'employee.remind',
        JSON.stringify({ preview: '提醒对象：嘉悦，课程未完成', sent: false })
      )
    )
    expect(result.detail).toContain('提醒对象：嘉悦')
    expect(result.detail).toContain('未真实发送')
  })
  it.each(['null', '[]', '无结果', '{}'])('不完整历史 %s 不补造结论', (output) => {
    expect(eventNarrative(event('qualification.evaluate', output)).detail).toBe('原始执行依据')
  })
  it('缺门店数量时不虚构门店数', () => {
    const result = eventNarrative(event('training_records.query', '{"rows":12}'))
    expect(result.detail).toContain('12 人')
    expect(result.detail).not.toContain('家门店')
  })
})
