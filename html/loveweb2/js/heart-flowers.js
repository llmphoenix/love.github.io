/* ============================================================
 * 双心形花朵 —— 镭射闪耀 · 顺时针流动 · 上下跳跃 · 生长绘制
 * ---------------------------------------------
 * 在画布上绘制两个左右相连的心形，左小右大：
 *   - 镭射（iridescent）：每朵花色相随时间循环流动，花瓣之间彩虹渐变，
 *     配合 'lighter' 叠加合成，花瓣重叠处自然增亮，呈现流光溢彩的镭射感
 *   - 顺时针运动：花朵沿各自心形曲线顺时针缓慢绕行 + 自身顺时针自转
 *   - 上下跳跃：每朵花按各自相位做正弦上下微跳（bob）
 *   - 生长绘制：花朵从心尖开始沿曲线逐渐出现（像花园心形一样慢慢长出来），
 *     页面加载立即开始，无延迟
 *   - buling buling：花蕊白亮高光 + 随机星芒闪光 + 底部镭射光晕
 * 跨平台：canvas 尺寸由 CSS 控制（铺满 #loveHeart，跟随其断点缩放），
 *         本脚本按实际像素渲染，兼容任意尺寸。
 * ============================================================ */
;(function () {
  // 脚本在 <head> 中加载，需等待 DOM 解析完成后再初始化
  function boot () {
    var canvas = document.getElementById('heartCanvas')
    if (!canvas || !canvas.getContext) return
    main(canvas)
  }

  function main (canvas) {
    var ctx = canvas.getContext('2d')

  var W = 0, H = 0, DPR = 1
  var flowers = []
  var time = 0
  var last = 0
  var started = false
  var fallbackId = null   // 后台时 setInterval 回退驱动
  var rafId = null        // rAF 句柄
  var usingRaf = false    // 当前是否由 rAF 驱动

  // 心形曲线参考宽度（参数方程 x ∈ [-16,16]）
  var BASE_HALF = 16
  var COUNT_BIG = 42     // 大心形花朵数
  var COUNT_SMALL = 30   // 小心形花朵数

  // 生长动画时长（秒）：从第一个点到铺满整条心形的时间
  var GROW_DURATION = 4

  // 经典心形参数方程（t: 0 ~ 2π，t 增大即沿心形顺时针方向）
  // 返回归一化坐标（x ∈ [-16, 16]，y ∈ [-17, 15] 量级）
  function heartXY (t) {
    var s = Math.sin(t)
    var x = 16 * s * s * s
    var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return { x: x, y: y }
  }

  // 两个心形的配置（左小右大，左右相连）
  function getHearts () {
    // 大心形：居中偏右，作为主心
    // 小心形：大心形的 0.52 倍，位于左侧与之相连
    var big = { scale: 1, cx: 0.0, cy: 0.0 }
    // 小心形中心：让小心形右缘与大心形左缘相连
    // 大心形左缘 x = -16*S，小心形右缘 = cx2 + 16*S*0.52
    // 相连：cx2 + 16*S*0.52 = -16*S  →  cx2 = -16*S*(1+0.52)
    var small = { scale: 0.52, cx: -(16 * (1 + 0.52)), cy: 0.0 }
    return { big: big, small: small }
  }

  // 心形几何尺寸（未缩放时 x∈[-16,16], y∈[-17,15]，总宽 32、总高 32）
  var SHAPE_W = 32   // 心形总宽（参数单位）
  var SHAPE_H = 32   // 心形总高（参数单位）

  // 计算所有花朵：分布在两个心形上，记录各自中心、缩放、起始角
  function init () {
    flowers = []
    var hearts = getHearts()
    // 移动端花朵数量减半：双心形花朵密集，小屏上视觉无差但更流畅
    var mobileScale = (W <= 480) ? 0.5 : 1
    var shapes = [
      { h: hearts.big, count: Math.round(COUNT_BIG * mobileScale), delay: 0 },        // 大心形先长
      { h: hearts.small, count: Math.round(COUNT_SMALL * mobileScale), delay: 0.8 }   // 小心形稍后
    ]

    for (var s = 0; s < shapes.length; s++) {
      var shape = shapes[s]
      var h = shape.h
      for (var i = 0; i < shape.count; i++) {
        flowers.push({
          // 心形参数
          shapeIndex: s,
          cx: h.cx,
          cy: h.cy,
          scale: h.scale,
          t0: (i / shape.count) * Math.PI * 2,     // 沿心形均匀分布的起始角度
          growDelay: shape.delay + (i / shape.count) * GROW_DURATION, // 出生时间（相对生长起点）
          // 动画
          orbit: 0.05 + Math.random() * 0.09,       // 轨道顺时针速度（rad/s）
          rot: 0.5 + Math.random() * 1.0,           // 自转速度（顺时针，rad/s）
          size: (3.5 + Math.random() * 4.5) * h.scale, // 花朵半径（随心形缩放）
          petals: 5 + (Math.random() * 4 | 0),      // 花瓣数 5~8
          hue: (Math.random() * 360) | 0,           // 基准色相（镭射流光起点）
          hueSpeed: 18 + Math.random() * 30,        // 色相流动速度
          bobPhase: Math.random() * Math.PI * 2,    // 跳跃相位
          bobSpeed: 0.9 + Math.random() * 1.3,      // 跳跃频率
          bobAmp: (2 + Math.random() * 4) * h.scale,// 跳跃幅度（随心形缩放）
          twinkle: Math.random() * Math.PI * 2      // 闪光相位
        })
      }
    }
  }

  // 绘制一朵花（appear: 0~1，生长出现时的淡入缩放）
  function drawFlower (f, x, y, sec, appear) {
    var size = f.size
    var petals = f.petals
    var per = Math.PI * 2 / petals
    var hueBase = (f.hue + sec * f.hueSpeed) % 360

    // 生长淡入：尺寸从 0 到 1 放大，透明度渐显
    if (appear < 0) return
    if (appear > 1) appear = 1
    var s = Math.max(0.01, appear)
    var alpha = appear

    // 底部镭射光晕（不随自转旋转）
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(s, s)
    var gh = (f.hue + sec * 30) % 360
    var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.4)
    glow.addColorStop(0, 'hsla(' + gh + ',100%,72%,' + (0.28 * alpha) + ')')
    glow.addColorStop(1, 'hsla(' + gh + ',100%,72%,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, 0, size * 3.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 花朵本体（自转 + 花瓣）
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(sec * f.rot) // 顺时针自转
    ctx.scale(s, s)
    for (var i = 0; i < petals; i++) {
      var hue = (hueBase + i * (360 / petals)) % 360 // 彩虹渐变花瓣
      ctx.save()
      ctx.rotate(i * per)
      ctx.fillStyle = 'hsla(' + hue + ',100%,66%,' + (0.62 * alpha) + ')'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(size * 0.85, -size * 1.15, 0, -size * 2.0)
      ctx.quadraticCurveTo(-size * 0.85, -size * 1.15, 0, 0)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    // 花蕊双层高光（buling buling 的核心）
    var tw = 0.5 + 0.5 * Math.sin(sec * 3.5 + f.twinkle)
    ctx.fillStyle = 'rgba(255,255,255,' + ((0.35 + tw * 0.4) * alpha) + ')'
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2)
    ctx.fill()
    // 星芒闪光（偶尔闪现四芒星）
    if (tw > 0.7) {
      var a = (tw - 0.7) / 0.3
      ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.9 * alpha) + ')'
      ctx.lineWidth = 1.2
      var len = size * (1.2 + tw * 1.2)
      ctx.beginPath()
      ctx.moveTo(-len, 0); ctx.lineTo(len, 0)
      ctx.moveTo(0, -len); ctx.lineTo(0, len)
      ctx.stroke()
    }
    ctx.restore()
  }

  // 动画主循环
  function tick (ts) {
    if (ts === undefined) {
      // setInterval 回退：模拟 rAF 时间戳
      ts = performance.now()
    }
    var dt = Math.min((ts - last) / 1000, 0.05)
    last = ts
    time += dt

    ctx.clearRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter'

    // 整体缩放：让两个心形都容纳进画布
    var hearts = getHearts()
    // 两个心形组合宽度：小心形左缘 x = cx2 - 16*0.52，大心形右缘 x = 16
    var comboLeft = hearts.small.cx - 16 * hearts.small.scale   // 小心形左缘
    var comboRight = 16                                          // 大心形右缘
    var comboWidth = comboRight - comboLeft
    // 心形高度约 32 单位
    var scale = Math.min(W / (comboWidth + 8), H / (SHAPE_H + 6))
    var comboCenterX = (comboLeft + comboRight) / 2
    var cx = W / 2 - comboCenterX * scale   // 组合整体水平居中
    var cy = H / 2 + scale * 1.2            // 心形视觉居中（下尖稍长）

    // 生长进度：每朵花按 growDelay 依次出现（不延迟，页面加载即开始）
    for (var i = 0; i < flowers.length; i++) {
      var f = flowers[i]
      // 生长出现：growDelay 之前不显示，之后 0.6 秒淡入
      var appear = (time - f.growDelay) / 0.6
      if (appear <= 0) continue
      var t = f.t0 + time * f.orbit          // 顺时针沿心形绕行
      var p = heartXY(t)
      // 组合坐标：小心形中心在 cx*scale 处，大心形在 0
      var hx = f.cx + p.x * f.scale
      var hy = f.cy - p.y * f.scale
      var x = cx + hx * scale
      var y = cy + hy * scale + Math.sin(time * f.bobSpeed + f.bobPhase) * f.bobAmp
      drawFlower(f, x, y, ts / 1000, appear)
    }

    ctx.globalCompositeOperation = 'source-over'
    scheduleNext()
  }

  function scheduleNext () {
    if (usingRaf) {
      rafId = window.requestAnimationFrame(tick)
    }
  }

  function ensureLoop () {
    if (started) return
    started = true
    // 尝试用 rAF（页面可见时平滑高效）
    usingRaf = true
    rafId = window.requestAnimationFrame(tick)
    // setInterval 兜底：若 rAF 被暂停（页面后台/隐藏），由它接管推进
    fallbackId = setInterval(function () {
      if (!usingRaf) {
        tick(performance.now())
      }
    }, 1000 / 30)
    // 检测 rAF 是否真的在跑：若页面后台 rAF 被暂停，切到 setInterval
    setInterval(function () {
      if (document.hidden && usingRaf) {
        usingRaf = false // 页面后台：rAF 会暂停，切到 setInterval
        if (rafId !== null) { window.cancelAnimationFrame(rafId); rafId = null }
      }
    }, 300)
  }

  // 页面回到前台时，恢复 rAF 驱动
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && started && !usingRaf) {
      usingRaf = true
      rafId = window.requestAnimationFrame(tick)
    }
  })

  function resize () {
    var rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      // 布局尚未就绪，稍后重试
      setTimeout(resize, 60)
      return
    }
    W = rect.width
    H = rect.height
    // 移动端 DPR 上限 1.5：双 canvas 页面（garden + heartCanvas）更流畅
    var cap = W <= 480 ? 1.5 : 2
    DPR = Math.min(window.devicePixelRatio || 1, cap)
    canvas.width = Math.round(W * DPR)
    canvas.height = Math.round(H * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    init()
  }

  resize()
  var _resizeTimer = null
  window.addEventListener('resize', function () {
    // 防抖：移动端旋转/地址栏伸缩时不频繁重建花朵
    clearTimeout(_resizeTimer)
    _resizeTimer = setTimeout(resize, 200)
  })
  ensureLoop()
  }

  // 等待 DOM 解析完成（脚本位于 <head>，此时 #heartCanvas 尚不存在）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }
})()
