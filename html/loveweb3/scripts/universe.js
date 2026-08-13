window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

var starDensity = .216;
var speedCoeff = .05;
var width;
var height;
var starCount;
var circleRadius;
var circleCenter;
var first = true;
var giantColor = '180,184,240';
var starColor = '226,225,142';
var cometColor = '226,225,224';
var canva = document.getElementById('universe');
var stars = [];
var universe;

// ============================================================
// 浪漫流星雨 —— 随机出现；520 时刻触发大量流星雨
// ============================================================
var loveMeteors = [];       // 活跃流星
var loveMeteorCd = 0;       // 生成冷却（帧）

/**
 * 是否处于 520 时刻（触发大量流星雨）：
 *  - 5 月 20 号当天（无论几点，整天都是浪漫日）
 *  - 或每天 5:20（上午 05:20）与 17:20（下午 05:20）
 */
function is520Moment() {
  var now = new Date();
  // 5 月 20 日（getMonth() 从 0 开始，5 月 = 4）
  var isMay20 = now.getMonth() === 4 && now.getDate() === 20;
  if (isMay20) return isOnTheHour(now);
  // 5 点 20 分：上午 05:20 或 下午 17:20
  var h = now.getHours();
  return (h === 5 || h === 17) && now.getMinutes() === 20;
}

/** 是否整点（非 520 时概率稍高） */
function isOnTheHour(now) {
  now = now || new Date();
  return now.getMinutes() === 0 && now.getSeconds() <= 5;
}

/** 浪漫色板：粉 / 金 / 紫罗兰 / 冰蓝 / 玫瑰红 */
var METEOR_HUES = [325, 45, 270, 205, 340];

/** 生成一颗浪漫流星 */
function spawnMeteor() {
  var x, y, angle;
  if (Math.random() < 0.6) {
    // 从顶部划过，斜向左下
    x = getRandInterval(0, width);
    y = getRandInterval(-30, height * 0.3);
    angle = getRandInterval(Math.PI * 0.75, Math.PI * 0.98);
  } else {
    // 从左上方划向右下
    x = getRandInterval(-40, width * 0.5);
    y = getRandInterval(-20, height * 0.35);
    angle = getRandInterval(Math.PI * 0.55, Math.PI * 0.85);
  }
  var speed = getRandInterval(7, 14); // px/帧（浪漫的慢速划过）
  loveMeteors.push({
    x: x,
    y: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len: getRandInterval(90, 180),   // 拖尾长度
    hue: METEOR_HUES[Math.floor(Math.random() * METEOR_HUES.length)],
    life: getRandInterval(80, 170),  // 存活帧数
    age: 0,
    size: getRandInterval(1.4, 2.6)  // 头部半径
  });
}

/** 绘制一颗浪漫流星（渐变拖尾 + 发光头部） */
function drawMeteor(m) {
  var headX = m.x, headY = m.y;
  var tailX = m.x - m.vx * m.len * 0.6;
  var tailY = m.y - m.vy * m.len * 0.6;

  // 拖尾：从头部亮色渐变到透明
  var grad = universe.createLinearGradient(headX, headY, tailX, tailY);
  grad.addColorStop(0, 'hsla(' + m.hue + ',100%,88%,0.95)');
  grad.addColorStop(0.4, 'hsla(' + m.hue + ',100%,72%,0.45)');
  grad.addColorStop(1, 'hsla(' + m.hue + ',100%,60%,0)');
  universe.strokeStyle = grad;
  universe.lineWidth = m.size;
  universe.lineCap = 'round';
  universe.beginPath();
  universe.moveTo(headX, headY);
  universe.lineTo(tailX, tailY);
  universe.stroke();

  // 头部光晕（buling 星芒感）
  var glow = universe.createRadialGradient(headX, headY, 0, headX, headY, m.size * 5);
  glow.addColorStop(0, 'hsla(' + m.hue + ',100%,92%,0.85)');
  glow.addColorStop(1, 'hsla(' + m.hue + ',100%,70%,0)');
  universe.fillStyle = glow;
  universe.beginPath();
  universe.arc(headX, headY, m.size * 5, 0, Math.PI * 2);
  universe.fill();
}

/** 每帧更新流星：移动 + 按概率生成新流星 */
function updateMeteors() {
  for (var i = 0; i < loveMeteors.length; i++) {
    var m = loveMeteors[i];
    m.x += m.vx;
    m.y += m.vy;
    m.age++;
  }

  loveMeteorCd--;
  if (loveMeteorCd <= 0) {
    var boost = is520Moment();    // 520 时刻 → 大量流星雨
    var hourBoost = isOnTheHour(); // 整点 → 概率稍高
    // 520：0.5/帧（密集倾泻）；整点：0.12/帧；平时：0.02/帧（偶尔闪现）
    var prob = boost ? 0.5 : (hourBoost ? 0.12 : 0.02);
    if (Math.random() < prob) {
      spawnMeteor();
      if (boost) loveMeteorCd = Math.floor(getRandInterval(5, 22));
      else if (hourBoost) loveMeteorCd = Math.floor(getRandInterval(15, 50));
      else loveMeteorCd = Math.floor(getRandInterval(40, 130));  
    } else {
      loveMeteorCd = 1;
    }
  }
}

windowResizeHandler();
window.addEventListener('resize', windowResizeHandler, false);

createUniverse();

function createUniverse() {
  universe = canva.getContext('2d');

  for (var i = 0; i < starCount; i++) {
    stars[i] = new Star();
    stars[i].reset();
  }

  draw();
}

function draw() {
  universe.clearRect(0, 0, width, height);

  var starsLength = stars.length;

  for (var i = 0; i < starsLength; i++) {
    var star = stars[i];
    star.move();
    star.fadeIn();
    star.fadeOut();
    star.draw();
  }

  // ==== 浪漫流星雨 ====
  updateMeteors();
  for (var m = 0; m < loveMeteors.length; m++) {
    drawMeteor(loveMeteors[m]);
  }
  // 移除已消失的流星
  for (var k = loveMeteors.length - 1; k >= 0; k--) {
    if (loveMeteors[k].age >= loveMeteors[k].life) loveMeteors.splice(k, 1);
  }

  window.requestAnimationFrame(draw);
}

function Star() {

  this.reset = function() {
    this.giant = getProbability(3);
    this.comet = this.giant || first ? false : getProbability(10);
    this.x = getRandInterval(0, width - 10);
    this.y = getRandInterval(0, height);
    this.r = getRandInterval(1.1, 2.6);
    this.dx = getRandInterval(speedCoeff, 6 * speedCoeff) + (this.comet + 1 - 1) * speedCoeff * getRandInterval(50, 120) + speedCoeff * 2;
    this.dy = -getRandInterval(speedCoeff, 6 * speedCoeff) - (this.comet + 1 - 1) * speedCoeff * getRandInterval(50, 120);
    this.fadingOut = null;
    this.fadingIn = true;
    this.opacity = 0;
    this.opacityTresh = getRandInterval(.2, 1 - (this.comet + 1 - 1) * .4);
    this.do = getRandInterval(0.0005, 0.002) + (this.comet + 1 - 1) * .001;
  };

  this.fadeIn = function() {
    if (this.fadingIn) {
      this.fadingIn = this.opacity > this.opacityTresh ? false : true;
      this.opacity += this.do;
    }
  };

  this.fadeOut = function() {
    if (this.fadingOut) {
      this.fadingOut = this.opacity < 0 ? false : true;
      this.opacity -= this.do / 2;
      if (this.x > width || this.y < 0) {
        this.fadingOut = false;
        this.reset();
      }
    }
  };

  this.draw = function() {
    universe.beginPath();

    if (this.giant) {
      universe.fillStyle = 'rgba(' + giantColor + ',' + this.opacity + ')';
      universe.arc(this.x, this.y, 2, 0, 2 * Math.PI, false);
    } else if (this.comet) {
      universe.fillStyle = 'rgba(' + cometColor + ',' + this.opacity + ')';
      universe.arc(this.x, this.y, 1.5, 0, 2 * Math.PI, false);

      //comet tail
      for (var i = 0; i < 30; i++) {
        universe.fillStyle = 'rgba(' + cometColor + ',' + (this.opacity - (this.opacity / 20) * i) + ')';
        universe.rect(this.x - this.dx / 4 * i, this.y - this.dy / 4 * i - 2, 2, 2);
        universe.fill();
      }
    } else {
      universe.fillStyle = 'rgba(' + starColor + ',' + this.opacity + ')';
      universe.rect(this.x, this.y, this.r, this.r);
    }

    universe.closePath();
    universe.fill();
  };

  this.move = function() {
    this.x += this.dx;
    this.y += this.dy;
    if (this.fadingOut === false) {
      this.reset();
    }
    if (this.x > width - (width / 4) || this.y < 0) {
      this.fadingOut = true;
    }
  };

  (function() {
    setTimeout(function() {
      first = false;
    }, 50)
  })()
}

function getProbability(percents) {
  return ((Math.floor(Math.random() * 1000) + 1) < percents * 10);
}

function getRandInterval(min, max) {
  return (Math.random() * (max - min) + min);
}

function windowResizeHandler() {
  width = window.innerWidth;
  height = window.innerHeight;
  starCount = width * starDensity;
  // console.log(starCount)
  circleRadius = (width > height ? height / 2 : width / 2);
  circleCenter = {
    x: width / 2,
    y: height / 2
  }

  canva.setAttribute('width', width);
  canva.setAttribute('height', height);
}