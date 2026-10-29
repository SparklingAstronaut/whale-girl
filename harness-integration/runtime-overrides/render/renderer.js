// 渲染层（renderer）：Canvas 帧播放器 + 网页版同款互动菜单/状态卡/回话气泡/爱心特效 + 动态点击穿透。
// 数据全部来自主进程 IPC（whaleGirl.*），零网络、零 CORS 面。
// 帧播放对齐 whale-girl manifest（每状态一张横排 sheet：frames/fps/playback/motion）。
// 交互对齐网页版 whale-girl：
//   - 悬停宠物 → 下方显示状态卡（Lv / 任务数 / 最近回忆）；
//   - 单击宠物 → 上方弹出互动菜单（喂食 / 玩耍 / 更换）；拖动 = 移动位置；
//   - 回话气泡显示在宠物上方，喂食/玩耍时冒爱心。
// 窗口比宠物大（浮层画在透明边距里），点击穿透按鼠标所在位置动态切换：只有宠物本体、
// 打开的菜单、显示中的状态卡可点击，其余透明区域不挡桌面。

(() => {
  'use strict'

  const wg = window.whaleGirl
  if (!wg) { console.error('[renderer] 无 whaleGirl bridge（preload 未加载）'); return }

  const canvas = document.getElementById('pet')
  const ctx = canvas.getContext('2d', { willReadFrequently: false })
  const bubble = document.getElementById('bubble')
  const menu = document.getElementById('menu')
  const statusCard = document.getElementById('status')
  const effects = document.getElementById('effects')
  const metaLv = statusCard.querySelector('.pet-lv')
  const metaStats = statusCard.querySelector('.pet-stats')
  const metaNote = statusCard.querySelector('.pet-note')
  const DEBUG_SHOW = new URLSearchParams(location.search).get('debugShow') === '1'

  let manifest = null
  let characterId = 'whale-girl'
  const sheetCache = new Map() // `${characterId}/${sheet}` → { img, w, h }
  let animState = 'idle'
  let animCtx = {}
  let frame = 0
  let frameDir = 1
  let lastFrameAt = 0
  let blinkActive = false
  let blinkAt = 0
  let flip = 1
  let facingAt = 0
  let snapshot = null
  let bubbleTimer = null
  let petBox = null // 当前帧不透明区域（canvas 像素坐标）

  // ---- 画布尺寸 ----
  const PET_BASE = 110
  function applySize() {
    const size = PET_BASE
    canvas.width = size
    canvas.height = size
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
  }

  // ---- 状态配置 ----
  function stateCfg(name) {
    return manifest?.characters?.[characterId]?.states?.[name] ?? null
  }
  function sheetKey(sheet) {
    return `${characterId}/${sheet}`
  }
  function framesOf(cfg) {
    const n = cfg?.frames
    return typeof n === 'number' && n > 0 ? Math.floor(n) : 1
  }
  async function ensureSheet(cfg) {
    if (!cfg || !cfg.sheet) return null
    const key = sheetKey(cfg.sheet)
    if (sheetCache.has(key)) return sheetCache.get(key)
    const dataURL = await wg.getSheet(characterId, cfg.sheet)
    if (!dataURL) { sheetCache.set(key, null); return null }
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = dataURL
    })
    const entry = { img, w: img.naturalWidth, h: img.naturalHeight }
    sheetCache.set(key, entry)
    return entry
  }

  // ---- 帧推进（playback 对齐 whale-girl：loop/pingpong/once/blink） ----
  function tickFrame(now) {
    const cfg = stateCfg(animState)
    if (!cfg || !cfg.sheet) return
    if (!(cfg.frames > 1)) return

    const step = () => {
      const entry = sheetCache.get(sheetKey(cfg.sheet))
      if (!entry) return
      const frames = framesOf(cfg)
      const frameW = Math.floor(entry.w / frames)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.scale(flip, 1)
      ctx.drawImage(
        entry.img,
        frame * frameW, 0, frameW, entry.h,
        -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height,
      )
      ctx.restore()
    }

    if (cfg.playback === 'blink') {
      if (blinkActive) {
        if (now - lastFrameAt >= 1000 / cfg.fps) {
          lastFrameAt = now
          frame += 1
          if (frame >= cfg.frames) { frame = 0; blinkActive = false; blinkAt = now + rand(3000, 9000) }
          step()
        }
      } else {
        if (frame !== 0) { frame = 0; step() }
        if (blinkAt === 0) blinkAt = now + rand(3000, 9000)
        if (now >= blinkAt) blinkActive = true
      }
      return
    }

    if (now - lastFrameAt >= 1000 / (cfg.fps || 2)) {
      lastFrameAt = now
      frame += frameDir
      if (cfg.playback === 'pingpong') {
        if (frame >= cfg.frames - 1 || frame <= 0) frameDir *= -1
        frame = Math.max(0, Math.min(cfg.frames - 1, frame))
      } else if (frame >= cfg.frames) {
        if (cfg.playback === 'loop') frame = 0
        else frame = cfg.frames - 1
      }
      step()
    } else if (!sheetCache.get(sheetKey(cfg.sheet))?.rendered) {
      step()
    }
  }

  // ---- 随机转身（对齐 whale-girl：静态态偶尔转身） ----
  function tickFacing(now, cfg) {
    if (animState === 'idle' || animState === 'think' || animState === 'wait') {
      if (facingAt === 0) facingAt = now + rand(10000, 25000)
      if (now >= facingAt) {
        flip = -flip
        facingAt = now + rand(10000, 25000)
        const entry = sheetCache.get(sheetKey(cfg.sheet))
        if (entry?.rendered) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.save(); ctx.translate(canvas.width/2, canvas.height/2); ctx.scale(flip, 1)
          const frameW = Math.floor(entry.w / framesOf(cfg))
          ctx.drawImage(entry.img, frame * frameW, 0, frameW, entry.h, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height)
          ctx.restore()
        }
      }
    } else if (facingAt !== 0) {
      facingAt = 0
    }
  }

  function rand(min, max) {
    return min + Math.random() * (max - min)
  }

  // ---- 切换动画状态 ----
  async function switchAnim(next) {
    const name = next?.name || 'idle'
    if (name === animState) {
      animCtx = next?.context ?? animCtx
      const cfg = stateCfg(name)
      if (cfg && !sheetCache.has(sheetKey(cfg.sheet))) {
        await ensureSheet(cfg)
        drawFrame()
        reportHitarea()
      }
      return
    }
    animState = name
    animCtx = next?.context ?? animCtx
    frame = 0
    frameDir = 1
    blinkActive = false
    blinkAt = 0
    lastFrameAt = 0
    if (name === 'walk') {
      walkDir = Math.random() < 0.5 ? 1 : -1
      flip = -walkDir
    }
    applySize()
    const cfg = stateCfg(name)
    if (!cfg) { drawPlaceholder(); petBox = null; return }
    await ensureSheet(cfg)
    drawFrame()
    reportHitarea()
  }

  function drawPlaceholder() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width/2, canvas.height/2)
    ctx.font = `${Math.floor(canvas.width * 0.4)}px system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🐳', 0, 0)
    ctx.restore()
  }

  function drawFrame() {
    const cfg = stateCfg(animState)
    if (!cfg) return drawPlaceholder()
    const entry = sheetCache.get(sheetKey(cfg.sheet))
    if (!entry) return drawPlaceholder()
    const frameW = Math.floor(entry.w / framesOf(cfg))
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.scale(flip, 1)
    ctx.drawImage(entry.img, frame * frameW, 0, frameW, entry.h,
      -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height)
    ctx.restore()
    entry.rendered = true
  }

  // ---- 当前帧不透明区域（用于点击穿透与悬停判定） ----
  function reportHitarea() {
    const cfg = stateCfg(animState)
    const entry = sheetCache.get(sheetKey(cfg?.sheet))
    if (!entry) { petBox = null; refreshPointer(); return }
    const frameW = Math.floor(entry.w / framesOf(cfg))
    const off = document.createElement('canvas')
    off.width = frameW; off.height = entry.h
    const octx = off.getContext('2d')
    octx.drawImage(entry.img, frame * frameW, 0, frameW, entry.h, 0, 0, frameW, entry.h)
    const data = octx.getImageData(0, 0, frameW, entry.h).data
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
    for (let y = 0; y < entry.h; y++) {
      for (let x = 0; x < frameW; x++) {
        if (data[(y * frameW + x) * 4 + 3] > 24) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) { petBox = null; refreshPointer(); return }
    const scaleX = canvas.width / frameW
    const scaleY = canvas.height / entry.h
    // 翻转时 bbox 水平镜像
    let x = minX * scaleX
    const w = (maxX - minX + 1) * scaleX
    if (flip < 0) x = canvas.width - x - w
    petBox = { x, y: minY * scaleY, w, h: (maxY - minY + 1) * scaleY }
    refreshPointer()
  }

  // ---- 动态点击穿透：鼠标在可交互元素上 → 窗口接收鼠标；否则穿透到桌面 ----
  let interactive = false
  let pointer = null // 最近一次鼠标位置（窗口 CSS 坐标；穿透期间由 forward 转发）
  function setInteractive(on) {
    if (on === interactive) return
    interactive = on
    wg.setHitarea(on ? { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight } : null)
  }
  function petRect() {
    if (!petBox) return null
    const r = canvas.getBoundingClientRect()
    const sx = r.width / canvas.width
    const sy = r.height / canvas.height
    return { left: r.left + petBox.x * sx, top: r.top + petBox.y * sy, right: r.left + (petBox.x + petBox.w) * sx, bottom: r.top + (petBox.y + petBox.h) * sy }
  }
  function inside(pt, rect, pad = 0) {
    return !!rect && pt.x >= rect.left - pad && pt.x <= rect.right + pad && pt.y >= rect.top - pad && pt.y <= rect.bottom + pad
  }
  function hitTest(pt) {
    if (!pt) return null
    if (inside(pt, petRect(), 2)) return 'pet'
    if (menu.classList.contains('open') && inside(pt, menu.getBoundingClientRect(), 4)) return 'menu'
    if (statusCard.classList.contains('show') && inside(pt, statusCard.getBoundingClientRect(), 4)) return 'status'
    return null
  }
  function refreshPointer() {
    if (dragStart) { setInteractive(true); return }
    const hit = hitTest(pointer)
    setInteractive(hit !== null)
    if (hit === 'pet' || hit === 'status') { scheduleStatus(true) } else { scheduleStatus(false) }
    if (hit === null && menu.classList.contains('open')) scheduleMenuClose()
    else cancelMenuClose()
  }
  document.addEventListener('mousemove', (e) => {
    pointer = { x: e.clientX, y: e.clientY }
    refreshPointer()
  })
  document.addEventListener('mouseleave', () => {
    if (dragStart) return
    pointer = null
    refreshPointer()
  })
  // 主进程光标轮询：窗口处于点击穿透时也能知道光标位置/是否离开
  if (typeof wg.onCursor === 'function') {
    wg.onCursor((point) => {
      if (dragStart) return
      pointer = point
      refreshPointer()
    })
  }
  // 点了别处（窗口失焦）→ 关菜单，对齐网页版“点外部关闭”
  window.addEventListener('blur', () => { if (!DEBUG_SHOW) toggleMenu(false) })

  // ---- 状态卡（悬停宠物显示，对齐网页版 .pet-status） ----
  let statusTimer = null
  function statusAllowed() {
    return !dragging && !menu.classList.contains('open') && !bubble.classList.contains('show')
  }
  // 只在“想显示/想隐藏”变化时才重设计时器；否则鼠标一直在动会让计时器不停重置、卡片永远不消失。
  let statusWant = false
  function scheduleStatus(show) {
    if (DEBUG_SHOW) return
    if (show && !statusAllowed()) show = false
    if (show === statusWant) return
    statusWant = show
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => {
      if (statusWant && statusAllowed()) statusCard.classList.add('show')
      else if (!statusWant) statusCard.classList.remove('show')
    }, show ? 60 : 200)
  }
  function hideStatusNow() {
    if (DEBUG_SHOW) return
    statusWant = false
    clearTimeout(statusTimer)
    statusCard.classList.remove('show')
  }
  function renderStatus() {
    const p = snapshot?.pet
    if (!p) return
    metaLv.textContent = `Lv.${p.level ?? 1}`
    const done = p.stats?.tasksDone ?? 0
    const failures = p.stats?.failures ?? 0
    metaStats.textContent = failures > 0 ? `${done} 任务 · ${failures} 失败` : `${done} 任务`
    const memory = Array.isArray(p.memory) ? p.memory : []
    const titles = Array.isArray(p.titles) ? p.titles : []
    const last = memory[memory.length - 1]
    metaNote.textContent = last ?? (titles.length > 0 ? `称号「${titles.join('」「')}」` : '…')
  }

  // ---- 互动菜单（单击宠物打开，对齐网页版 .pet-menu） ----
  let menuCloseTimer = null
  function cancelMenuClose() {
    clearTimeout(menuCloseTimer)
    menuCloseTimer = null
  }
  function toggleMenu(open) {
    const next = open ?? !menu.classList.contains('open')
    menu.classList.toggle('open', next)
    cancelMenuClose()
    if (next) hideStatusNow()
    refreshPointer()
  }
  function scheduleMenuClose() {
    if (DEBUG_SHOW || menuCloseTimer) return // 已在倒计时就不重置，鼠标在外面一直动也会按时关闭
    menuCloseTimer = setTimeout(() => { menuCloseTimer = null; toggleMenu(false) }, 2500)
  }
  function listCharacters() {
    return Object.keys(manifest?.characters ?? {})
  }
  menu.addEventListener('click', async (e) => {
    const button = e.target.closest('button[data-action]')
    if (!button) return
    const action = button.dataset.action
    toggleMenu(false)
    if (action === 'feed' || action === 'play') {
      spawnHearts()
      wg.interact(action)
    } else if (action === 'role') {
      const roles = listCharacters()
      if (roles.length < 2) return // 只有一个角色时与网页版一致：不切换
      const next = roles[(roles.indexOf(characterId) + 1) % roles.length]
      characterId = next
      const resume = lastEngineAnim ?? { name: animState, context: animCtx }
      animState = ''
      await switchAnim(resume)
    }
  })
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false) })

  // ---- 爱心特效（对齐网页版 spawnHearts） ----
  function spawnHearts() {
    for (let i = 0; i < 4; i++) {
      const heart = document.createElement('div')
      heart.className = 'pet-heart'
      heart.textContent = '💗'
      heart.style.left = `${Math.random() * 90}px`
      heart.style.top = `${20 + Math.random() * 60}px`
      effects.appendChild(heart)
      if (typeof heart.animate === 'function') {
        heart.animate(
          [
            { opacity: 1, transform: 'translateY(0) scale(.7)' },
            { opacity: 1, transform: 'translateY(-60%) scale(1.25)', offset: 0.7 },
            { opacity: 0, transform: 'translateY(-120%) scale(1.4)' },
          ],
          { duration: 1800, easing: 'ease-out', fill: 'forwards' },
        )
      }
      setTimeout(() => heart.remove(), 2000)
    }
  }

  // ---- 回话气泡（宠物上方，对齐网页版 .pet-bubble） ----
  function showBubble(text) {
    if (menu.classList.contains('open')) toggleMenu(false)
    hideStatusNow()
    bubble.textContent = text
    bubble.classList.add('show')
    clearTimeout(bubbleTimer)
    bubbleTimer = setTimeout(() => { bubble.classList.remove('show'); refreshPointer() }, 2500)
  }

  // ---- 主循环 ----
  const WALK_SPEED_PX = 45 // 与 whale-girl walk.speedPxPerSec 一致
  let walkDir = 0
  let lastWalkStepAt = 0
  let walkInFlight = false
  function loop(now) {
    try {
      const cfg = stateCfg(animState)
      if (cfg) {
        tickFrame(now)
        tickFacing(now, cfg)
      } else if (animState) {
        drawPlaceholder()
      }
      if (animState === 'walk' && walkDir !== 0 && !dragging && !walkInFlight && now - lastWalkStepAt >= 50) {
        lastWalkStepAt = now
        const dx = Math.round(WALK_SPEED_PX * 0.05 * walkDir)
        walkInFlight = true
        // dragWindow 返回 Promise<boolean>（是否撞到屏幕边缘）；兼容旧主进程返回 undefined 的情况
        Promise.resolve(wg.dragWindow(dx, 0)).then((hit) => {
          if (hit === true) { walkDir = -walkDir; flip = -flip }
        }).catch(() => {}).finally(() => { walkInFlight = false })
      }
    } catch (err) {
      console.error('[renderer] loop error:', err)
    }
    requestAnimationFrame(loop) // 即使本帧出错也继续，避免整只宠物定格
  }

  // ---- 交互：点击（开菜单）/ 拖拽（移动） ----
  let dragStart = null
  let dragging = false
  let lastEngineAnim = null
  canvas.addEventListener('pointerdown', (e) => {
    if (!inside({ x: e.clientX, y: e.clientY }, petRect(), 2)) return
    dragStart = { x: e.screenX, y: e.screenY, moved: false, px: e.screenX, py: e.screenY }
    canvas.setPointerCapture(e.pointerId)
    setInteractive(true)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!dragStart) return
    const dx = e.screenX - dragStart.x
    const dy = e.screenY - dragStart.y
    if (!dragStart.moved && Math.hypot(dx, dy) > 6) {
      dragStart.moved = true
      dragStart.px = e.screenX
      dragStart.py = e.screenY
      dragging = true
      toggleMenu(false)
      hideStatusNow()
      switchAnim({ name: 'drag', context: {} })
    }
    if (dragStart.moved) {
      const ddx = e.screenX - dragStart.px
      const ddy = e.screenY - dragStart.py
      if (ddx !== 0 || ddy !== 0) {
        const nextFlip = ddx < 0 ? 1 : -1
        if (ddx !== 0 && nextFlip !== flip) {
          flip = nextFlip
          drawFrame()
          reportHitarea()
        }
        Promise.resolve(wg.dragWindow(ddx, ddy)).catch(() => {})
        dragStart.px = e.screenX
        dragStart.py = e.screenY
      }
    }
  })
  const endPointer = () => {
    const wasClick = dragStart && !dragStart.moved
    if (dragging) {
      dragging = false
      switchAnim(lastEngineAnim ?? { name: 'idle', context: {} })
    }
    dragStart = null
    if (wasClick) toggleMenu()
    refreshPointer()
  }
  canvas.addEventListener('pointerup', endPointer)
  canvas.addEventListener('pointercancel', () => { if (dragStart) { dragStart.moved = true } endPointer() })

  // ---- IPC 订阅 ----
  wg.onAnim(async (anim) => {
    lastEngineAnim = anim
    if (dragging) return
    await switchAnim(anim)
  })
  wg.onSnapshot((snap) => {
    snapshot = snap
    renderStatus()
  })
  wg.onReply((reply) => {
    if (reply) showBubble(reply)
  })

  // ---- 启动 ----
  ;(async () => {
    manifest = await wg.getManifest()
    if (manifest?.default) characterId = manifest.default
    applySize()
    await switchAnim({ name: 'idle', context: {} })
    requestAnimationFrame(loop)
    renderStatus()
    if (DEBUG_SHOW) {
      // 调试截图用：同时展示菜单和状态卡
      menu.classList.add('open')
      statusCard.classList.add('show')
      statusCard.style.transition = 'none'
    }
  })()
})()
