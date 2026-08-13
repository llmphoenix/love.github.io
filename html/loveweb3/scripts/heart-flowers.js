/* ============================================================
 * 心形花朵 —— 镭射闪耀 · 顺时针流动 · 上下跳跃
 * ---------------------------------------------
 * 在画布上沿心形曲线撒满花朵：
 *   - 镭射（iridescent）：每朵花色相随时间循环流动，花瓣之间彩虹渐变，
 *     配合 'lighter' 叠加合成，花瓣重叠处自然增亮，呈现流光溢彩的镭射感
 *   - 顺时针运动：花朵沿心形曲线顺时针缓慢绕行 + 自身顺时针自转
 *   - 上下跳跃：每朵花按各自相位做正弦上下微跳（bob）
 *   - buling buling：花蕊白亮高光 + 随机星芒闪光 + 底部镭射光晕
 * 跨平台：画布尺寸由 CSS 控制（min(46vmin,460px) / 移动端 72vw），
 *         本脚本按实际像素渲染，兼容任意尺寸。
 * ============================================================ */
;(function () {
  var canvas = document.getElementById('heartCanvas')
  if (!canvas || !canvas.getContext) return
  var ctx = canvas.getContext('2d')

  var W = 0, H = 0, DPR = 1
  var flowers = []
  var time = 0
  var last = 0
  var started = false

  // 心形曲线参考宽度（参数方程 x ∈ [-16,16]）
  var BASE_HALF = 16
  var COUNT = 48

  // 经典心形参数方程（t: 0 ~ 2π，t 增大即沿心形顺时针方向）
  function heartXY (t) {
    var s = Math.sin(t)
    var x = 16 * s * s * s
    var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    return { x: x, y: y }
  }

  function resize () {
    var rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      // 布局尚未就绪，稍后重试
      setTimeout(resize, 60)
      return
    }
    W = rect.width
    H = rect.height
    DPR = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * DPR)
    canvas.height = Math.round(H * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    init()
  }

  function init () {
    flowers = []
    var scale = Math.min(W, H) / (BASE_HALF * 2 + 4) // 心形宽 32 单位 + 外边距
    var count = Math.max(26, Math.round(COUNT * (W / 420)))
    for (var i = 0; i < count; i++) {
      flowers.push({
        t0: (i / count) * Math.PI * 2,            // 沿心形均匀分布的起始角度
        orbit: 0.08 + Math.random() * 0.14,       // 轨道顺时针速度（rad/s）
        rot: 0.5 + Math.random() * 1.0,           // 自转速度（顺时针，rad/s）
        size: 3.5 + Math.random() * 4.5,          // 花朵半径
        petals: 5 + (Math.random() * 4 | 0),      // 花瓣数 5~8
        hue: (Math.random() * 360) | 0,           // 基准色相（镭射流光起点）
        hueSpeed: 18 + Math.random() * 30,        // 色相流动速度
        bobPhase: Math.random() * Math.PI * 2,    // 跳跃相位
        bobSpeed: 0.9 + Math.random() * 1.3,      // 跳跃频率
        bobAmp: 2 + Math.random() * 4,            // 跳跃幅度（px）
        twinkle: Math.random() * Math.PI * 2      // 闪光相位
      })
    }
  }

  function drawFlower (f, x, y, sec) {
    var size = f.size
    var petals = f.petals
    var per = Math.PI * 2 / petals
    var hueBase = (f.hue + sec * f.hueSpeed) % 360

    // 底部镭射光晕（不随自转旋转）
    ctx.save()
    ctx.translate(x, y)
    var gh = (f.hue + sec * 30) % 360
    var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 3.4)
    glow.addColorStop(0, 'hsla(' + gh + ',100%,72%,0.28)')
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
    for (var i = 0; i < petals; i++) {
      var hue = (hueBase + i * (360 / petals)) % 360 // 彩虹渐变花瓣
      ctx.save()
      ctx.rotate(i * per)
      ctx.fillStyle = 'hsla(' + hue + ',100%,66%,0.62)'
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
    ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + tw * 0.4) + ')'
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2)
    ctx.fill()
    // 星芒闪光（偶尔闪现四芒星）
    if (tw > 0.7) {
      var a = (tw - 0.7) / 0.3
      ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.9) + ')'
      ctx.lineWidth = 1.2
      var len = size * (1.2 + tw * 1.2)
      ctx.beginPath()
      ctx.moveTo(-len, 0); ctx.lineTo(len, 0)
      ctx.moveTo(0, -len); ctx.lineTo(0, len)
      ctx.stroke()
    }
    ctx.restore()
  }

  function loop (ts) {
    var dt = Math.min((ts - last) / 1000, 0.05)
    last = ts
    time += dt

    ctx.clearRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'lighter' // 叠加增亮 → 镭射晶莹

    var scale = Math.min(W, H) / (BASE_HALF * 2 + 4)
    var cx = W / 2
    var cy = H / 2 + scale * 1.5 // 心形视觉居中（下尖稍长）

    for (var i = 0; i < flowers.length; i++) {
      var f = flowers[i]
      var t = f.t0 + time * f.orbit          // 顺时针沿心形绕行
      var p = heartXY(t)
      var x = cx + p.x * scale
      var y = cy - p.y * scale + Math.sin(time * f.bobSpeed + f.bobPhase) * f.bobAmp // 上下跳跃
      drawFlower(f, x, y, ts / 1000)
    }

    ctx.globalCompositeOperation = 'source-over'
    window.requestAnimationFrame(loop)
  }

  function start (ts) {
    if (started) return
    started = true
    last = ts
    window.requestAnimationFrame(loop)
  }

  resize()
  window.addEventListener('resize', resize)
  window.requestAnimationFrame(start)
})()
