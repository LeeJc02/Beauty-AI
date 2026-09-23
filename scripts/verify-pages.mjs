/**
 * Beauty-AI 迁移验收脚本（一次性工具，不属于产品代码）。
 *
 * 用途：按角色遍历全部菜单路由，收集控制台错误并截图，便于逐页验收。
 * 运行：node scripts/verify-pages.mjs [角色key ...]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire('/Users/lee/.nvm/versions/node/v22.19.0/lib/node_modules/')
const { chromium } = require('playwright')

// 默认端口与 .env 的 VITE_PORT(3000) 对齐；换端口时用 VERIFY_BASE 覆盖。
const BASE = process.env.VERIFY_BASE || `http://localhost:${process.env.VITE_PORT || 3000}`
const OUT = process.env.VERIFY_OUT || '/tmp/beauty-verify'

const ROUTES = {
  super_admin: [
    ['runtime-overview', '运行概览'],
    ['organization', '组织架构'],
    ['accounts', '账号管理'],
    ['categories', '品类设置'],
    ['notifications', '通知设置'],
    ['media-audit', '媒体与审计'],
    ['photo-checkin', 'BA打卡记录'],
    ['material-library', '素材库'],
    ['knowledge-graph', '知识图谱']
  ],
  hq_trainer: [
    ['national-data', '全国数据'],
    ['data-audit', '数据审计'],
    ['courseware/create', '生成新课件'],
    ['courseware/manage', '课件管理'],
    ['ba/avatars', '数字人顾客'],
    ['ba/scripts', '场景剧本'],
    ['ba/quotes', '金句库'],
    ['tasks/material-library', '任务素材库'],
    ['exam/generate', '生成题目'],
    ['exam/bank', '题库管理'],
    ['exam/homework', '关联附加题管理'],
    ['exam/assemble', '考试组卷'],
    ['tasks/study', '学习任务管理'],
    ['tasks/practice', '练习任务管理'],
    ['tasks/media-collection', '音视频采集任务'],
    ['tasks/photo-checkin', 'BA打卡记录'],
    ['tasks/exam', '考试任务管理'],
    ['archives/stores', '全国门店总档案'],
    ['archives/personnel', '全国人员档案']
  ],
  regional_training_manager: [
    ['regional-data', '区域数据'],
    ['data-audit', '数据审计'],
    ['courseware/create', '生成新课件'],
    ['courseware/manage', '区域课件管理'],
    ['courseware/scripts', '区域场景剧本'],
    ['courseware/avatars', '区域数字人顾客'],
    ['tasks/study', '学习任务'],
    ['tasks/material-library', '任务素材库'],
    ['archives/stores', '门店总档案']
  ],
  regional_trainer: [
    ['regional-data', '区域数据'],
    ['data-audit', '数据审计'],
    ['courseware/create', '生成新课件'],
    ['courseware/manage', '区域课件管理'],
    ['courseware/scripts', '区域场景剧本'],
    ['courseware/avatars', '区域数字人顾客'],
    ['tasks/study', '学习任务'],
    ['tasks/practice', '练习任务'],
    ['tasks/media-collection', '音视频采集任务'],
    ['tasks/photo-checkin', 'BA打卡记录'],
    ['tasks/exam', '考试任务'],
    ['tasks/material-library', '任务素材库']
  ],
  regional_manager: [
    ['regional-data', '区域数据'],
    ['data-audit', '数据审计'],
    ['tasks/study', '学习任务'],
    ['tasks/material-library', '任务素材库'],
    ['archives/personnel', '人员档案']
  ]
}

const LOGIN = { username: 'admin', password: 'admin123' }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const login = async (page) => {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const inputs = page.locator('input')
  await inputs.nth(0).fill(LOGIN.username)
  await inputs.nth(1).fill(LOGIN.password)
  await page.locator('button.el-button--large.w-full.el-button--primary').first().click()
  await page.waitForTimeout(3000)
}

const setRole = async (page, role) => {
  await page.evaluate((value) => {
    localStorage.setItem('beauty-ai:demo-role', value)
    localStorage.removeItem('USER')
    localStorage.removeItem('ROLE_ROUTERS')
    localStorage.removeItem('user')
    localStorage.removeItem('roleRouters')
  }, role)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
}

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const roles = process.argv.slice(2).filter((item) => ROUTES[item])
  const targets = roles.length ? roles : Object.keys(ROUTES)

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const report = []

  await login(page)

  for (const role of targets) {
    await setRole(page, role)
    for (const [route, label] of ROUTES[role]) {
      const errors = []
      const onConsole = (msg) => {
        if (msg.type() === 'error') errors.push(msg.text().slice(0, 300))
      }
      const onPageError = (error) => errors.push(`PAGEERROR: ${String(error).slice(0, 300)}`)
      page.on('console', onConsole)
      page.on('pageerror', onPageError)

      const file = path.join(OUT, `${role}--${route.replace(/\//g, '_')}.png`)
      let status = 'ok'
      try {
        await page.goto(`${BASE}/${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(3000)
        const body = await page.evaluate(() => document.body.innerText || '')
        if (body.trim().length < 20) status = 'EMPTY-DOM'
        await page.screenshot({ path: file })
      } catch (error) {
        status = `NAV-FAIL: ${String(error).slice(0, 160)}`
      }
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
      report.push({ role, route, label, status, errors, screenshot: file })
      console.log(
        `${status === 'ok' ? '✓' : '✗'} [${role}] ${label} (/${route}) ${status}${errors.length ? ` console=${errors.length}` : ''}`
      )
    }
  }

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  console.log(`\n截图与报告：${OUT}`)
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
