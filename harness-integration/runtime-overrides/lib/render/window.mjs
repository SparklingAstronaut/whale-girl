// Electron 桌面渲染壳（main 进程）：
// - 透明、无边框、置顶的宠物窗口
// - 核心引擎（createCompanion）在本进程运行，hooks 把动画意图/快照/回话经 IPC 推给 renderer
// - 渲染层零网络：manifest/sprite 由本进程拉取转 dataURL 再下发（绕过 CORS、单一数据通道）
// - 退出时显式 {online:false}（companion.stop()），网页宠物即恢复
//
// 由于鲸鱼娘 sprite 站姿是「透明图 + 四周透明」，窗口需要精确贴合内容才不挡鼠标——
// renderer 侧用 canvas 内容 bbox 计算实际不透明区，据此切换 ignoreMouseEvents（点击穿透）。

import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '../client/http.mjs'
import { createCompanion } from '../client/companion.mjs'
import { createLogger } from '../client/utils.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDER_DIR = join(__dirname, '..', '..', 'render')

const DEFAULT_SIZE = 110
// 窗口留出宠物上方菜单/气泡与下方状态卡的空间（与 integration-entry 的 BASE_W/BASE_H 保持一致）
export const WINDOW_W = 240
export const WINDOW_H = 260

let win = null
let companion = null

/**
 * 创建透明置顶宠物窗口。
 */
function createWindow() {
  win = new BrowserWindow({
    width: DEFAULT_SIZE + 40,   // 稍大留呼吸边（视觉 shadow 余量）
    height: DEFAULT_SIZE + 40,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    // 只加载本地 render/ 页面（file://）+ 本机 IPC；不开 remote。
    webPreferences: {
      preload: join(RENDER_DIR, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:true —— preload 只用 contextBridge/ipcRenderer（sandboxed preload 原生可用）；
      // renderer 无 Node 全局、只暴露 whaleGirl.*，安全边界最大化（Copilot 建议）。
      sandbox: true,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadFile(join(RENDER_DIR, 'index.html'), process.env.WG_DEBUG_SHOW === '1' ? { query: { debugShow: '1' } } : undefined)

  // 默认点击穿透（只有宠物本体可交互）——renderer 每帧回调真实 bbox。
  win.setIgnoreMouseEvents(true, { forward: true })

  // 光标轮询（10 次/秒）：点击穿透状态下光标离开窗口时页面收不到任何事件，
  // 由主进程告诉渲染层光标在哪，悬停状态卡/菜单自动关闭才可靠。
  let cursorInside = false
  const cursorTimer = setInterval(() => {
    if (!win || win.isDestroyed()) return
    const p = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height
    if (inside) {
      const zoom = win.webContents.getZoomFactor() || 1
      win.webContents.send('wg:cursor', { x: (p.x - b.x) / zoom, y: (p.y - b.y) / zoom })
      cursorInside = true
    } else if (cursorInside) {
      win.webContents.send('wg:cursor', null)
      cursorInside = false
    }
  }, 100)
  win.on('closed', () => { clearInterval(cursorTimer); win = null })
  return win
}

/**
 * 主进程骨架：加载 manifest/sprite，喂给 renderer。
 */
function setupIpc(client) {
  const sheetCache = new Map() // `${characterId}/${sheet}` → dataURL

  ipcMain.handle('wg:manifest', async () => {
    try {
      return await client.getManifest()
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('wg:sheet', async (_e, { characterId = 'whale-girl', sheet }) => {
    const key = `${characterId}/${sheet}`
    if (sheetCache.has(key)) return sheetCache.get(key)
    const url = `${client.url(`/assets/characters/${characterId}/${sheet}`)}`
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = Buffer.from(await res.arrayBuffer())
      const { nativeImage } = await import('electron')
      const img = nativeImage.createFromBuffer(buf)
      const dataURL = img.toDataURL()
      sheetCache.set(key, dataURL)
      return dataURL
    } catch (err) {
      console.error(`[wg:sheet] ${key} 失败:`, err.message)
      return null
    }
  })

  ipcMain.on('wg:interact', async (_e, action) => {
    if (companion) await companion.interact(action === 'play' ? 'play' : 'feed')
  })

  // 渲染层告知宠物内容 bbox → 切换点击穿透（桌面宠物不挡非宠物区域）：
  // 有内容（宠物可见）→ 窗口可交互（点击投喂/拖拽）；null（占位/空）→ 全透。
  // P2 增强：可进一步把窗口缩到内容 bbox 精确贴合（见 DESIGN §6 风险对策）。
  ipcMain.on('wg:set-hitarea', (_e, rect) => {
    if (!win) return
    win.setIgnoreMouseEvents(rect === null, { forward: true })
  })

  // 渲染层拖拽移动窗口：告知屏幕 delta（让宠物可拖动换位）
  ipcMain.handle('wg:drag-window', (_e, { dx, dy }) => {
    if (!win || win.isDestroyed()) return false
    const [x, y] = win.getPosition()
    const [w, h] = win.getSize()
    const zoom = win.webContents.getZoomFactor() || 1
    const area = screen.getDisplayMatching({ x, y, width: w, height: h }).workArea
    // 水平：允许透明边距伸出屏幕，让宠物本体能贴边；垂直：整窗留在屏幕内，保证上方菜单和下方状态卡可见
    const marginX = Math.max(0, Math.floor(w / 2 - (DEFAULT_SIZE / 2) * zoom))
    const minX = area.x - marginX, maxX = area.x + area.width - w + marginX
    const minY = area.y, maxY = area.y + area.height - h
    const wantX = x + Math.round(dx), wantY = y + Math.round(dy)
    const nx = Math.min(maxX, Math.max(minX, wantX))
    const ny = Math.min(maxY, Math.max(minY, wantY))
    win.setPosition(nx, ny)
    return nx !== wantX
  })
}

/**
 * 启动桌面渲染（Electron main 路径入口）。
 */
export async function runDesktop({ cfg, log }) {
  const client = createClient({ baseURL: cfg.baseURL })

  await app.whenReady()
  log.info('Electron 就绪，创建宠物窗口')
  createWindow()
  setupIpc(client)

  companion = await createCompanion(cfg, {
    onSnapshot: (snap) => {
      if (win) win.webContents.send('wg:snapshot', snap)
    },
    onAnimation: (anim) => {
      if (win) win.webContents.send('wg:anim', anim)
    },
    onReply: (reply) => {
      if (win) win.webContents.send('wg:reply', reply)
    },
  })

  log.info(`桌面渲染运行中：BaseURL=${cfg.baseURL}（在场上线）`)

  const shutdown = async () => {
    if (companion) await companion.stop()
    app.quit()
  }
  app.on('before-quit', (e) => {
    // 幂等：before-quit 可多次触发
  })
  app.on('window-all-closed', () => {
    // 宠物窗口关闭 = 退出（不留后台）
    shutdown()
  })
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}