// Electron preload：暴露最小安全 IPC 面给 renderer（contextBridge）。
// renderer 只拿得到 whaleGirl.*，无 Node 全局——保持 contextIsolation 语义。
// dragWindow 用 invoke：返回 Promise<boolean>（是否撞到屏幕边缘），游走时据此掉头。
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('whaleGirl', {
  getManifest: () => ipcRenderer.invoke('wg:manifest'),
  getSheet: (characterId, sheet) => ipcRenderer.invoke('wg:sheet', { characterId, sheet }),
  interact: (action) => ipcRenderer.send('wg:interact', action),
  setHitarea: (rect) => ipcRenderer.send('wg:set-hitarea', rect),
  dragWindow: (dx, dy) => ipcRenderer.invoke('wg:drag-window', { dx, dy }),
  onAnim: (cb) => ipcRenderer.on('wg:anim', (_e, anim) => cb(anim)),
  onSnapshot: (cb) => ipcRenderer.on('wg:snapshot', (_e, snap) => cb(snap)),
  onReply: (cb) => ipcRenderer.on('wg:reply', (_e, reply) => cb(reply)),
  onCursor: (cb) => ipcRenderer.on('wg:cursor', (_e, point) => cb(point)),
})
