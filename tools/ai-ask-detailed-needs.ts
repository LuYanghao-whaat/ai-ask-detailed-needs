import { tool } from "@opencode-ai/plugin"
import http from "node:http"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

type AskResult = {
  status: "submitted" | "cancelled" | "timeout" | "error"
  answers: Record<string, unknown>
  partial: Record<string, unknown> | null
  unanswered: string[]
  elapsedMs: number
  idleTimedOut: boolean
  warnings?: string[]
  message?: string
  url?: string
  hint?: string
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".xml": "text/xml; charset=utf-8",
  ".yml": "text/plain; charset=utf-8",
  ".yaml": "text/plain; charset=utf-8",
  ".toml": "text/plain; charset=utf-8",
  ".ini": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
}

const TEXT_EXT = new Set([
  ".txt", ".log", ".md", ".csv", ".json", ".xml", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf",
  ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".rb", ".php", ".go", ".rs", ".java", ".kt",
  ".c", ".h", ".cpp", ".hpp", ".cc", ".cs", ".swift", ".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd",
  ".sql", ".html", ".htm", ".css", ".scss", ".less", ".vue", ".svelte", ".tex", ".r", ".lua", ".pl",
])

function moduleDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url))
  } catch {
    return ""
  }
}

function uiCandidates(directory?: string): string[] {
  const out: string[] = []
  const push = (p?: string | null) => {
    if (p && !out.includes(p)) out.push(p)
  }
  push(process.env.ASK_UI_PATH)
  const dir = moduleDir()
  if (dir) {
    push(path.join(dir, "ai-ask-detailed-needs", "ui.html"))
    push(path.join(dir, "..", "skills", "ai-ask-detailed-needs", "assets", "ui.html"))
    push(path.join(dir, "..", "skill", "ai-ask-detailed-needs", "assets", "ui.html"))
    push(path.join(dir, "..", "assets", "ui.html"))
  }
  const home = os.homedir()
  const cfgRoots: string[] = []
  const cfgEnv = process.env.OPENCODE_CONFIG_DIR || process.env.OPENCODE_CONFIG
  if (cfgEnv) cfgRoots.push(path.dirname(cfgEnv))
  if (process.env.XDG_CONFIG_HOME) cfgRoots.push(path.join(process.env.XDG_CONFIG_HOME, "opencode"))
  cfgRoots.push(path.join(home, ".config", "opencode"))
  cfgRoots.push(path.join(home, ".opencode"))
  for (const root of cfgRoots) push(path.join(root, "skills", "ai-ask-detailed-needs", "assets", "ui.html"))
  for (const ext of [".config/opencode", ".claude", ".agents"]) {
    push(path.join(home, ext, "skills", "ai-ask-detailed-needs", "assets", "ui.html"))
  }
  if (directory) {
    let cur = path.resolve(directory)
    for (let i = 0; i < 6; i++) {
      push(path.join(cur, ".opencode", "skills", "ai-ask-detailed-needs", "assets", "ui.html"))
      push(path.join(cur, "skills", "ai-ask-detailed-needs", "assets", "ui.html"))
      push(path.join(cur, "ai-ask-detailed-needs", "assets", "ui.html"))
      const parent = path.dirname(cur)
      if (parent === cur) break
      cur = parent
    }
  }
  return out
}

function findUi(directory?: string): string | null {
  for (const c of uiCandidates(directory)) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
    } catch {}
  }
  return null
}

function browserCandidates(): string[] {
  const out: string[] = []
  const pf = process.env["ProgramFiles"] || "C:\\Program Files"
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)"
  const lad = process.env["LOCALAPPDATA"] || ""
  if (process.platform === "win32") {
    out.push(path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe"))
    out.push(path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"))
    out.push(path.join(pf, "Google", "Chrome", "Application", "chrome.exe"))
    out.push(path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"))
    if (lad) {
      out.push(path.join(lad, "Microsoft", "Edge", "Application", "msedge.exe"))
      out.push(path.join(lad, "Google", "Chrome", "Application", "chrome.exe"))
    }
  } else if (process.platform === "darwin") {
    out.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    out.push("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")
    out.push("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser")
    out.push("/Applications/Chromium.app/Contents/MacOS/Chromium")
  } else {
    const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"]
    for (const b of names) {
      for (const d of (process.env.PATH || "").split(path.delimiter)) {
        if (d) out.push(path.join(d, b))
      }
    }
  }
  return out
}

function findBrowser(): string | null {
  for (const c of browserCandidates()) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
    } catch {}
  }
  return null
}

function launch(url: string, mode: string): { mode: string; detail: string } {
  const browser = mode === "browser" ? null : findBrowser()
  const spawnDetached = (cmd: string, args: string[]) => {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" })
    child.on("error", () => {})
    child.unref()
  }
  try {
    if (browser) {
      const args = ["--app=" + url, "--window-size=1180,960", "--no-default-browser-check"]
      spawnDetached(browser, args)
      return { mode: "app", detail: browser }
    }
    if (process.platform === "win32") {
      spawnDetached("cmd", ["/c", "start", "", url])
    } else if (process.platform === "darwin") {
      spawnDetached("open", [url])
    } else {
      spawnDetached("xdg-open", [url])
    }
    return { mode: "browser", detail: "" }
  } catch (e) {
    return { mode: "none", detail: String((e as Error)?.message || e) }
  }
}

function collectPaths(node: unknown, out: Set<string>, depth = 0) {
  if (depth > 12 || node == null) return
  if (typeof node === "string") {
    const s = node.trim()
    if (/^[A-Za-z]:[\\/]/.test(s) || /^\\\\/.test(s) || (s.startsWith("/") && !s.startsWith("//"))) out.add(s)
    return
  }
  if (Array.isArray(node)) {
    for (const v of node) collectPaths(v, out, depth + 1)
    return
  }
  if (typeof node === "object") {
    const o = node as Record<string, unknown>
    if (typeof o.kind === "string" && (o.kind === "path" || o.kind === "file") && typeof o.value === "string") {
      out.add(o.value.trim())
      return
    }
    for (const k of Object.keys(o)) collectPaths(o[k], out, depth + 1)
  }
}

function parseMaybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v
  let s = v.trim()
  const fence = /^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/.exec(s)
  if (fence) s = fence[1].trim()
  try {
    return JSON.parse(s)
  } catch {
    return v
  }
}

function interactiveTypes(b: any): boolean {
  if (!b || typeof b !== "object") return false
  if (!["choice", "text", "form", "ranking", "slider", "table"].includes(b.type)) return false
  if (b.type === "table" && (!b.selectable || b.selectable === "none")) return false
  return true
}

const PROSE_KEYS = new Set([
  "intro", "title", "subtitle", "prompt", "description", "detail", "summary", "help",
  "placeholder", "otherLabel", "otherPlaceholder", "hintText", "label", "badge",
  "caption", "alt", "message", "content",
])

function fixEscapedNewlines(s: string): string {
  return s
    .replace(/(?<![A-Za-z]:)(?<!\\)\\+r\\+n/g, "\n")
    .replace(/(?<![A-Za-z]:)(?<!\\)\\+n/g, "\n")
    .replace(/(?<![A-Za-z]:)(?<!\\)\\+t/g, "\t")
}

function normalizeText(spec: Record<string, any>, warnings: string[]) {
  let fixed = 0
  const walk = (node: any, parentType: string) => {
    if (Array.isArray(node)) {
      for (const v of node) walk(v, parentType)
      return
    }
    if (!node || typeof node !== "object") return
    const t = typeof node.type === "string" ? node.type : parentType
    for (const k of Object.keys(node)) {
      const v = node[k]
      if (typeof v === "string") {
        if (!PROSE_KEYS.has(k)) continue
        if ((t === "code" || t === "attachment") && k === "content") {
          if (!v.includes("\n") && /\\n/.test(v)) {
            node[k] = fixEscapedNewlines(v)
            fixed++
          }
          continue
        }
        const nv = fixEscapedNewlines(v)
        if (nv !== v) {
          node[k] = nv
          fixed++
        }
      } else {
        walk(v, t)
      }
    }
  }
  walk(spec, "")
  if (fixed) {
    warnings.push(
      `检测到 ${fixed} 处把换行写成了字面量 "\\n"（双转义），已自动还原成真正的换行。下次在 JSON 字符串里直接写真正的换行即可。`,
    )
  }
}

function normalizeSpec(spec: Record<string, any>): string[] {
  const warnings: string[] = []
  let n = 0
  const walk = (blocks: any[]) => {
    for (const b of blocks || []) {
      if (!interactiveTypes(b)) continue
      n++
      if (b.id == null || b.id === "") {
        b.id = "q" + n
        warnings.push(
          `第 ${n} 个需要回答的块没有 id，已自动命名为 "${b.id}"（就是界面上的 Q${n}）。建议下次给交互块写上有意义的 id。`,
        )
      }
    }
  }
  if (Array.isArray(spec.steps)) for (const s of spec.steps) walk(s?.blocks)
  else walk(spec.blocks)
  return warnings
}

function interactiveIds(spec: Record<string, any>): string[] {
  const ids: string[] = []
  const walk = (blocks: any[]) => {
    for (const b of blocks || []) {
      if (!interactiveTypes(b)) continue
      if (b.id) ids.push(String(b.id))
    }
  }
  if (Array.isArray(spec.steps)) for (const s of spec.steps) walk(s?.blocks)
  walk(spec.blocks)
  return ids
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === "string") return v.trim() === ""
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === "object") return Object.keys(v as object).length === 0
  return false
}

function hintFor(status: string): string {
  if (status === "timeout")
    return "用户长时间没有在窗口里操作，已判定为未响应。不要重复弹出同一个窗口；改为在对话里直接说明情况，或改成更小的选择题。partial 是超时前用户已填写的部分内容，可以参考。"
  if (status === "cancelled")
    return "用户主动取消了这次询问。先问清原因，或改用对话直接确认，不要立刻重开同一个窗口。"
  if (status === "error") return "窗口没有正常打开或服务出错，请改用对话方式向用户确认。"
  return "用户已在窗口中提交，answers 是结构化结果。请直接依据它继续工作，不要复述整份答案。"
}

async function runAsk(spec: Record<string, any>, opts: { directory?: string }): Promise<AskResult> {
  const started = Date.now()
  const timeoutSeconds = typeof spec.timeoutSeconds === "number" ? spec.timeoutSeconds : 900
  const timeoutMs = timeoutSeconds > 0 ? timeoutSeconds * 1000 : 0
  const graceSeconds = typeof spec.openGraceSeconds === "number" ? spec.openGraceSeconds : 45
  const allowCancel = spec.allowCancel !== false
  const windowMode = String(spec.windowMode || "auto")

  const uiPath = findUi(opts.directory)
  if (!uiPath) {
    return {
      status: "error",
      answers: {},
      partial: null,
      unanswered: [],
      elapsedMs: Date.now() - started,
      idleTimedOut: false,
      message: "找不到界面文件 ui.html（应位于 <opencode 配置目录>/skills/ai-ask-detailed-needs/assets/ui.html）。",
      hint: hintFor("error"),
    }
  }

  const html = fs.readFileSync(uiPath, "utf8")
  const token = crypto.randomBytes(18).toString("hex")
  const allowedResolved = new Set<string>()
  const rawPaths = new Set<string>()
  collectPaths(spec, rawPaths)
  for (const p of (Array.isArray(spec.assets) ? spec.assets : []) as string[]) {
    if (typeof p === "string") rawPaths.add(p)
  }
  for (const p of rawPaths) {
    try {
      allowedResolved.add(path.resolve(p))
    } catch {}
  }

  const runtime = {
    token,
    timeoutSeconds,
    allowCancel,
    startedAt: started,
    apiBase: "/api",
    assetBase: "/asset",
    mock: false,
  }
  const inject = (src: string, key: string, value: unknown) =>
    src.replace(key, () => JSON.stringify(value).replace(/</g, "\\u003c"))
  let page = inject(html, "__ASK_SPEC__", spec)
  page = inject(page, "__ASK_RUNTIME__", runtime)

  let settle: (r: AskResult) => void = () => {}
  const done = new Promise<AskResult>((res) => {
    settle = res
  })

  let finalStatus: string | null = null
  let resolved = false
  let lastPartial: Record<string, unknown> | null = null
  let clientSeen = false
  let idleTimer: NodeJS.Timeout | null = null
  let graceTimer: NodeJS.Timeout | null = null
  let lastActivity = Date.now()

  const finish = (status: AskResult["status"], extra?: Partial<AskResult>) => {
    if (resolved) return
    resolved = true
    finalStatus = status
    if (idleTimer) clearInterval(idleTimer)
    if (graceTimer) clearTimeout(graceTimer)
    const answers = (extra?.answers as Record<string, unknown>) || {}
    const partial = extra?.partial !== undefined ? (extra.partial as Record<string, unknown> | null) : lastPartial
    const basis = Object.keys(answers).length ? answers : partial || {}
    const unanswered = interactiveIds(spec).filter((id) => isEmpty(basis[id]))
    settle({
      status,
      answers,
      partial,
      unanswered,
      elapsedMs: Date.now() - started,
      idleTimedOut: status === "timeout",
      message: extra?.message,
      url: extra?.url,
      hint: hintFor(status),
    })
  }

  const json = (res: http.ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" })
    res.end(JSON.stringify(body))
  }

  const readBody = (req: http.IncomingMessage) =>
    new Promise<any>((res) => {
      let buf = ""
      req.on("data", (c) => {
        buf += c
        if (buf.length > 4_000_000) req.destroy()
      })
      req.on("end", () => {
        try {
          res(JSON.parse(buf || "{}"))
        } catch {
          res({})
        }
      })
      req.on("error", () => res({}))
    })

  const streamFile = (
    res: http.ServerResponse,
    target: string,
    code: number,
    headers: Record<string, string>,
    opts?: { start?: number; end?: number },
  ) => {
    const rs = fs.createReadStream(target, opts)
    rs.on("error", () => {
      try {
        res.destroy()
      } catch {}
    })
    res.on("close", () => {
      try {
        rs.destroy()
      } catch {}
    })
    res.writeHead(code, headers)
    rs.pipe(res)
  }

  const serveAsset = (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => {
    if (url.searchParams.get("t") !== token) {
      res.writeHead(403).end("forbidden")
      return
    }
    const raw = url.searchParams.get("p") || ""
    let target: string
    try {
      target = path.resolve(raw)
    } catch {
      res.writeHead(400).end("bad path")
      return
    }
    if (!allowedResolved.has(target)) {
      res.writeHead(403).end("path not allowed")
      return
    }
    let st: fs.Stats
    try {
      st = fs.statSync(target)
    } catch {
      res.writeHead(404).end("not found")
      return
    }
    if (!st.isFile()) {
      res.writeHead(400).end("not a file")
      return
    }
    const ext = path.extname(target).toLowerCase()
    const type = MIME[ext] || (TEXT_EXT.has(ext) ? "text/plain; charset=utf-8" : "application/octet-stream")
    const headers: Record<string, string> = {
      "content-type": type,
      "cache-control": "no-store",
      "accept-ranges": "bytes",
    }
    if (ext === ".html" || ext === ".svg") headers["content-security-policy"] = "sandbox allow-same-origin"
    const range = req.headers.range
    if (range && /^bytes=\d*-\d*$/.test(range)) {
      const parts = range.replace("bytes=", "").split("-")
      const start = parts[0] ? parseInt(parts[0], 10) : 0
      const end = parts[1] ? Math.min(parseInt(parts[1], 10), st.size - 1) : st.size - 1
      if (start >= st.size || start > end) {
        res.writeHead(416, { "content-range": `bytes */${st.size}` }).end()
        return
      }
      headers["content-range"] = `bytes ${start}-${end}/${st.size}`
      headers["content-length"] = String(end - start + 1)
      streamFile(res, target, 206, headers, { start, end })
      return
    }
    headers["content-length"] = String(st.size)
    streamFile(res, target, 200, headers)
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1")
    const p = url.pathname
    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      clientSeen = true
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "content-security-policy":
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: https: http:; font-src data:; frame-src 'self' https: http:; connect-src 'self'; base-uri 'none'; form-action 'none'",
      })
      res.end(page)
      return
    }
    if (p === "/favicon.ico") {
      res.writeHead(204).end()
      return
    }
    if (req.method === "GET" && p === "/asset") {
      clientSeen = true
      serveAsset(req, res, url)
      return
    }
    if (p === "/api/ping") {
      clientSeen = true
      json(res, 200, { status: finalStatus || "waiting", elapsedMs: Date.now() - started })
      return
    }
    if (req.method === "POST" && p.startsWith("/api/")) {
      if (req.headers["x-ask-token"] !== token) {
        json(res, 403, { ok: false, error: "bad token" })
        return
      }
      clientSeen = true
      const body = await readBody(req)
      if (p === "/api/activity") {
        lastActivity = Date.now()
        json(res, 200, { ok: true })
        return
      }
      if (p === "/api/partial") {
        lastPartial = (body && body.answers) || null
        json(res, 200, { ok: true })
        if (finalStatus && !resolved) finish("timeout", { partial: lastPartial })
        return
      }
      if (p === "/api/submit") {
        if (finalStatus) {
          json(res, 409, { ok: false, error: "already closed" })
          return
        }
        json(res, 200, { ok: true })
        finish("submitted", { answers: (body && body.answers) || {} })
        return
      }
      if (p === "/api/cancel") {
        json(res, 200, { ok: true })
        if (!finalStatus) finish("cancelled", { answers: lastPartial || {} })
        return
      }
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found")
  })

  let port = 0
  try {
    port = await new Promise<number>((res, rej) => {
      let attempt = 0
      const tryListen = () => {
        attempt++
        const candidate = 39000 + Math.floor(Math.random() * 3000)
        const onError = (e: NodeJS.ErrnoException) => {
          if (e.code === "EADDRINUSE" && attempt < 12) {
            server.removeListener("error", onError)
            tryListen()
          } else {
            rej(e)
          }
        }
        server.once("error", onError)
        server.listen(candidate, "127.0.0.1", () => {
          server.removeListener("error", onError)
          const addr = server.address()
          res(typeof addr === "object" && addr ? addr.port : candidate)
        })
      }
      tryListen()
    })
  } catch (e) {
    return {
      status: "error",
      answers: {},
      partial: null,
      unanswered: [],
      elapsedMs: Date.now() - started,
      idleTimedOut: false,
      message: "本地服务启动失败：" + String((e as Error)?.message || e),
      hint: hintFor("error"),
    }
  }

  const url = `http://127.0.0.1:${port}/?t=${token}`
  if (process.env.ASK_URL_FILE) {
    try {
      fs.writeFileSync(process.env.ASK_URL_FILE, url, "utf8")
    } catch {}
  }
  const launched = process.env.ASK_NO_OPEN ? { mode: "none", detail: "ASK_NO_OPEN" } : launch(url, windowMode)
  if (launched.mode === "none" && !process.env.ASK_NO_OPEN) {
    try {
      server.close()
    } catch {}
    return {
      status: "error",
      answers: {},
      partial: null,
      unanswered: [],
      elapsedMs: Date.now() - started,
      idleTimedOut: false,
      message: "无法自动打开浏览器窗口：" + launched.detail,
      url,
      hint: hintFor("error"),
    }
  }

  if (timeoutMs) {
    idleTimer = setInterval(() => {
      if (resolved) return
      if (Date.now() - lastActivity >= timeoutMs) {
        finalStatus = "timeout"
        if (idleTimer) clearInterval(idleTimer)
        idleTimer = null
        const t = setTimeout(() => finish("timeout", { partial: lastPartial }), 2500)
        t.unref?.()
      }
    }, 500)
    idleTimer.unref?.()
  }

  graceTimer = setTimeout(() => {
    if (!clientSeen && !resolved) {
      finish("error", {
        message: `窗口已尝试打开但 ${graceSeconds} 秒内没有任何访问。可能是浏览器没有弹出来，请让用户手动打开：${url}`,
        url,
      })
    }
  }, Math.max(5, graceSeconds) * 1000)
  graceTimer.unref?.()

  const result = await done
  result.url = url

  const c1 = setTimeout(() => {
    try {
      server.close()
    } catch {}
  }, 15000)
  c1.unref?.()
  const c2 = setTimeout(() => {
    try {
      server.closeAllConnections?.()
    } catch {}
  }, 16000)
  c2.unref?.()

  return result
}

export default tool({
  description:
    "向用户提出需要「看得清楚」的需求确认：支持 Markdown 正文、带图片/预览的选项卡、自由文本、多字段表单、多选排序、分步向导、表格与代码 diff、PDF/文本附件预览，以及内联 SVG。会在用户桌面弹出一个独立的交互窗口，等用户提交后把结构化 JSON 结果返回。当内置 question 工具无法表达清楚（要展示预览图、多种方案对比、附件、长文档、多步流程、需要同时收集多个字段）时使用本工具。使用前先读 skill `ai-ask-detailed-needs` 的 spec 格式与设计规范。",
  args: {
    title: tool.schema.string().describe("窗口标题，一句话说清在确认什么，例如「选一个论文封面风格」"),
    subtitle: tool.schema.string().optional().describe("标题下的一行小字，可写背景或当前进度"),
    icon: tool.schema.string().optional().describe("标题左侧的小图标，一个 emoji 或 1-2 个字符"),
    intro: tool.schema
      .string()
      .optional()
      .describe("顶部说明，Markdown。写清背景、你已经做了什么、为什么需要用户决定"),
    blocks: tool.schema
      .any()
      .optional()
      .describe(
        "单页模式的块数组（与 steps 二选一）。每个块是对象，type 取值见 skill 参考：markdown/note/choice/text/form/ranking/slider/table/code/attachment/html/divider",
      ),
    steps: tool.schema
      .any()
      .optional()
      .describe("分步向导模式（与 blocks 二选一）：[{id,title,description,blocks:[...]}]"),
    timeoutSeconds: tool.schema
      .number()
      .optional()
      .describe(
        "空闲超时秒数：用户在这段时间内完全没有操作就判定未响应。按重要程度给：小确认 120，普通 600，重要或需要思考 1800，绝不超时填 0。默认 900",
      ),
    submitLabel: tool.schema.string().optional().describe("提交按钮文字，默认「提交」"),
    cancelLabel: tool.schema.string().optional().describe("取消按钮文字，默认「取消」"),
    nextLabel: tool.schema.string().optional().describe("下一步按钮文字"),
    prevLabel: tool.schema.string().optional().describe("上一步按钮文字"),
    allowCancel: tool.schema.boolean().optional().describe("是否允许取消，默认 true"),
    theme: tool.schema.string().optional().describe("auto | light | dark，默认 auto"),
    wide: tool.schema.boolean().optional().describe("是否用更宽的三栏布局（适合多张预览图并排）"),
    density: tool.schema.string().optional().describe("comfortable | compact"),
    windowMode: tool.schema
      .string()
      .optional()
      .describe("auto（有 Edge/Chrome 就用无边框应用窗口，否则默认浏览器）| app | browser，默认 auto"),
    assets: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("额外的本地文件/目录白名单（一般不用填，块里出现的本地路径会自动放行）"),
  },
  async execute(args, context) {
    const spec: Record<string, any> = {
      ...args,
      blocks: parseMaybeJson(args.blocks),
      steps: parseMaybeJson(args.steps),
    }
    if (!Array.isArray(spec.blocks) && !Array.isArray(spec.steps)) {
      return JSON.stringify(
        {
          status: "error",
          message: "blocks 或 steps 至少有一个要是数组。请阅读 skill `ai-ask-detailed-needs` 的 spec 格式后重试。",
        },
        null,
        2,
      )
    }
    if (Array.isArray(spec.blocks) && Array.isArray(spec.steps)) delete spec.blocks
    const warnings = normalizeSpec(spec)
    normalizeText(spec, warnings)
    const result = await runAsk(spec, { directory: context?.directory })
    if (warnings.length) result.warnings = warnings
    return JSON.stringify(result, null, 2)
  },
})
