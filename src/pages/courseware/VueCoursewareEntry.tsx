import React, { useEffect, useRef } from 'react'
import { createApp, h, reactive, type App as VueApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import VueEntry from './vue-entry/VueEntry.vue'
import type { CwForm } from '../../lib/coursewareStudio'

type VueEntryProps = {
  form: CwForm
  setForm: React.Dispatch<React.SetStateAction<CwForm>>
  onStart: () => void
  submitting?: boolean
  error?: string
}

type BridgeProps = {
  modelValue: CwForm
  submitting: boolean
  error: string
  'onUpdate:modelValue': (value: CwForm) => void
  onStart: () => void
}

/**
 * React/Vue bridge for the production-shaped Vue entry template.
 * The Vue app is mounted once; subsequent React renders update the reactive
 * prop bag, so the existing CoursewareCreateFlow remains the owner of state.
 */
export function VueCoursewareEntry({ form, setForm, onStart, submitting = false, error = '' }: VueEntryProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<VueApp | null>(null)
  const bridgePropsRef = useRef<BridgeProps | null>(null)
  const latestRef = useRef({ setForm, onStart })
  latestRef.current = { setForm, onStart }

  useEffect(() => {
    if (!hostRef.current) return
    const bridgeProps = reactive({
      modelValue: form,
      submitting,
      error,
      'onUpdate:modelValue': (value: CwForm) => latestRef.current.setForm(value),
      onStart: () => latestRef.current.onStart(),
    })
    const app = createApp({ setup: () => () => h(VueEntry, bridgeProps) })
    app.use(ElementPlus)
    app.mount(hostRef.current)
    appRef.current = app
    bridgePropsRef.current = bridgeProps
    return () => {
      app.unmount()
      appRef.current = null
      bridgePropsRef.current = null
    }
    // The Vue app must have one lifecycle; prop updates are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const bridgeProps = bridgePropsRef.current
    if (!bridgeProps) return
    bridgeProps.modelValue = form
    bridgeProps.submitting = submitting
    bridgeProps.error = error
  }, [form, submitting, error])

  return <div ref={hostRef} className="vue-courseware-entry" />
}

export default VueCoursewareEntry
