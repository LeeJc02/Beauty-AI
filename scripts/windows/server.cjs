// 仅依赖 Node.js 内置模块；不需要 npm install。
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const root = path.join(__dirname, 'app')
const host = '127.0.0.1'
// 固定来源，避免浏览器本地数据因随机端口而丢失。
const port = 18326
const url = `http://${host}:${port}`
const identity = 'beauty-ai-windows-portable-v1'
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf', '.wasm': 'application/wasm'
}
function openBrowser() {
  console.log(`\n请保持此窗口打开；关闭窗口即停止服务。\n浏览器地址：${url}\n`)
  if (process.platform !== 'win32') return
  const child = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' })
  child.on('error', () => console.log('自动打开失败，请将上面的地址复制到 Edge 或 Chrome。'))
}
function fail(message) {
  console.error(message)
  process.exitCode = 1
}
if (!fs.existsSync(path.join(root, 'index.html'))) {
  fail('缺少 app/index.html，请完整解压压缩包后再启动。')
} else {
  const server = http.createServer((req, res) => {
    if (req.headers.host !== `${host}:${port}`) { res.writeHead(403).end(); return }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return }
    let pathname
    try { pathname = decodeURIComponent(new URL(req.url, url).pathname) }
    catch { res.writeHead(400).end(); return }
    if (pathname === '/__portable_health') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }).end(identity)
      return
    }
    const file = path.resolve(root, `.${pathname}`)
    const relative = path.relative(root, file)
    if (relative.startsWith('..') || path.isAbsolute(relative) || /[\0:\\]/.test(pathname)) {
      res.writeHead(403).end(); return
    }
    let target = file
    let stat
    try { stat = fs.statSync(target) } catch {}
    if (!stat?.isFile()) {
      // History 路由回退；缺失资源与 API 不返回 HTML。
      if (path.extname(pathname) || pathname.startsWith('/admin-api') || !req.headers.accept?.includes('text/html')) {
        res.writeHead(404).end('Not found'); return
      }
      target = path.join(root, 'index.html')
      stat = fs.statSync(target)
    }
    const headers = { 'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' }
    let start = 0, end = stat.size - 1, status = 200
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]))
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end
      }
      if (!match || (!match[1] && !match[2]) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end(); return
      }
      status = 206
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
    }
    headers['Content-Length'] = Math.max(0, end - start + 1)
    res.writeHead(status, headers)
    if (req.method === 'HEAD' || stat.size === 0) { res.end(); return }
    const stream = fs.createReadStream(target, { start, end })
    stream.on('error', () => res.destroy())
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  })
  server.on('error', (error) => {
    if (error.code !== 'EADDRINUSE') { fail(`启动失败：${error.message}`); return }
    const request = http.get(`${url}/__portable_health`, (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk; if (body.length > 256) response.destroy() })
      response.on('error', () => fail('端口 18326 已被其他程序占用，请关闭占用程序后重试。'))
      response.on('end', () => {
        if (body === identity) { console.log('服务已经运行，请保留原启动窗口。'); openBrowser() }
        else fail('端口 18326 已被其他程序占用，请关闭占用程序后重试。')
      })
    })
    request.setTimeout(2000, () => request.destroy())
    request.on('error', () => fail('端口 18326 已被占用，无法启动，请关闭占用程序后重试。'))
  })
  server.listen(port, host, openBrowser)
}
