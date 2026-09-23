// 在 macOS 上构建 Windows x64 免安装交付包：node scripts/package-windows.mjs
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const version = '22.23.2'
const archive = `node-v${version}-win-x64.zip`
const sha256 = '1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97'
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const output = path.join(root, 'dist-windows', stamp)
const bundle = path.join(output, 'Beauty-AI-Windows')
const app = path.join(bundle, 'app')
mkdirSync(bundle, { recursive: true })
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options })
// 使用现有 dev 模式样本配置，但生成生产构建；输出到独立目录，不覆盖已有 dist。
run(process.execPath, ['--max-old-space-size=8192', 'node_modules/vite/bin/vite.js', 'build', '--mode', 'dev', '--outDir', app], {
  env: { ...process.env, NODE_ENV: 'production', VITE_BASE_PATH: '/', VITE_SOURCEMAP: 'false' }
})
const cache = path.join(root, 'dist-windows', 'cache')
mkdirSync(cache, { recursive: true })
const downloaded = path.join(cache, archive)
if (!existsSync(downloaded)) {
  run('curl', ['--fail', '--location', '--retry', '3', '--output', downloaded, `https://nodejs.org/dist/v${version}/${archive}`])
}
if (createHash('sha256').update(readFileSync(downloaded)).digest('hex') !== sha256) {
  throw new Error(`Node.js 压缩包校验失败，请删除 ${downloaded} 后重试。`)
}
run('unzip', ['-q', downloaded, `node-v${version}-win-x64/node.exe`, `node-v${version}-win-x64/LICENSE`, '-d', output])
mkdirSync(path.join(bundle, 'runtime'))
for (const name of ['node.exe', 'LICENSE']) {
  cpSync(path.join(output, `node-v${version}-win-x64`, name), path.join(bundle, 'runtime', name))
}
cpSync(path.join(root, 'scripts/windows/server.cjs'), path.join(bundle, 'server.cjs'))
const launcher = [
  '@echo off', 'chcp 65001 >nul', 'title Beauty-AI', 'pushd "%~dp0"',
  'if not exist "runtime\\node.exe" (',
  '  echo 缺少运行环境，请先完整解压压缩包，不要在压缩软件内直接启动。',
  '  pause', '  exit /b 1', ')',
  '"runtime\\node.exe" "server.cjs"',
  'if errorlevel 1 pause', 'popd'
].join('\r\n') + '\r\n'
writeFileSync(path.join(bundle, '启动演示.bat'), launcher)
const instructions = `Beauty-AI 使用说明\n\n1. 适用 Windows 10/11 x64，无需安装 Node.js、npm 或开发工具。\n2. 右键 ZIP 选择“全部解压”，不要在压缩软件中直接运行。\n3. 双击“启动演示.bat”，浏览器自动打开。建议使用最新版 Edge 或 Chrome。\n4. 若未自动打开，手动访问 http://127.0.0.1:18326 。\n5. 使用期间保留启动窗口；关闭窗口即停止服务。\n6. 登录可使用 admin / admin123（本地样本账户）。\n\n数据与网络\n- 已内置业务样本，不包含开发者浏览器中的个人操作记录。\n- 部分状态仅在本次页面会话保留；已实现持久化的记录保存在当前浏览器中。\n- 请固定使用同一浏览器，不要使用无痕模式；清理网站数据会移除本地记录。\n- 部分头像、图片、音视频需要网络，建议联网使用；外部链接可能失效。\n- 本包为前端产品原型，不会真实发送通知或执行后台业务。\n\n常见问题\n- 提示端口占用：关闭已有启动窗口或占用 18326 的程序，再重新启动。\n- 更新版本前先关闭旧启动窗口，否则仍可能打开旧版本。\n- 公司电脑若限制 BAT/EXE，请联系 IT 确认允许运行，不要关闭安全防护。\n- Windows ARM 或更早系统不在本包适用范围内。\n- 本包在 Mac 上构建，尚未进行 Windows 实机验证。\n\n构建时间：${stamp}\n运行环境：Node.js ${version} Windows x64（许可证见 runtime/LICENSE）\n`
writeFileSync(path.join(bundle, '使用说明.txt'), '\uFEFF' + instructions.replace(/\n/g, '\r\n'))
writeFileSync(path.join(bundle, 'build-info.json'), JSON.stringify({ builtAt: stamp, node: version, platform: 'win32-x64', windowsTested: false }, null, 2))
const zip = path.join(output, 'Beauty-AI-Windows.zip')
run('zip', ['-qr', zip, 'Beauty-AI-Windows'], { cwd: output })
const digest = createHash('sha256').update(readFileSync(zip)).digest('hex')
writeFileSync(`${zip}.sha256`, `${digest}  Beauty-AI-Windows.zip\n`)
console.log(`\n交付包：${zip}\nSHA256：${digest}`)
