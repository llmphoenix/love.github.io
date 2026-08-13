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

  function setCanvasSize() {
    var screenWidth = window.innerWidth;
    CANVASWIDTH = Math.min(Math.max(screenWidth * 0.9, 300), 1000);
    CANVASHEIGHT = Math.min(CANVASWIDTH * 0.18, 150);
    PARTICLE_NUM = Math.floor(CANVASWIDTH * CANVASHEIGHT / 75);
    textSize = Math.floor(CANVASHEIGHT * 0.55);

    if (canvas) {
      canvas.width = CANVASWIDTH;
      canvas.height = CANVASHEIGHT;
    }
  }

  function draw () {
    ctx.clearRect(0, 0, CANVASWIDTH, CANVASHEIGHT)
    ctx.fillStyle = 'rgb(255, 255, 255)'
    ctx.textBaseline = 'middle'
    ctx.fontWeight = 'bold'
    ctx.font = textSize + 'px \'SimHei\', \'Avenir\', \'Helvetica Neue\', \'Arial\', \'sans-serif\''
    ctx.fillText(text, (CANVASWIDTH - ctx.measureText(text).width) * 0.5, CANVASHEIGHT * 0.5)

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
    var step = Math.max(2, Math.floor(CANVASWIDTH / 300))
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
    document.addEventListener('click', function (e) {
      // 排除按钮点击
      if (e.target.closest('.back-btn') || e.target.closest('.music-control')) {
        return
      }
      textIndex++
      if (textIndex >= texts.length) {
        textIndex = 0
      }
      text = texts[textIndex]
    }, false)

    document.addEventListener('touchstart', function (e) {
      if (e.target.closest('.back-btn') || e.target.closest('.music-control')) {
        return
      }
      textIndex++
      if (textIndex >= texts.length) {
        textIndex = 0
      }
      text = texts[textIndex]
    }, false)

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
    ctx = canvas.getContext('2d')
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
      this.delta = 0.06
      this.x = 0
      this.y = 0
      this.px = Math.random() * canvas.width
      this.py = (canvas.height * 0.5) + ((Math.random() - 0.5) * spread)
      this.mx = this.px
      this.my = this.py
      this.size = size
      this.inText = false
      this.opacity = 0
      this.fadeInRate = 0.005
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
