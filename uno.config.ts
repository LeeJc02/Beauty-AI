import { defineConfig, toEscapedSelector as e, presetUno } from 'unocss'
// import transformerVariantGroup from '@unocss/transformer-variant-group'

export default defineConfig({
  // ...UnoCSS options
  rules: [
    [
      /^custom-hover$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector} {
  display: flex;
  height: 100%;
  padding: 0 10px;
  cursor: pointer;
  align-items: center;
  transition: background var(--transition-time-02);
}
/* you can have multiple rules */
${selector}:hover {
  background-color: var(--top-header-hover-color);
}
.dark ${selector}:hover {
  background-color: var(--el-bg-color-overlay);
}
`
      }
    ],
    [
      /^layout-border__left$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ],
    [
      /^layout-border__right$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ],
    [
      /^layout-border__top$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ],
    [
      /^layout-border__bottom$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ]
  ],
  presets: [presetUno({ dark: 'class', attributify: false })],
  content: {
    pipeline: {
      // 默认管线不扫 .ts（只扫 tsx），而 Beauty-AI 原型把一批类名集中写在 lib/*.ts 里
      // （例如 visualTones 的 textClass / bgClass），不补这一条会大量丢样式。
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|marko|html|md)($|\?)/,
        /\.ts($|\?)/
      ]
    }
  },
  // transformers: [transformerVariantGroup()],
  shortcuts: {
    'wh-full': 'w-full h-full'
  }
})
