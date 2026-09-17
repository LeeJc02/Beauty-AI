import { describe, expect, it } from 'vitest'
import { withManualSelectionPayload } from '../manualSelection'

const defaults = {
  generateHomeworkSync: true,
  enableImageGeneration: true,
  outlineEnhancementEnabled: true,
  documentProcessingMode: 'parse' as const
}

describe('manual generation selection', () => {
  it('does not send hidden frontend defaults while closed', () => {
    expect(
      withManualSelectionPayload({ additionalInstruction: '产品培训' }, false, defaults)
    ).toEqual({ additionalInstruction: '产品培训', manualSelectionEnabled: false })
  })
  it('sends explicit option provenance and preserves false choices when open', () => {
    expect(
      withManualSelectionPayload({}, true, {
        ...defaults,
        generateHomeworkSync: false,
        enableImageGeneration: false,
        outlineEnhancementEnabled: false,
        documentProcessingMode: 'direct'
      })
    ).toEqual({
      manualSelectionEnabled: true,
      generationOptions: {
        homework: 'no',
        imageGeneration: 'no',
        splitOptimization: 'no',
        coursewareMode: 'preserve_original'
      }
    })
  })
  it('ignores values again after opening then closing the panel', () => {
    const edited = { ...defaults, documentProcessingMode: 'direct' as const }
    expect(withManualSelectionPayload({}, true, edited).generationOptions?.coursewareMode).toBe(
      'preserve_original'
    )
    expect(withManualSelectionPayload({}, false, edited)).toEqual({ manualSelectionEnabled: false })
  })
  it('preserves explicitly selected external voice and catalog values', () => {
    const source = { narratorVoiceId: 'voice-1', brandIds: [1], categoryIds: [2], productIds: [3] }
    expect(withManualSelectionPayload(source, false, defaults)).toEqual({
      ...source,
      manualSelectionEnabled: false
    })
  })
  it('maps all enabled options and AI rebuild into the shared backend protocol', () => {
    expect(withManualSelectionPayload({}, true, defaults).generationOptions).toEqual({
      homework: 'yes',
      imageGeneration: 'yes',
      splitOptimization: 'yes',
      coursewareMode: 'ai_rebuild'
    })
  })
})
