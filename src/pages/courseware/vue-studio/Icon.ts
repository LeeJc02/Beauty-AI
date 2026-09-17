import { defineComponent, h, type Component } from 'vue'
import {
  AlertCircle, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, Check, ChevronDown,
  ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ClipboardCheck, CloudCheck, Eye,
  FileSearch, FileSignature, HelpCircle, Info, Layers, LayoutList, LayoutTemplate, Lightbulb,
  Loader, LoaderCircle, MessageSquare, NotebookPen, PenLine, Pencil, Plus, Presentation,
  RotateCw, ShieldCheck, Sparkles, Star, Target, User, WifiOff, X, Bookmark, Users, Compass,
  ListOrdered, ShieldAlert
} from 'lucide-vue-next'

const icons: Record<string, Component> = {
  'lucide:alert-circle': AlertCircle, 'lucide:arrow-left': ArrowLeft,
  'lucide:arrow-left-right': ArrowLeftRight, 'lucide:arrow-right': ArrowRight,
  'lucide:arrow-up': ArrowUp, 'lucide:check': Check, 'lucide:chevron-down': ChevronDown,
  'lucide:chevron-left': ChevronLeft, 'lucide:chevron-right': ChevronRight,
  'lucide:circle-alert': CircleAlert, 'lucide:circle-check': CircleCheck,
  'lucide:clipboard-check': ClipboardCheck, 'lucide:cloud-check': CloudCheck,
  'lucide:eye': Eye, 'lucide:file-search': FileSearch, 'lucide:file-signature': FileSignature,
  'lucide:help-circle': HelpCircle, 'lucide:info': Info, 'lucide:layers': Layers,
  'lucide:layout-list': LayoutList, 'lucide:layout-template': LayoutTemplate,
  'lucide:lightbulb': Lightbulb, 'lucide:loader': Loader, 'lucide:loader-circle': LoaderCircle,
  'lucide:message-square': MessageSquare, 'lucide:notebook-pen': NotebookPen,
  'lucide:pen-line': PenLine, 'lucide:pencil': Pencil, 'lucide:plus': Plus,
  'lucide:presentation': Presentation, 'lucide:rotate-cw': RotateCw,
  'lucide:shield-check': ShieldCheck, 'lucide:sparkles': Sparkles, 'lucide:star': Star,
  'lucide:target': Target, 'lucide:user': User, 'lucide:wifi-off': WifiOff, 'lucide:x': X,
  'lucide:bookmark': Bookmark, 'lucide:users': Users, 'lucide:compass': Compass,
  'lucide:list-ordered': ListOrdered, 'lucide:shield-alert': ShieldAlert
}

export default defineComponent({
  name: 'Icon',
  inheritAttrs: false,
  props: { icon: { type: String, required: true }, size: { type: Number, default: 16 } },
  setup(props, { attrs }) {
    // 保留原全局 Icon 的 el-icon 行内容器，所有图形由本地 lucide SVG 输出。
    return () => h('i', {
      ...attrs,
      class: ['el-icon', 'v-icon', attrs.class],
      style: [{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '1em', height: '1em', lineHeight: '1em', position: 'relative',
        fill: 'currentColor', fontSize: `${props.size}px` }, attrs.style],
      'aria-hidden': 'true',
    }, [h(icons[props.icon] || Sparkles, { size: props.size, focusable: 'false' })])
  }
})
