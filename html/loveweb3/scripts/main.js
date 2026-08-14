;(function (window) {
  window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame || window.msRequestAnimationFrame

  const FRAME_RATE = 60
  const RADIUS = Math.PI * 2
  const CANVASID = 'canvas'

  let texts = ['甄玥', 'I Love You', '愿你与我相伴', '幸福快乐', '儿孙满堂', '君为我', '我自当为你', '执子之手，矢志不渝']

  let canvas,
    ctx,
    particles = [],
    quiver = true,
    text = texts[0],
    textIndex = 0,
    CANVASWIDTH = 1000,
    CANVASHEIGHT = 150,
    PARTICLE_NUM = 2000,
    textSize = 70

  let textWidth = 0

  function setCanvasSize() {
    var screenWidth = window.innerWidth;
    var isPortraitMobile = screenWidth <= 480;
    // 逻辑画布宽 = 视口可用宽（CSS 里画布按 100% 宽显示，逻辑与显示 1:1，不会左右裁剪）
    CANVASWIDTH = Math.min(Math.max(screenWidth, 300), 1000);
    // 高度比例：竖屏 0.22 / 其他 0.18，让文字饱满
    CANVASHEIGHT = Math.min(Math.max(CANVASWIDTH * (isPortraitMobile ? 0.22 : 0.18), 60), 150);
    // 粒子数：按最长文字所需取样点自适应（保证所有文字粒子完整、横屏清晰）
    PARTICLE_NUM = particleNeed(CANVASWIDTH, CANVASHEIGHT);
    textSize = Math.floor(CANVASHEIGHT * 0.55);

    if (canvas) {
      canvas.width = CANVASWIDTH;
      canvas.height = CANVASHEIGHT;
    }
    textWidth = 0 // 强制重算文字宽度
  }

  // 按最长文字在画布上的取样点估算所需粒子数（step 按 320 基准，保持采样疏密适中）
  function particleNeed (W, H) {
    var step = Math.max(2, Math.round(W / 320))
    // 画布可采样总格数（步长网格）
    var totalCells = Math.floor(W / step) * Math.floor(H / step)
    // 最长文字“执子之手，矢志不渝”约占满整行，字形笔画覆盖率约 55%~62%
    // 取中间值 0.58 并留 15% 余量，保证粒子充足不稀疏
    return Math.min(Math.floor(totalCells * 0.58 * 1.15), 6000)
  }

  function textFont (size) {
    return size + 'px \'SimHei\', \'Avenir\', \'Helvetica Neue\', \'Arial\', \'sans-serif\''
  }

  // 自动缩放字号：把当前文字缩到画布宽度 96% 以内，避免手机竖屏窄画布截断
  function fitTextToCanvas () {
    var size = textSize
    var maxWidth = CANVASWIDTH * 0.96
    ctx.font = textFont(size)
    var w = ctx.measureText(text).width
    while (w > maxWidth && size > 16) {
      size -= 1
      ctx.font = textFont(size)
      w = ctx.measureText(text).width
    }
    textSize = size
    textWidth = w
  }

  function draw () {
    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    ctx.fillStyle = 'rgb(255, 255, 255)'
    ctx.textBaseline = 'middle'
    ctx.fontWeight = 'bold'
    // 文字宽度缓存：文本不变时避免每帧 measureText（移动端省电）
    if (textWidth === 0) {
      // 首次绘制 / 文字或画布变化时：自动缩放字号，确保长文字完整落在画布内（手机竖屏不截断）
      fitTextToCanvas()
    }
    ctx.font = textFont(textSize)
    ctx.fillText(text, (CANVASWIDTH - textWidth) * 0.5, CANVASHEIGHT * 0.5)

    let imgData = ctx.getImageData(0, 0, CANVASWIDTH, CANVASHEIGHT)

    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)

    for (let i = 0, l = particles.length; i < l; i++) {
      let p = particles[i]
      p.inText = false
    }
    particleText(imgData)

    window.requestAnimationFrame(draw)
  }

  function particleText (imgData) {
    var pxls = []
    // 采样步长更疏（320 基准）：横屏画布大时不再密集到粒子数不足，文字更完整清晰
    var step = Math.max(2, Math.round(CANVASWIDTH / 320))
    for (var w = CANVASWIDTH; w > 0; w -= step) {
      for (var h = 0; h < CANVASHEIGHT; h += step) {
        var index = (w + h * (CANVASWIDTH)) * 4
        if (imgData.data[index] > 1) {
          pxls.push([w, h])
        }
      }
    }

    var count = pxls.length
    var j = parseInt((particles.length - pxls.length) / 2, 10)
    j = j < 0 ? 0 : j

    for (var i = 0; i < pxls.length && j < particles.length; i++, j++) {
      try {
        var p = particles[j],
          X,
          Y

        if (quiver) {
          X = (pxls[i - 1][0]) - (p.px + Math.random() * 10)
          Y = (pxls[i - 1][1]) - (p.py + Math.random() * 10)
        } else {
          X = (pxls[i - 1][0]) - p.px
          Y = (pxls[i - 1][1]) - p.py
        }
        var T = Math.sqrt(X * X + Y * Y)
        var A = Math.atan2(Y, X)
        var C = Math.cos(A)
        var S = Math.sin(A)
        p.x = p.px + C * T * p.delta
        p.y = p.py + S * T * p.delta
        p.px = p.x
        p.py = p.y
        p.inText = true
        p.fadeIn()
        p.draw(ctx)
      } catch (e) {}
    }
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i]
      if (!p.inText) {
        p.fadeOut()

        var X = p.mx - p.px
        var Y = p.my - p.py
        var T = Math.sqrt(X * X + Y * Y)
        var A = Math.atan2(Y, X)
        var C = Math.cos(A)
        var S = Math.sin(A)

        p.x = p.px + C * T * p.delta / 2
        p.y = p.py + S * T * p.delta / 2
        p.px = p.x
        p.py = p.y

        p.draw(ctx)
      }
    }
  }

  function setDimensions () {
    setCanvasSize()
    canvas.style.position = 'absolute'
    canvas.style.left = '50%'
    canvas.style.top = '30%'
    canvas.style.transform = 'translate(-50%, -50%)'
  }

  function event () {
    // 统一用 pointerup 处理点击切换文字（桌面鼠标 + 移动触摸只触发一次）
    // 兼容不支持 PointerEvent 的老设备：回退到 click/touchstart 二选一
    var lastSwitch = 0
    function isButtonTarget(e) {
      var t = e.target
      if (!t || !t.closest) return false
      return t.closest('.back-btn') || t.closest('.music-control') || t.closest('#heartCanvas')
    }
    function switchText() {
      var now = Date.now()
      // 防抖：同一瞬间的 click+touchstart 视为一次
      if (now - lastSwitch < 400) return
      lastSwitch = now
      textIndex++
      if (textIndex >= texts.length) {
        textIndex = 0
      }
      text = texts[textIndex]
      textWidth = 0 // 文字改变 → 重算宽度
    }

    if (window.PointerEvent) {
      document.addEventListener('pointerup', function (e) {
        if (isButtonTarget(e)) return
        switchText()
      }, false)
    } else {
      document.addEventListener('touchend', function (e) {
        if (isButtonTarget(e)) return
        switchText()
      }, false)
      document.addEventListener('click', function (e) {
        if (isButtonTarget(e)) return
        switchText()
      }, false)
    }

    // 窗口大小变化时重新调整
    var resizeTimer
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(function () {
        setCanvasSize()
        // 重新初始化粒子
        particles = []
        for (var i = 0; i < PARTICLE_NUM; i++) {
          particles[i] = new Particle(canvas)
        }
      }, 300)
    })
  }

  function init () {
    canvas = document.getElementById(CANVASID)
    if (canvas === null || !canvas.getContext) {
      return
    }
    ctx = canvas.getContext('2d', { willReadFrequently: true })
    setDimensions()
    event()

    for (var i = 0; i < PARTICLE_NUM; i++) {
      particles[i] = new Particle(canvas)
    }

    draw()
  }

  class Particle {
    constructor (canvas) {
      let spread = canvas.height
      let size = Math.random() * 1.2
      this.delta = 0.1  // 粒子向目标移动速度（0.06 → 0.1，切换文字时流动更明显）
      this.x = 0
      this.y = 0
      this.px = Math.random() * canvas.width
      this.py = (canvas.height * 0.5) + ((Math.random() - 0.5) * spread)
      this.mx = this.px
      this.my = this.py
      this.size = size
      this.inText = false
      this.opacity = 0
      this.fadeInRate = 0.012  // 淡入更快（0.005 → 0.012），切换后文字快速显现
      this.fadeOutRate = 0.03
      this.opacityTresh = 0.98
      this.fadingOut = true
      this.fadingIn = true
    }
    fadeIn () {
      this.fadingIn = this.opacity > this.opacityTresh ? false : true
      if (this.fadingIn) {
        this.opacity += this.fadeInRate
      }else {
        this.opacity = 1
      }
    }
    fadeOut () {
      this.fadingOut = this.opacity < 0 ? false : true
      if (this.fadingOut) {
        this.opacity -= this.fadeOutRate
        if (this.opacity < 0) {
          this.opacity = 0
        }
      }else {
        this.opacity = 0
      }
    }
    draw (ctx) {
      ctx.fillStyle = 'rgba(226,225,142, ' + this.opacity + ')'
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.size, 0, RADIUS, true)
      ctx.closePath()
      ctx.fill()
    }
  }

  init()
})(window)
