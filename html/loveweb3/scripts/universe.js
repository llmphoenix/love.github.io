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

// ============================================================
// 星空下的情侣 —— 淡入 → 靠近对视 → 拥抱接吻 → 转向观众 → 淡出
// 男生：书生气质（戴眼镜 · 短发）
// 女生：俏皮可爱（长头发 · 胸部丰满 · 蝴蝶结）
// 背景：桃花树 + 萤火虫 + 星空
// ============================================================
var couple = { t: 0, cycle: 15 };   // 周期计时（秒）

// ============================================================
// 星空下的情侣 —— 写实风格 · 桃花树下 · 萤火与星空
// 男生：高女生一个头 · 戴眼镜（明显） · 书生气质
// 女生：长头发 · 大胸大屁股 · 裙子 · 俏皮可爱
// 流程：淡入对视 → 慢慢靠近 → 拥抱停顿1s → 接吻5s → 淡出 → 停顿1s → 循环
// ============================================================
var couple = { t: 0, cycle: 15.2 };   // 周期计时（秒）

// 情侣动画时间轴（秒）
var CP_IDLE = 1.0;        // 出现前空闲（停顿 1s）
var CP_FADE_IN = 1.2;     // 淡入
var CP_APPROACH = 3.5;    // 慢慢靠近（对视）
var CP_HUG = 1.0;         // 拥抱停顿
var CP_KISS = 5.0;        // 接吻（5s）
var CP_FADE_OUT = 2.0;    // 淡出
var CP_START_APPROACH = CP_IDLE + CP_FADE_IN;
var CP_START_HUG = CP_START_APPROACH + CP_APPROACH;
var CP_START_KISS = CP_START_HUG + CP_HUG;
var CP_START_FADE_OUT = CP_START_KISS + CP_KISS;
var CP_END = CP_START_FADE_OUT + CP_FADE_OUT;

// 萤火虫（只在桃花树周围零散几个）
var fireflies = [];
var FIREFLY_COUNT = 6;

function initFireflies() {
  fireflies = [];
  for (var i = 0; i < FIREFLY_COUNT; i++) {
    // 只分布在桃花树区域（左右两侧树冠附近）
    var leftSide = i < FIREFLY_COUNT / 2;
    fireflies.push({
      x: leftSide ? 0.06 + Math.random() * 0.22 : 0.72 + Math.random() * 0.22,
      y: 0.55 + Math.random() * 0.35,
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.00006,
      size: 0.7 + Math.random() * 1.2,
      color: '255,225,160'
    });
  }
}
initFireflies();

// 桃花树（相对坐标）—— 男女起始位置左右两边，种在弧形地面上
var peachTrees = [
  { x: 0.30, baseY: 0.90, h: 0.42, s: 1.0 },   // 男生左侧
  { x: 0.70, baseY: 0.90, h: 0.42, s: 1.0 }    // 女生右侧
];

// 飘落桃花瓣（相对坐标，少量）
var petals = [];
var PETAL_COUNT = 14;

function initPetals() {
  petals = [];
  for (var i = 0; i < PETAL_COUNT; i++) {
    petals.push({
      x: Math.random(),
      y: Math.random() * 0.4,
      speed: 0.008 + Math.random() * 0.015,
      sway: (Math.random() - 0.5) * 0.003,
      phase: Math.random() * Math.PI * 2,
      size: 2.0 + Math.random() * 2.5
    });
  }
}
initPetals();

function easeInOut(k) {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

function updateCouple(dt) {
  couple.t += dt;
  if (couple.t >= couple.cycle) couple.t = 0;
  // 更新萤火虫
  for (var i = 0; i < fireflies.length; i++) {
    var f = fireflies[i];
    f.phase += dt * f.speed;
    f.x += f.drift;
    if (f.x < 0) f.x += 1;
    if (f.x > 1) f.x -= 1;
  }
  // 更新飘落花瓣
  for (var j = 0; j < petals.length; j++) {
    var p = petals[j];
    p.y += p.speed * dt;
    p.x += p.sway * dt + Math.sin(couple.t + p.phase) * 0.0015;
    if (p.y > 1) { p.y = -0.02; p.x = Math.random(); }
    if (p.x < 0) p.x += 1;
    if (p.x > 1) p.x -= 1;
  }
}

/** 计算情侣当前帧动画参数 */
function coupleParams() {
  var t = couple.t;
  var p = { opacity: 0, dist: 1.35, hug: 0, kiss: 0, lean: 0, tiptoe: 0 };
  if (t < CP_IDLE) return p;
  if (t < CP_START_APPROACH) {            // 淡入（面对面侧视）
    p.opacity = easeInOut((t - CP_IDLE) / CP_FADE_IN);
    p.dist = 1.35;
    return p;
  }
  if (t < CP_START_HUG) {                 // 慢慢靠近 · 面对面互望
    var k = easeInOut((t - CP_START_APPROACH) / CP_APPROACH);
    p.opacity = 1;
    p.dist = 1.35 + (0.34 - 1.35) * k;
    p.lean = k;
    return p;
  }
  if (t < CP_START_KISS) {                // 拥抱停顿 1s
    p.opacity = 1;
    p.dist = 0.34;
    p.hug = 1;
    p.lean = 1;
    return p;
  }
  if (t < CP_START_FADE_OUT) {            // 接吻 5s
    var k = easeInOut(Math.min(1, (t - CP_START_KISS) / 0.8));
    p.opacity = 1;
    p.dist = 0.30;
    p.hug = 1;
    p.kiss = k;
    p.lean = 1;
    p.tiptoe = k;
    return p;
  }
  if (t < CP_END) {                       // 淡出（保持拥抱）
    p.opacity = 1 - easeInOut((t - CP_START_FADE_OUT) / CP_FADE_OUT);
    p.dist = 0.30;
    p.hug = 1;
    p.kiss = 1;
    p.lean = 1;
    p.tiptoe = 1;
    return p;
  }
  return p;                               // 停顿 1s 后循环
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 画一颗小爱心 */
function drawHeartShape(ctx, x, y, s, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 画一棵桃花树 */
function drawPeachTree(tx, baseY, h, s, op) {
  var x = tx * width;
  var y = baseY * height;
  var scale = s * Math.min(width, height) * 0.13; // 树足够大
  var trunkW = h * 0.055 * scale;
  var treeH = h * scale;

  ctx_save_all();
  universe.globalAlpha = op * 0.95;
  // 树干
  universe.strokeStyle = 'rgba(96,62,46,' + (op * 0.9) + ')';
  universe.lineWidth = trunkW;
  universe.lineCap = 'round';
  universe.beginPath();
  universe.moveTo(x, y);
  universe.quadraticCurveTo(x + trunkW * 0.4, y - treeH * 0.45, x + trunkW * 0.1, y - treeH);
  universe.stroke();
  // 主枝
  universe.lineWidth = trunkW * 0.55;
  universe.beginPath();
  universe.moveTo(x, y - treeH * 0.55);
  universe.quadraticCurveTo(x - treeH * 0.28, y - treeH * 0.75, x - treeH * 0.32, y - treeH);
  universe.stroke();
  universe.beginPath();
  universe.moveTo(x, y - treeH * 0.55);
  universe.quadraticCurveTo(x + treeH * 0.28, y - treeH * 0.75, x + treeH * 0.32, y - treeH);
  universe.stroke();
  // 桃花花簇（紧凑伞状树冠）
  var blossoms = [
    [0, -1.02], [0.18, -0.95], [-0.18, -0.95],
    [0.34, -0.86], [-0.34, -0.86], [0.46, -0.75],
    [-0.46, -0.75], [0.10, -0.78], [-0.10, -0.78],
    [0.26, -0.70], [-0.26, -0.70], [0.0, -0.88]
  ];
  for (var i = 0; i < blossoms.length; i++) {
    var bx = x + blossoms[i][0] * treeH;
    var by = y + blossoms[i][1] * treeH; // blossom[1] 为负 → 向上（树冠在树干上方）
    var r = treeH * 0.20;
    var grad = universe.createRadialGradient(bx, by, 0, bx, by, r);
    grad.addColorStop(0, 'rgba(255,196,220,0.95)');
    grad.addColorStop(0.5, 'rgba(255,165,200,0.85)');
    grad.addColorStop(1, 'rgba(255,140,182,0)');
    universe.fillStyle = grad;
    universe.beginPath();
    universe.arc(bx, by, r, 0, Math.PI * 2);
    universe.fill();
  }
  // 花蕊白点
  universe.fillStyle = 'rgba(255,244,228,' + (op * 0.95) + ')';
  for (var j = 0; j < blossoms.length; j += 2) {
    universe.beginPath();
    universe.arc(x + blossoms[j][0] * treeH, y + blossoms[j][1] * treeH, treeH * 0.035, 0, Math.PI * 2);
    universe.fill();
  }
  ctx_restore_all();
}

/** 画萤火虫（暖黄光点，明暗呼吸闪烁） */
function drawFireflies(op) {
  var t = couple.t;
  for (var i = 0; i < fireflies.length; i++) {
    var f = fireflies[i];
    var blink = 0.35 + 0.65 * Math.abs(Math.sin(f.phase));
    var fx = f.x * width;
    var fy = f.y * height;
    ctx_save_all();
    universe.globalAlpha = op * blink * 0.8;
    var grad = universe.createRadialGradient(fx, fy, 0, fx, fy, f.size * 4.5);
    grad.addColorStop(0, 'rgba(' + f.color + ',1)');
    grad.addColorStop(1, 'rgba(' + f.color + ',0)');
    universe.fillStyle = grad;
    universe.beginPath();
    universe.arc(fx, fy, f.size * 4.5, 0, Math.PI * 2);
    universe.fill();
    universe.fillStyle = 'rgba(255,255,220,' + (op * blink) + ')';
    universe.beginPath();
    universe.arc(fx, fy, f.size * 0.6, 0, Math.PI * 2);
    universe.fill();
    ctx_restore_all();
  }
}

/** 画飘落桃花瓣 */
function drawPetals(op) {
  ctx_save_all();
  universe.globalAlpha = op * 0.7;
  universe.fillStyle = 'rgba(255,170,200,0.8)';
  for (var i = 0; i < petals.length; i++) {
    var p = petals[i];
    var px = p.x * width;
    var py = p.y * height;
    var ang = Math.sin(couple.t * 2 + p.phase) * 0.6;
    universe.save();
    universe.translate(px, py);
    universe.rotate(ang);
    universe.beginPath();
    universe.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
    universe.fill();
    universe.restore();
  }
  ctx_restore_all();
}

function ctx_save_all() { universe.save(); }
function ctx_restore_all() { universe.restore(); }

/** 画情侣主画面（弧形地面 + 桃花树环绕） */
function drawCouple(p) {
  var s = Math.min(width, height) * 0.085;
  var bh = s * 1.26;   // 男生：高
  var gh = s * 1.10;   // 女生：穿高跟鞋，比男生矮一点
  var cx = width * 0.5;
  var cy = height * 0.90;   // 站立在地平线上
  var sep = p.dist * s * 0.92;
  var op = p.opacity;
  var pairCx = cx;

  var bx = pairCx - sep * 0.5, by = cy;                         // 男生（左）
  var gx = pairCx + sep * 0.5, gy = cy - p.tiptoe * 0.05 * gh;  // 女生（右，接吻时踮脚）

  drawBoy(universe, bx, by, bh, p, op);
  drawGirl(universe, gx, gy, gh, p, op);

  // 接吻时头顶飘出小心心
  if (p.kiss > 0) {
    var ht = couple.t;
    for (var i = 0; i < 2; i++) {
      var phase = (ht * 0.9 + i * 0.5) % 1;
      var hyy = cy - bh * 1.05 - phase * s * 0.85;
      var hxx = pairCx + Math.sin((ht + i * 2) * 1.3) * s * 0.18;
      var ha = p.opacity * (1 - phase) * 0.75;
      drawHeartShape(universe, hxx, hyy, s * (0.09 + phase * 0.09), 'rgba(230,150,190,1)', ha);
    }
  }
}

/** 画萤火虫（在情侣之上，星星点点） */
function drawFirefliesOverlay() {
  drawFireflies(1);
  drawPetals(1);
}

// ============================================================
// SVG 剪影（完全照用用户提供的 SVG path 数据）
// 男孩（原路径）面朝右；女孩（镜像）面朝左 → 两人面对面
// ============================================================
var SVG_BOY_D1 = 'M800.7324,167.6929c0,0-7.9688-6.5039-9.7197-8.041c-1.751-1.5366-7.9331-6.5039-8.7197-13.0435c-0.7861-6.5396,6.0752-15.188,17.7969-16.1885c11.7207-1.0005,12.9727,1.0366,14.1514,2.7163c1.1787,1.6792,5.7178,11.1494,5.0752,18.6538c-0.6445,7.5049-5.6826,10.1133-9.7559,13.3652C805.4863,168.4072,800.7324,167.6929,800.7324,167.6929z';
var SVG_BOY_D2 = 'M810.7031,169.2109c-1.0723-1.3037-1.3574-2.9556-1.1426-4.0645c0.2139-1.1084-8.041,0.1128-8.8281,2.542c1.6445,1.6787,0.751,3.146-0.5,4.1108c-1.25,0.9648-1.6797,1.502-1.9297,1.8237c0.0361,0.5361,0,0.9653,0,0.9653s-1.4297,1.7153-2.2871,6.5396s-0.6787,6.79-0.9648,8.3267c-0.2852,1.5366-1.4648,5.9678-1.751,10.292s0,4.5742,0,4.5742s1.251,1.7153,1.1436,4.0742s-1.2705,5.6099-1.2705,5.6099s0.2344,1.8945,1.8779,2.252c1.6445,0.3574,2.3594-0.6436,2.3594-0.6436s1.0713,1.3223,1.75,4.0742c0.6797,2.752,0.6436,6.79,1.8945,7.9688c1.251,1.1797,1.6074,0.3223,1.6074,0.3223s0.4648,3.3975-0.9277,6.6855c-1.3945,3.2881-4.1465,6.7568-4.1465,6.7568h11.0781c0,0,1.5723-3.5234-7.1113-2.2363c3.252-4.0742,3.8955-6.1934,4.0391-11.125c1.8223,0.5,4.252,0.6738,4.9316-0.3271c0.5352,1.3223,2.4297,2.1787,3.3584,1.7139c-0.2139,3.7168-1.0713,12.1846-1.0713,12.1846l9.0049,0.2852c0,0-0.751-3.2168-6.29-1.4307c1.001-6.7891,1.3584-11.5068,1.3584-11.5068s1.3584,0.1074,1.8584-0.3926c0.5-0.501,0.6787-5.3252-0.4648-9.9346c-1.1436-4.6104-0.5-4.4678-0.5-4.4678s1.75-0.8213,1.5-2.8584s-0.8574-3.6807-1.5352-5.5391c0.4639-0.1074,1-0.7861-0.6797-2.7158c-0.2148-2.5015-0.9648-6.3242-0.6436-7.6465s0.2148-2.8232-0.1787-4.3599c0-2.4302,0.7148-13.1509-1.25-17.0103c-1.9658-3.8594-2.5371-3.5737-2.5371-3.5737S812.5977,169.0142,810.7031,169.2109z';

// SVG 边界框（男孩）：x 782.2~821.8，y 130.2~241.9（宽39.6 高111.8），脚底在 y≈241.9
var SVG_BBOX = { x: 782.23, y: 130.15, w: 39.59, h: 111.77 };
var SVG_CX = SVG_BBOX.x + SVG_BBOX.w / 2; // ≈ 802
var SVG_FOOT = SVG_BBOX.y + SVG_BBOX.h;   // ≈ 241.9

var _boyPath = null, _girlPath = null;
function getBoyPath() {
  if (!_boyPath) {
    try { _boyPath = new Path2D(SVG_BOY_D1 + ' ' + SVG_BOY_D2); }
    catch (e) { _boyPath = null; }
  }
  return _boyPath;
}
function getGirlPath() {
  // 女孩 = 同一路径镜像（面朝左，与男孩面对面）
  if (!_girlPath) {
    try { _girlPath = new Path2D(SVG_BOY_D1 + ' ' + SVG_BOY_D2); }
    catch (e) { _girlPath = null; }
  }
  return _girlPath;
}

/** 男生：SVG 剪影（面朝右）+ 侧视眼镜（半个倾斜镜片 + 镜腿向后） */
function drawBoy(ctx, x, y, h, p, op) {
  var path = getBoyPath();
  if (!path) return;
  var scale = h / SVG_BBOX.h;
  ctx.save();
  ctx.globalAlpha = op;
  ctx.translate(x, y);          // 脚底中心
  ctx.scale(scale, scale);
  ctx.rotate(p.lean * 0.05);    // 靠近/接吻微微低头
  ctx.translate(-SVG_CX, -SVG_FOOT); // 路径底部（脚）对齐原点
  ctx.fillStyle = 'rgba(104,122,142,1)';
  ctx.fill(path);
  // ==== 侧视圆形眼镜：圆镜片（头前方/右侧）+ 镜腿向脑后 ====
  // 男生面朝右 → 镜片在头前方（x 大侧 = 右侧），镜腿向脑后（左）
  var ghy = 149;     // 头部中心 y
  var gx = 806.5;    // 镜片中心 x（头前方偏右）
  var gr = 6.5;      // 圆镜片半径（侧视，接近圆的扁椭圆）
  ctx.save();
  // 圆镜框（深色圆环）
  ctx.strokeStyle = 'rgba(30,28,34,0.85)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(gx, ghy, gr * 0.85, gr, -0.25, 0, Math.PI * 2);
  ctx.stroke();
  // 镜片反光（淡蓝，柔和可见）
  ctx.fillStyle = 'rgba(205,225,245,0.4)';
  ctx.beginPath();
  ctx.ellipse(gx, ghy, gr * 0.85, gr, -0.25, 0, Math.PI * 2);
  ctx.fill();
  // 镜腿：从镜片后缘（左侧）向后伸向耳朵/脑后
  ctx.strokeStyle = 'rgba(30,28,34,0.8)';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(gx - gr * 0.7, ghy + gr * 0.5);
  ctx.lineTo(gx - gr * 0.7 - 6, ghy + gr * 0.6);
  ctx.lineTo(gx - gr * 0.7 - 9, ghy + gr * 0.45);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** 女生：完整的人（头/腿/脚）· 高跟鞋 · 连衣裙 · 黑长直发 · 侧面体征（面朝左） */
function drawGirl(ctx, x, y, h, p, op) {
  var scale = h / SVG_BBOX.h;
  ctx.save();
  ctx.globalAlpha = op;
  ctx.translate(x, y);          // 脚底中心
  ctx.scale(scale, scale);      // 正面（画朝左的女生）
  ctx.rotate(-p.kiss * 0.04 + p.lean * 0.02);
  ctx.translate(-SVG_CX, -SVG_FOOT);
  // SVG 坐标系：脚底 y=242，头中心 y≈150
  // 面朝左：脸/胸在 x 小侧，长发/背在 x 大侧

  // ==== 腿（小腿） + 高跟鞋 ====
  // 左腿（后）
  ctx.fillStyle = 'rgba(226,196,166,1)';
  ctx.beginPath();
  ctx.moveTo(794, 236);
  ctx.lineTo(800, 236);
  ctx.lineTo(800, 243);
  ctx.lineTo(794, 243);
  ctx.closePath();
  ctx.fill();
  // 右腿（前）
  ctx.fillStyle = 'rgba(232,204,176,1)';
  ctx.beginPath();
  ctx.moveTo(784, 238);
  ctx.lineTo(792, 238);
  ctx.lineTo(791, 245);
  ctx.lineTo(784, 245);
  ctx.closePath();
  ctx.fill();
  // 高跟鞋（红色尖头，右腿明显）
  ctx.fillStyle = 'rgba(168,64,88,1)';
  ctx.beginPath();
  ctx.moveTo(784, 245);
  ctx.quadraticCurveTo(780, 245, 779, 244);   // 尖头朝左（面朝左）
  ctx.lineTo(783, 240);
  ctx.lineTo(788, 240);
  ctx.lineTo(787, 245);
  ctx.closePath();
  ctx.fill();
  // 高跟鞋跟
  ctx.fillStyle = 'rgba(140,50,72,1)';
  ctx.fillRect(786, 245, 2.5, 3);
  // 左鞋（后腿，简化为平底露一点）
  ctx.fillStyle = 'rgba(160,60,84,1)';
  ctx.beginPath();
  ctx.moveTo(794, 243);
  ctx.quadraticCurveTo(791, 243, 790, 242);
  ctx.lineTo(793, 240);
  ctx.lineTo(798, 240);
  ctx.lineTo(798, 243);
  ctx.closePath();
  ctx.fill();

  // ==== 黑长直发（笔直垂背，无闪烁） ====
  ctx.fillStyle = 'rgba(38,28,42,1)';
  ctx.beginPath();
  ctx.moveTo(806, 148);
  ctx.lineTo(828, 156);
  ctx.lineTo(832, 200);
  ctx.lineTo(828, 230);         // 背后长发垂到腰
  ctx.lineTo(816, 234);
  ctx.lineTo(819, 195);
  ctx.lineTo(812, 168);
  ctx.closePath();
  ctx.fill();

  // ==== 头（有脸！） ====
  // 脸（肤色圆，偏左 = 面朝左）
  ctx.fillStyle = 'rgba(232,200,168,1)';
  ctx.beginPath();
  ctx.arc(799, 151, 12.5, 0, Math.PI * 2);
  ctx.fill();
  // 黑发覆盖头顶（露出侧脸）
  ctx.fillStyle = 'rgba(40,30,44,1)';
  ctx.beginPath();
  ctx.arc(801, 149, 13, Math.PI * 0.75, Math.PI * 2.25);
  ctx.closePath();
  ctx.fill();
  // 刘海（前额，面朝左 → 左侧垂发）
  ctx.beginPath();
  ctx.moveTo(787, 150);
  ctx.quadraticCurveTo(791, 142, 799, 141);
  ctx.quadraticCurveTo(805, 141, 808, 145);
  ctx.quadraticCurveTo(801, 145, 795, 149);
  ctx.quadraticCurveTo(790, 152, 787, 150);
  ctx.closePath();
  ctx.fill();
  // 侧脸（下颚）露肤 + 小鼻子（面朝左）
  ctx.fillStyle = 'rgba(232,200,168,1)';
  ctx.beginPath();
  ctx.arc(794, 150, 8, Math.PI * 0.2, Math.PI * 1.5);
  ctx.closePath();
  ctx.fill();

  // ==== 脖子（头与身体的连接） ====
  ctx.fillStyle = 'rgba(228,196,164,1)';
  ctx.beginPath();
  ctx.moveTo(795, 158);
  ctx.lineTo(802, 156);
  ctx.lineTo(803, 174);
  ctx.lineTo(796, 176);
  ctx.closePath();
  ctx.fill();

  // ==== 连衣裙（柔粉，完整覆盖身体，比例协调） ====
  ctx.fillStyle = 'rgba(178,130,152,1)';
  // 上身 + 胸部微微前凸（侧面体征，只凸一点点）
  ctx.beginPath();
  ctx.moveTo(794, 180);
  ctx.quadraticCurveTo(789, 170, 790, 162);  // 胸微前凸（一点）
  ctx.lineTo(799, 156);
  ctx.lineTo(805, 184);
  ctx.closePath();
  ctx.fill();
  // 连衣裙主体：胸 → 细腰（明显收窄） → 臀后翘 → 裙摆展开到膝
  ctx.beginPath();
  ctx.moveTo(791, 184);
  ctx.quadraticCurveTo(799, 194, 796, 205);  // 胸部下方
  ctx.quadraticCurveTo(793, 212, 789, 214);  // 细腰（明显收窄）
  ctx.quadraticCurveTo(778, 218, 771, 228);  // 臀后翘
  ctx.quadraticCurveTo(768, 236, 776, 240);  // 裙摆展开
  ctx.lineTo(795, 241);
  ctx.lineTo(807, 238);
  ctx.quadraticCurveTo(812, 222, 805, 202);  // 裙后侧
  ctx.quadraticCurveTo(802, 194, 806, 186);
  ctx.closePath();
  ctx.fill();
  // 裙摆立体感
  ctx.fillStyle = 'rgba(158,110,134,1)';
  ctx.beginPath();
  ctx.moveTo(771, 228);
  ctx.quadraticCurveTo(768, 236, 776, 240);
  ctx.lineTo(789, 240);
  ctx.quadraticCurveTo(784, 234, 779, 224);
  ctx.closePath();
  ctx.fill();
  // 腰带（细腰处，突出腰臀曲线）
  ctx.fillStyle = 'rgba(148,102,126,1)';
  ctx.fillRect(789, 210, 19, 4);
  ctx.restore();
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

var _lastTs = 0;

function draw(ts) {
  ts = ts || performance.now();
  var dt = _lastTs ? Math.min((ts - _lastTs) / 1000, 0.05) : 0.016;
  _lastTs = ts;

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

  // ==== 地面：底部凹凸碎石弧线 + 底边组合（黑色填充） ====
  ctx_save_all();
  var gndCx = width * 0.5;
  var gndCy = height * 0.90;   // 地平线高度（贴近底部）
  var gndW = width * 0.66;     // 地面横向跨度
  var gndDrop = height * 0.012; // 弧线下垂量（小）
  var gndStep = Math.round(gndW / 28); // 碎石段数
  universe.globalAlpha = 0.75;
  universe.fillStyle = '#07070d';
  universe.beginPath();
  // 凹凸不平的碎石弧线（由多个正弦波动的小段组成）
  var gx0 = gndCx - gndW / 2;
  var gx1 = gndCx + gndW / 2;
  universe.moveTo(gx0, gndCy);
  for (var gxx = gx0 + gndStep; gxx <= gx1; gxx += gndStep) {
    var t = (gxx - gx0) / gndW;                 // 0~1
    var drop = gndDrop * Math.sin(Math.PI * t);  // 中间下垂的弧
    var wobble = (Math.sin(t * 17) + Math.sin(t * 29)) * height * 0.004; // 碎石起伏
    var gy = gndCy + drop + wobble;
    universe.lineTo(gxx, gy);
  }
  // 右边直下到底部
  universe.lineTo(gx1, height);
  // 沿底部到左边
  universe.lineTo(gx0, height);
  universe.closePath();
  universe.fill();
  // 碎石弧线描边（微光，凹凸可见）
  universe.strokeStyle = 'rgba(210,220,255,0.22)';
  universe.lineWidth = 1.4;
  universe.beginPath();
  universe.moveTo(gx0, gndCy);
  for (var gxx2 = gx0 + gndStep; gxx2 <= gx1; gxx2 += gndStep) {
    var t2 = (gxx2 - gx0) / gndW;
    var drop2 = gndDrop * Math.sin(Math.PI * t2);
    var wobble2 = (Math.sin(t2 * 17) + Math.sin(t2 * 29)) * height * 0.004;
    universe.lineTo(gxx2, gndCy + drop2 + wobble2);
  }
  universe.stroke();
  ctx_restore_all();

  // ==== 桃花树（始终显示，男女两侧） ====
  for (var pt = 0; pt < peachTrees.length; pt++) {
    var ptree = peachTrees[pt];
    drawPeachTree(ptree.x, ptree.baseY, ptree.h, ptree.s, 1);
  }

  // ==== 星空下的情侣 ====
  updateCouple(dt);
  var cpp = coupleParams();
  if (cpp.opacity > 0.01) drawCouple(cpp);

  // ==== 萤火虫 + 飘落桃花瓣（贴合萤火与星空氛围） ====
  drawFirefliesOverlay();

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