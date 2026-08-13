/*!
 * weather.js —— 通用天气效果库（雨天 / 雪天）
 *
 * 在任意页面引入本脚本后，即可用全局对象 Weather 启动 / 停止天气效果。
 * 效果绘制在独立的覆盖层 <canvas> 上，pointer-events:none，不影响页面其它交互。
 *
 * ── 用法示例 ────────────────────────────────────────────────
 *   Weather.start('rain', 'drizzle')       // 小雨
 *   Weather.start('rain', 'light')         // 中雨
 *   Weather.start('rain', 'moderate')      // 大雨
 *   Weather.start('rain', 'heavy')         // 暴雨
 *   Weather.start('rain', 'thunderstorm')  // 雷暴雨（含闪电 + 暗沉氛围）
 *
 *   Weather.start('snow', 'light')         // 小雪
 *   Weather.start('snow', 'moderate')      // 中雪
 *   Weather.start('snow', 'heavy')         // 大雪
 *   Weather.start('snow', 'blizzard')      // 暴风雪（强风 + 白雾）
 *
 *   Weather.random()                       // 随机天气：雨/雪 + 随机强度
 *   Weather.start('random')                // 同 Weather.random()
 *   Weather.start('rain', 'random')        // 随机雨强度
 *   Weather.randomType()                   // 随机返回 'rain' | 'snow'
 *   Weather.randomLevel('snow')            // 随机返回某类型的一个强度 key
 *
 *   Weather.setLevel('heavy')              // 动态切换强度（无需重开）
 *   Weather.stop()                         // 停止并移除覆盖层
 *
 *   // 自定义参数（可选）：
 *   Weather.start('rain', 'moderate', {
 *     zIndex: 50,                          // 覆盖层层级（默认 9999）
 *     opacity: 0.9,                        // 整体透明度
 *     color: '150,190,255',                // 粒子颜色（RGB）
 *     container: document.getElementById('stage') // 限定在某容器内
 *   })
 *
 *   // 查询：
 *   Weather.isActive()          // 是否在运行
 *   Weather.getType()          // 'rain' | 'snow' | null
 *   Weather.getLevel()         // 当前强度 key
 *   Weather.levelLabel(key)    // 中文强度名（如 '雷暴雨'）
 */
;(function (window) {
  'use strict'

  // ============================================================
  // 强度参数表
  // count   : 粒子数 = 屏幕像素面积(百万) × count（小雨少、雷暴/暴雪多）
  // speed   : 下落速度（每秒穿过屏幕高度的比例）
  // wind    : 水平风速（每秒穿过屏幕高度的比例）
  // len     : 雨丝长度（屏幕高度的比例，仅雨）
  // size    : 雨丝线宽 / 雪花基础半径
  // sway    : 雪花左右摇摆幅度（仅雪）
  // ============================================================
  // thunder : 雷强度系数（0=无雷；>0 越大雷越强）—— 除小雨外所有雨档都有雷
  //   小雨 drizzle = 0 无雷；中雨 light = 小雷 → 雷暴雨 thunderstorm = 特大雷
  var RAIN_LEVELS = {
    drizzle:      { count: 60,  speed: 0.72, wind: 0.05, len: 0.016, size: 1.0, thunder: 0    }, // 小雨（无雷）
    light:        { count: 130, speed: 0.85, wind: 0.12, len: 0.020, size: 1.2, thunder: 0.35 }, // 中雨（小雷）
    moderate:     { count: 240, speed: 0.95, wind: 0.20, len: 0.024, size: 1.4, thunder: 0.60 }, // 大雨（中雷）
    heavy:        { count: 380, speed: 1.05, wind: 0.28, len: 0.028, size: 1.6, thunder: 0.85 }, // 暴雨（大雷）
    thunderstorm: { count: 520, speed: 1.20, wind: 0.36, len: 0.034, size: 1.8, thunder: 1.0  }  // 雷暴雨（特大雷）
  }

  var SNOW_LEVELS = {
    light:    { count: 30,  speed: 0.20, wind: 0.08, size: 1.1, sway: 0.5 }, // 小雪
    moderate: { count: 75,  speed: 0.26, wind: 0.14, size: 1.7, sway: 0.8 }, // 中雪
    heavy:    { count: 150, speed: 0.34, wind: 0.24, size: 2.4, sway: 1.2 }, // 大雪
    blizzard: { count: 300, speed: 0.55, wind: 0.50, size: 3.4, sway: 1.6 }  // 暴风雪
  }

  var RAIN_LABELS = {
    drizzle: '小雨', light: '中雨', moderate: '大雨',
    heavy: '暴雨', thunderstorm: '雷暴雨'
  }
  var SNOW_LABELS = {
    light: '小雪', moderate: '中雪', heavy: '大雪', blizzard: '暴风雪'
  }

  var DEFAULT_COLORS = { rain: '255,255,255', snow: '255,255,255' }

  var state = {
    running: false,
    type: null,
    level: 'moderate',
    canvas: null,
    ctx: null,
    container: null,
    opts: {},
    w: 0,
    h: 0,
    dpr: 1,
    particles: [],
    rafId: 0,
    lastTime: 0,
    flash: 0,       // 雷暴闪光强度（0~1）
    bolt: null,     // 闪电枝
    boltCooldown: 0 // 下次闪电倒计时（帧）
  }

  // ---------- 工具函数 ----------
  function rand (a, b) { return a + Math.random() * (b - a) }
  function randInt (a, b) { return Math.floor(rand(a, b + 1)) }

  // ---------- 粒子生成（自上而下：出生点统一在屏幕顶部，逐渐落向底部） ----------
  function makeRainParticle () {
    var w = state.w, h = state.h, lv = RAIN_LEVELS[state.level]
    return {
      x: rand(-w * 0.15, w * 1.15),
      // 出生在顶部：从画布上沿之上到接近顶部的位置
      y: rand(-h * 0.2, h * 0.05),
      len: lv.len * h,
      speed: lv.speed * h,
      wind: lv.wind * h,
      size: lv.size,
      // 白色半透明雨丝
      opacity: rand(0.25, 0.5)
    }
  }

  function makeSnowParticle () {
    var w = state.w, h = state.h, lv = SNOW_LEVELS[state.level]
    return {
      x: rand(-w * 0.15, w * 1.15),
      // 出生在顶部：从画布上沿之上到接近顶部的位置
      y: rand(-h * 0.2, h * 0.05),
      r: rand(0.4, lv.size),
      speed: lv.speed * h * rand(0.8, 1.25),
      wind: lv.wind * h * rand(0.8, 1.2),
      sway: lv.sway * rand(0.6, 1.2),
      swayPhase: rand(0, Math.PI * 2),
      swaySpeed: rand(0.012, 0.035),
      // 白色微微透的雪花
      opacity: rand(0.6, 0.88)
    }
  }

  // ---------- 重建粒子（改强度 / 改窗口大小时） ----------
  function rebuildParticles () {
    var area = (state.w * state.h) / 1e6
    var base = state.type === 'rain' ? RAIN_LEVELS[state.level] : SNOW_LEVELS[state.level]
    var total = Math.round(area * base.count)
    // 移动端（小屏）自动降级：粒子上限减半，保证触摸交互流畅
    var mobileScale = state.w <= 480 ? 0.5 : 1
    if (state.type === 'rain') {
      total = Math.max(30, Math.min(2200 * mobileScale, total * mobileScale))
    } else {
      total = Math.max(18, Math.min(1400 * mobileScale, total * mobileScale))
    }
    state.particles = []
    for (var i = 0; i < total; i++) {
      state.particles.push(state.type === 'rain' ? makeRainParticle() : makeSnowParticle())
    }
  }

  // ---------- 尺寸计算 ----------
  function measure () {
    var el = state.container
    var w, h
    if (el === document.body || el === document.documentElement) {
      w = window.innerWidth
      h = window.innerHeight
    } else if (el) {
      var rect = el.getBoundingClientRect()
      w = rect.width
      h = rect.height
    } else {
      w = window.innerWidth
      h = window.innerHeight
    }
    state.w = w
    state.h = h
  }

  function resizeCanvas () {
    measure()
    // 移动端 DPR 上限 1.5：天气粒子是低频透明元素，1.5 足够清晰且更流畅
    var cap = state.w <= 480 ? 1.5 : 2
    state.dpr = Math.min(window.devicePixelRatio || 1, cap)
    var c = state.canvas
    c.width = Math.round(state.w * state.dpr)
    c.height = Math.round(state.h * state.dpr)
    c.style.width = state.w + 'px'
    c.style.height = state.h + 'px'
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0)
    rebuildParticles()
  }

  var _resizeTimer = null
  function onResize () {
    if (!state.running) return
    // 防抖：移动端旋转/地址栏伸缩时不频繁重建粒子
    clearTimeout(_resizeTimer)
    _resizeTimer = setTimeout(resizeCanvas, 200)
  }

  // ---------- 闪电（强度随当前雨档的 thunder 系数缩放：雨越大雷越大） ----------
  // 返回当前雷强度系数 0~1（小雨=0 无雷）
  function currentThunder () {
    if (state.type !== 'rain') return 0
    var lv = RAIN_LEVELS[state.level]
    return (lv && lv.thunder) || 0
  }

  function makeBolt () {
    var w = state.w, h = state.h
    var t = currentThunder() || 0.5 // 生成时兜底（无雷档不会调用）
    var x0 = rand(w * 0.15, w * 0.85)
    var yEnd = rand(h * 0.12, h * 0.5)
    var segs = randInt(7, 10 + Math.round(4 * t))
    var points = [{ x: x0, y: 0 }]
    for (var i = 1; i <= segs; i++) {
      points.push({
        x: x0 + rand(-w * 0.06, w * 0.06) * (i / segs),
        y: (yEnd * i) / segs + rand(-h * 0.025, h * 0.025)
      })
    }
    // 分支闪电：雨越大分支越多越长
    var branch = []
    var bi = randInt(2, Math.max(2, segs - 3))
    var bp = points[bi]
    var bend = randInt(2, 2 + Math.round(4 * t))
    var bx = bp.x, by = bp.y
    for (var j = 0; j < bend; j++) {
      bx += rand(-w * 0.04, w * 0.04)
      by += rand(h * 0.01, h * 0.05)
      branch.push({ x: bx, y: by })
    }
    // 生命时长也随雷增大而变长（更醒目）
    var life = Math.round(randInt(14, 24) * (0.7 + 0.6 * t))
    return { points: points, branch: branch, branchFrom: bi, life: life, thunder: t }
  }

  function drawBolt (ctx) {
    var b = state.bolt
    if (!b) return
    var pts = b.points
    var fade = Math.min(1, b.life / 10)
    // 雷的大小随 thunder 系数缩放（0.35 小雷 → 1.0 特大雷）
    var t = b.thunder || 0.5
    var w1 = Math.max(1.5, 8 * t)      // 外层光晕线宽
    var w2 = Math.max(1, 4 * t)        // 中亮层线宽
    var w3 = Math.max(0.8, 2.2 * t)    // 内层亮芯线宽
    var o1 = (0.55 * t * fade).toFixed(3)   // 光晕亮度
    var o2 = (0.8 * Math.min(1, t + 0.2) * fade).toFixed(3)
    var o3 = (1 * Math.min(1, t + 0.3) * fade).toFixed(3)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    // 外层光晕
    ctx.strokeStyle = 'rgba(150,185,255,' + o1 + ')'
    ctx.lineWidth = w1
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
    // 中亮层
    ctx.strokeStyle = 'rgba(200,220,255,' + o2 + ')'
    ctx.lineWidth = w2
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
    // 内层亮芯（纯白）
    ctx.strokeStyle = 'rgba(255,255,255,' + o3 + ')'
    ctx.lineWidth = w3
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    ctx.stroke()
    // 分支闪电（雨越大越亮越粗）
    if (b.branch && b.branch.length) {
      ctx.strokeStyle = 'rgba(220,235,255,' + (0.7 * Math.min(1, t + 0.3) * fade).toFixed(3) + ')'
      ctx.lineWidth = Math.max(1, 2.5 * t)
      ctx.beginPath()
      ctx.moveTo(pts[b.branchFrom].x, pts[b.branchFrom].y)
      ctx.lineTo(b.branch[0].x, b.branch[0].y)
      ctx.stroke()
      ctx.lineWidth = Math.max(0.8, 1.6 * t)
      ctx.beginPath()
      ctx.moveTo(b.branch[0].x, b.branch[0].y)
      for (var k = 1; k < b.branch.length; k++) ctx.lineTo(b.branch[k].x, b.branch[k].y)
      ctx.stroke()
    }
  }

  // ---------- 更新 / 绘制 ----------
  function updateRain (dt) {
    var w = state.w, h = state.h
    var ps = state.particles
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i]
      p.y += p.speed * dt
      p.x += p.wind * dt
      if (p.y - p.len > h) {
        p.x = rand(-w * 0.15, w * 1.15)
        p.y = -p.len - rand(0, h * 0.2)
        p.speed = RAIN_LEVELS[state.level].speed * h * rand(0.85, 1.15)
      }
    }
  }

  function drawRain (ctx) {
    var color = state.opts.color || DEFAULT_COLORS.rain
    var ps = state.particles
    var sl = state.opts.opacity
    ctx.lineCap = 'round'
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i]
      var a = (sl * p.opacity).toFixed(3)
      ctx.strokeStyle = 'rgba(' + color + ',' + a + ')'
      ctx.lineWidth = p.size
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.wind * 0.35, p.y - p.len)
      ctx.stroke()
    }
  }

  function updateSnow (dt) {
    var w = state.w, h = state.h
    var ps = state.particles
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i]
      p.swayPhase += p.swaySpeed * dt
      p.x += (p.wind + Math.sin(p.swayPhase) * p.sway * 2.2) * dt
      p.y += p.speed * dt
      if (p.y > h + 12) {
        p.x = rand(-w * 0.15, w * 1.15)
        p.y = -12 - rand(0, h * 0.1)
      }
    }
  }

  function drawSnow (ctx) {
    var color = state.opts.color || DEFAULT_COLORS.snow
    var ps = state.particles
    var sl = state.opts.opacity
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i]
      var a = (sl * p.opacity).toFixed(3)
      ctx.fillStyle = 'rgba(' + color + ',' + a + ')'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 氛围叠加：雨天随雷强度轻微暗沉、暴风雪白雾（均为浅色，不遮挡白色雨/雪）
  function drawAtmosphere (ctx) {
    var t = currentThunder()
    if (state.type === 'rain' && t > 0) {
      // 雨越大暗沉氛围越明显（让雷更突出）
      ctx.fillStyle = 'rgba(10,16,32,' + (0.03 + 0.05 * t).toFixed(3) + ')'
      ctx.fillRect(0, 0, state.w, state.h)
    } else if (state.type === 'snow' && state.level === 'blizzard') {
      ctx.fillStyle = 'rgba(210,218,230,0.07)'
      ctx.fillRect(0, 0, state.w, state.h)
    }
  }

  function updateLightning (dt) {
    // 除小雨外，所有雨档都可能有雷（雷随雨量递增）
    var t = currentThunder()
    if (state.type !== 'rain' || t <= 0) return
    if (state.boltCooldown > 0) {
      state.boltCooldown -= dt
    } else if (Math.random() < (0.008 + 0.012 * t) * dt) {
      // 雨越大闪电越频繁
      state.bolt = makeBolt()
      state.flash = 1
      state.boltCooldown = randInt(90, 400 - Math.round(240 * t))
    }
    if (state.flash > 0) {
      // 闪光强度随雷增大
      state.ctx.fillStyle = 'rgba(255,255,255,' + (state.flash * (0.12 + 0.2 * t)).toFixed(3) + ')'
      state.ctx.fillRect(0, 0, state.w, state.h)
      state.flash *= Math.pow(0.72, dt)
      if (state.flash < 0.02) state.flash = 0
    }
    if (state.bolt) {
      drawBolt(state.ctx)
      state.bolt.life -= dt
      if (state.bolt.life <= 0) state.bolt = null
    }
  }

  function tick (now) {
    state.rafId = window.requestAnimationFrame(tick)
    var dt = Math.min((now - state.lastTime) / 16.67, 3)
    state.lastTime = now
    var ctx = state.ctx
    ctx.clearRect(0, 0, state.w, state.h)

    drawAtmosphere(ctx)

    if (state.type === 'rain') {
      updateRain(dt)
      drawRain(ctx)
      updateLightning(dt)
    } else {
      updateSnow(dt)
      drawSnow(ctx)
    }
  }

  // ---------- 对外 API ----------
  var Weather = {
    RAIN_LEVELS: Object.keys(RAIN_LEVELS),
    SNOW_LEVELS: Object.keys(SNOW_LEVELS),

    isActive: function () { return state.running },

    getType: function () { return state.running ? state.type : null },

    getLevel: function () { return state.level },

    getCanvas: function () { return state.canvas },

    levelLabel: function (key) {
      return (RAIN_LABELS[key] || SNOW_LABELS[key] || key)
    },

    start: function (type, level, opts) {
      // 支持随机：Weather.start('random') / Weather.start('rain', 'random')
      if (type === 'random') {
        type = this.randomType()
        if (!level || level === 'random') level = this.randomLevel(type)
      }
      if (level === 'random') {
        level = this.randomLevel(type)
      }
      if (type !== 'rain' && type !== 'snow') return false
      this.stop()

      level = level || (type === 'rain' ? 'moderate' : 'moderate')
      if (type === 'rain' && !RAIN_LEVELS[level]) level = 'moderate'
      if (type === 'snow' && !SNOW_LEVELS[level]) level = 'moderate'

      state.type = type
      state.level = level
      state.opts = Object.assign({}, {
        zIndex: 9999,
        opacity: 1,
        color: null,
        container: null
      }, opts || {})

      state.container = state.opts.container || document.body

      var c = document.createElement('canvas')
      c.setAttribute('data-weather', type === 'rain' ? 'rain' : 'snow')
      c.style.position = (state.container === document.body || state.container === document.documentElement)
        ? 'fixed' : 'absolute'
      c.style.top = '0'
      c.style.left = '0'
      c.style.pointerEvents = 'none'
      c.style.zIndex = String(state.opts.zIndex)
      state.container.appendChild(c)
      state.canvas = c
      state.ctx = c.getContext('2d')

      resizeCanvas()

      state.running = true
      state.lastTime = performance.now()
      state.rafId = window.requestAnimationFrame(tick)

      var _this = this
      if (!this._boundResize) {
        this._boundResize = function () { onResize() }
        window.addEventListener('resize', this._boundResize)
      }
      return true
    },

    // 快捷方法：Weather.rain('heavy') / Weather.snow('blizzard')
    rain: function (level, opts) { return this.start('rain', level, opts) },
    snow: function (level, opts) { return this.start('snow', level, opts) },

    // 随机相关：Weather.random() / Weather.randomType() / Weather.randomLevel(type)
    randomType: function () {
      return Math.random() < 0.5 ? 'rain' : 'snow'
    },

    randomLevel: function (type) {
      var keys = type === 'rain' ? this.RAIN_LEVELS : this.SNOW_LEVELS
      return keys[Math.floor(Math.random() * keys.length)]
    },

    random: function (opts) {
      var type = this.randomType()
      return this.start(type, this.randomLevel(type), opts)
    },

    // 动态切换强度（保持当前天气）
    setLevel: function (level) {
      if (!state.running) return false
      var table = state.type === 'rain' ? RAIN_LEVELS : SNOW_LEVELS
      if (!table[level]) return false
      state.level = level
      rebuildParticles()
      return true
    },

    stop: function () {
      if (state.rafId) window.cancelAnimationFrame(state.rafId)
      if (state.canvas && state.canvas.parentNode) {
        state.canvas.parentNode.removeChild(state.canvas)
      }
      if (this._boundResize) {
        window.removeEventListener('resize', this._boundResize)
        this._boundResize = null
      }
      state.running = false
      state.type = null
      state.canvas = null
      state.ctx = null
      state.particles = []
      state.flash = 0
      state.bolt = null
    }
  }

  window.Weather = Weather
})(window)
