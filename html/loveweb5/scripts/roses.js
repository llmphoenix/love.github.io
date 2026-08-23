/* ============================================================
 * 玫瑰花园 roses.js（loveweb5 · 花的浪漫）
 *
 * 主题：以玫瑰花瓣与萤火虫为核心的温柔浪漫氛围
 *   - 漫天玫瑰花瓣缓缓飘落（多色、旋转、漂浮、层次）
 *   - 萤火虫森林：自主飞舞、发光呼吸
 *   - 中央「爱之玫瑰」：粒子构成的发光玫瑰，缓缓旋转绽放
 *   - 点击/触摸：爱心花瓣旋涡 + 浪漫情话浮现
 *   - 沿用 loveweb4 优化：DPR 缩放、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/roses.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('roses');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var W = 0, H = 0, DPR = 1;

    // 移动端判断
    var isMobile = window.innerWidth <= 480;

    // 粒子数量比例（移动端降低密度）
    var DENSITY = isMobile ? 0.6 : 1;

    // ============ 动态粒子稀释系统（平台硬件自适应，沿用 loveweb4） ============
    function detectHardwareTier() {
        var mem = (navigator.deviceMemory || 4) * 1;
        var cores = (navigator.hardwareConcurrency || 4) * 1;
        var screenArea = (window.innerWidth * window.innerHeight) || (1280 * 800);
        var dprCap = Math.min(window.devicePixelRatio || 1, 2);
        var memScore = Math.min(1, mem / 8);
        var coreScore = Math.min(1, cores / 8);
        var areaFactor = Math.min(1.2, Math.max(0.7, 1280 * 800 / screenArea));
        var dprPenalty = dprCap > 1.5 ? 0.85 : (dprCap > 1 ? 1 : 1.1);
        return (memScore * 0.5 + coreScore * 0.5) * areaFactor * dprPenalty;
    }
    var HARDWARE_SCORE = detectHardwareTier();

    var BASE_PX_BUDGET = 4;
    function computeMaxParticles() {
        var area = (W * H) || (1280 * 800);
        var budget = Math.round((area / 10000) * BASE_PX_BUDGET * HARDWARE_SCORE);
        var minP = isMobile ? 500 : 800;
        var maxP = isMobile ? 2200 : 5500;
        return Math.max(minP, Math.min(maxP, Math.round(budget)));
    }
    var MAX_PARTICLES = computeMaxParticles();
    var particleBudget = MAX_PARTICLES;
    var dilutionFactor = 1.0;

    var fpsWindow = [];
    var lastFpsTime = 0;
    var lastFpsCheck = 0;
    var FPS_CHECK_INTERVAL = 500;
    var FPS_LOW = 45;
    var FPS_OK = 55;
    var DILUTE_MIN = 0.25;
    var DILUTE_STEP_DOWN = 0.82;
    var DILUTE_STEP_UP = 1.12;

    function updateDilution(time) {
        if (lastFpsTime) {
            var frameMs = time - lastFpsTime;
            if (frameMs > 0) fpsWindow.push(1000 / frameMs);
            if (fpsWindow.length > 30) fpsWindow.shift();
        }
        lastFpsTime = time;
        if (time - lastFpsCheck < FPS_CHECK_INTERVAL) return;
        lastFpsCheck = time;
        var avg = 0;
        for (var i = 0; i < fpsWindow.length; i++) avg += fpsWindow[i];
        if (fpsWindow.length) avg /= fpsWindow.length;
        fpsWindow = [];

        if (avg < FPS_LOW) {
            dilutionFactor = Math.max(DILUTE_MIN, dilutionFactor * DILUTE_STEP_DOWN);
            particleBudget = Math.max(200, Math.round(MAX_PARTICLES * dilutionFactor));
        } else if (avg > FPS_OK && dilutionFactor < 1) {
            dilutionFactor = Math.min(1, dilutionFactor * DILUTE_STEP_UP);
            particleBudget = Math.round(MAX_PARTICLES * dilutionFactor);
        } else if (dilutionFactor >= 1) {
            particleBudget = MAX_PARTICLES;
        }
    }

    function pushParticle(p) {
        if (particles.length >= particleBudget) {
            var overRatio = (particles.length - particleBudget + 1) / particleBudget;
            var dropProb = Math.min(0.85, overRatio);
            if (Math.random() < dropProb) return false;
        }
        if (particles.length >= MAX_PARTICLES) return false;
        particles.push(p);
        return true;
    }

    // ============ 粒子容器 ============
    var particles = [];       // 花瓣粒子（旋涡）
    var fireflies = [];       // 萤火虫
    var rosePoints = [];      // 中央 3D 粒子玫瑰（见下方 3D 花束系统）
    var textBursts = [];      // 情话
    var swirls = [];          // 点击旋涡效果
    var petals = [];          // 飘落花瓣
    var stars = [];           // 背景星星

    // ============ 夜空背景（暮色玫瑰色渐变） ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1a0a2e');   // 深紫夜
        grad.addColorStop(0.45, '#2d1b4e'); // 中紫
        grad.addColorStop(0.8, '#4a235a');  // 玫紫
        grad.addColorStop(1, '#6b2d5c');    // 玫瑰暮色
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 玫瑰花瓣 ============
    var PETAL_COLORS = ['#ff6b9d', '#ff4d6d', '#f783ac', '#e64980', '#ff8fa3', '#d6336c', '#ff9e9e'];
    var petalCount = Math.round((isMobile ? 36 : 60) * DENSITY);

    function createPetal() {
        return {
            x: Math.random() * W,
            y: Math.random() * H - H,           // 从顶部开始
            size: (Math.random() * 18 + 12) * (isMobile ? 0.85 : 1),
            vx: (Math.random() - 0.5) * 0.6,     // 水平漂浮
            vy: Math.random() * 1.2 + 0.4,       // 下落速度
            rot: Math.random() * Math.PI * 2,    // 旋转
            rotSpeed: (Math.random() - 0.5) * 0.04,
            sway: Math.random() * Math.PI * 2,   // 摆动相位
            swaySpeed: Math.random() * 0.02 + 0.01,
            swayAmp: Math.random() * 30 + 15,    // 摆动幅度
            color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
            alpha: Math.random() * 0.4 + 0.35,
            layer: Math.random()                  // 层次：远淡小近亮大
        };
    }

    // 画一片玫瑰花瓣（心形弧线，模拟花瓣）
    function drawPetal(p, time) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + Math.sin(p.sway + time * 0.001) * 0.3);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        // 花瓣形：两段弧线构成
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-p.size * 0.5, -p.size * 0.5, -p.size * 0.8, p.size * 0.2, 0, p.size * 0.7);
        ctx.bezierCurveTo(p.size * 0.8, p.size * 0.2, p.size * 0.5, -p.size * 0.5, 0, 0);
        ctx.fill();
        ctx.restore();
    }

    // ============ 萤火虫 ============
    var fireflyCount = Math.round((isMobile ? 20 : 32) * DENSITY);

    function createFirefly() {
        return {
            x: Math.random() * W,
            y: Math.random() * H * 0.8,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            // 自主飞舞：目标点随机移动（飞向新目标）
            tx: Math.random() * W,
            ty: Math.random() * H * 0.8,
            wanderTimer: Math.random() * 200,
            phase: Math.random() * Math.PI * 2,   // 发光相位
            phaseSpeed: Math.random() * 0.05 + 0.02,
            r: Math.random() * 1.5 + 1,
            hue: Math.random() > 0.5 ? 45 : 350   // 暖黄 / 暖粉
        };
    }

    function updateFirefly(f, dt, time) {
        f.wanderTimer -= dt;
        if (f.wanderTimer <= 0) {
            f.tx = Math.random() * W;
            f.ty = Math.random() * H * 0.85;
            f.wanderTimer = Math.random() * 300 + 100;
        }
        // 飞向目标
        var dx = f.tx - f.x;
        var dy = f.ty - f.y;
        var dist = Math.hypot(dx, dy) || 1;
        var sp = 0.15;
        f.x += (dx / dist) * sp * dt;
        f.y += (dy / dist) * sp * dt;
        // 细微抖动
        f.x += (Math.random() - 0.5) * 0.3;
        f.y += (Math.random() - 0.5) * 0.3;
    }

    function drawFirefly(f, time) {
        var glow = 0.5 + 0.5 * Math.sin(f.phase + time * f.phaseSpeed * 0.1);
        var alpha = Math.max(0.1, glow);
        ctx.save();
        // 光晕
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + f.hue + ',100%,70%,' + (alpha * 0.12).toFixed(3) + ')';
        ctx.fill();
        // 中心
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + f.hue + ',100%,80%,' + alpha.toFixed(3) + ')';
        ctx.fill();
        ctx.restore();
    }

    // ============ 中央爱之玫瑰：3D 粒子玫瑰花束（网上流行的可旋转观察版） ============
    // 上千个粒子构成立体花束：花苞→盛开的多层花瓣 + 花茎/叶 + 金色花蕊 + 环绕星尘，
    // 透视投影 + 深度排序呈现立体感，支持拖拽旋转、滚轮/双指捏合缩放、绽放动画，
    // 沿用动态粒子稀释系统（ROSE_MAX 随硬件与 FPS 自适应）。
    var roseRotY = 0.6;          // 绕 Y 轴旋转角（自动 + 拖拽）
    var roseRotX = 0.32;         // 绕 X 轴俯仰角（略俯视）
    var roseVelY = 0;            // 拖拽惯性速度
    var roseVelX = 0;
    var roseZoom = 1;            // 当前缩放
    var roseZoomTarget = 1;      // 目标缩放（平滑过渡）
    var roseBloom = 0;           // 绽放进度 0→1
    var roseStartTime = 0;
    var roseDragging = false;
    var roseBaseR = 0;           // 模型→屏幕基准半径
    var roseTargetCount = 0;     // 当前应绘制粒子数（随稀释系统自适应）
    var ROSE_MAX = Math.round((isMobile ? 1600 : 3400) * HARDWARE_SCORE);
    var ROSE_STEM_COUNT = 140;
    var ROSE_LEAF_COUNT = 110;
    var ROSE_BUD_COUNT = 130;
    var ROSE_SPARK_COUNT = 90;

    // 玫瑰花瓣层次（内层花苞→外层展开，tilt>0 上翘 / tilt<0 下垂）
    var ROSE_LAYERS = [
        { petal: 5,  tilt: 1.05, len: 0.30, width: 0.19, attach: 0.05, baseY: 0.60, curl: 0.75, hue: 333 },
        { petal: 6,  tilt: 0.82, len: 0.40, width: 0.24, attach: 0.07, baseY: 0.46, curl: 0.55, hue: 337 },
        { petal: 7,  tilt: 0.52, len: 0.52, width: 0.30, attach: 0.10, baseY: 0.32, curl: 0.40, hue: 342 },
        { petal: 8,  tilt: 0.20, len: 0.65, width: 0.37, attach: 0.13, baseY: 0.16, curl: 0.28, hue: 347 },
        { petal: 9,  tilt: -0.18, len: 0.79, width: 0.45, attach: 0.17, baseY: -0.02, curl: 0.18, hue: 351 },
        { petal: 10, tilt: -0.52, len: 0.93, width: 0.53, attach: 0.21, baseY: -0.20, curl: 0.08, hue: 356 }
    ];

    // hsl → rgb 字符串（预生成，避免逐帧字符串拼接）
    function hsl2rgb(h, s, l) {
        s /= 100; l /= 100;
        var c = (1 - Math.abs(2 * l - 1)) * s;
        var hp = (((h % 360) + 360) % 360) / 60;
        var x = c * (1 - Math.abs((hp % 2) - 1));
        var r = 0, g = 0, b = 0;
        if (hp < 1) { r = c; g = x; }
        else if (hp < 2) { r = x; g = c; }
        else if (hp < 3) { g = c; b = x; }
        else if (hp < 4) { g = x; b = c; }
        else if (hp < 5) { r = x; b = c; }
        else { r = c; b = x; }
        var m = l - c / 2;
        return 'rgb(' + Math.round((r + m) * 255) + ',' + Math.round((g + m) * 255) + ',' + Math.round((b + m) * 255) + ')';
    }

    function makeRosePoint(x, y, z, rgb, size, alpha, type, phase) {
        // 闭合态 cx/cy/cz：花瓣收拢成竖向花苞（绽放动画起点）
        return {
            x: x, y: y, z: z,
            cx: x * 0.08, cy: y * 0.38, cz: z * 0.08,
            rgb: rgb, size: size, a: alpha,
            type: type || 'petal',
            phase: phase == null ? Math.random() * Math.PI * 2 : phase
        };
    }

    // 一片花瓣：沿长度 s、宽度 w 撒粒子
    function addPetalParticles(L, ang, count, layerIdx) {
        var radC = Math.cos(ang), radS = Math.sin(ang);
        var cosT = Math.cos(L.tilt), sinT = Math.sin(L.tilt);
        var nx = -radS, nz = radC;                 // 花瓣宽度方向
        var layerK = layerIdx / (ROSE_LAYERS.length - 1);
        for (var i = 0; i < count; i++) {
            var s = Math.pow(Math.random(), 0.75); // 长度参数（偏尖端）
            var w = (Math.random() * 2 - 1) * 0.95;// 宽度参数
            var lenS = L.len * s;
            var dx = radC * lenS * cosT;
            var dy = lenS * sinT;
            var dz = radS * lenS * cosT;
            var wid = L.width * Math.pow(s, 0.6) * w;
            var wx = nx * wid, wz = nz * wid;
            var curl = L.curl * L.len * s * s;     // 尖端轻微上卷
            var x = L.attach * radC + dx + wx;
            var y = L.baseY + dy + curl;
            var z = L.attach * radS + dz + wz;
            // 颜色：内层深玫红、外层偏粉，尖端更亮
            var hue = L.hue + Math.random() * 8 - 4;
            var light = 52 + layerK * 10 + (1 - s) * 10 + Math.random() * 10;
            var size = 0.009 + Math.random() * 0.006 + (1 - s) * 0.004;
            rosePoints.push(makeRosePoint(x, y, z, hsl2rgb(hue, 82, light), size, 0.92, 'petal'));
        }
    }

    // 花茎：从花心向下略微弯曲
    function addStemParticles() {
        for (var i = 0; i < ROSE_STEM_COUNT; i++) {
            var t = i / ROSE_STEM_COUNT;
            var y = -0.06 - t * 1.32;
            var x = Math.sin(t * 3.2) * 0.06;
            var z = Math.cos(t * 2.4) * 0.05;
            var light = 36 + Math.random() * 12;
            var size = 0.011 + Math.random() * 0.006;
            rosePoints.push(makeRosePoint(x, y, z, hsl2rgb(122, 55, light), size, 0.9, 'stem'));
        }
    }

    // 叶子：贴在花茎两侧
    function addLeafParticles(side, y0, ang, dir) {
        var cosA = Math.cos(ang), sinA = Math.sin(ang);
        for (var i = 0; i < ROSE_LEAF_COUNT; i++) {
            var s = Math.pow(Math.random(), 0.7);
            var w = (Math.random() * 2 - 1) * 0.9;
            var lenS = 0.34 * s;
            var lx = side * 0.16 + dir * lenS * cosA;
            var ly = y0 + lenS * 0.45 * s + w * 0.05;
            var lz = w * 0.13 * Math.sin(s * Math.PI) + dir * lenS * sinA;
            var light = 42 + Math.random() * 14;
            var size = 0.010 + Math.random() * 0.006;
            rosePoints.push(makeRosePoint(lx, ly, lz, hsl2rgb(126, 52, light), size, 0.9, 'leaf'));
        }
    }

    // 花心金色光点（花蕊簇）
    function addBudParticles() {
        for (var i = 0; i < ROSE_BUD_COUNT; i++) {
            var th = Math.random() * Math.PI * 2;
            var ph = Math.acos(Math.random() * 2 - 1);
            var r = Math.pow(Math.random(), 1.6) * 0.14;
            var x = Math.cos(th) * Math.sin(ph) * r;
            var y = 0.30 + Math.cos(ph) * r * 0.7 + Math.random() * 0.08;
            var z = Math.sin(th) * Math.sin(ph) * r;
            var light = 72 + Math.random() * 12;
            var size = 0.010 + Math.random() * 0.007;
            rosePoints.push(makeRosePoint(x, y, z, hsl2rgb(348, 88, light), size, 1, 'bud'));
        }
    }

    // 环绕星尘
    function addSparkles() {
        for (var i = 0; i < ROSE_SPARK_COUNT; i++) {
            var th = Math.random() * Math.PI * 2;
            var r = 0.85 + Math.random() * 1.25;
            var y = (Math.random() - 0.35) * 1.6;
            var x = Math.cos(th) * r;
            var z = Math.sin(th) * r;
            var light = 68 + Math.random() * 14;
            rosePoints.push(makeRosePoint(x, y, z, hsl2rgb(44, 92, light), 0.007 + Math.random() * 0.005, 0.6, 'spark', Math.random() * Math.PI * 2));
        }
    }

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
    }

    function buildRose() {
        rosePoints = [];
        // 花瓣粒子数：按各层面积比例分配，保证整体均匀
        var totalArea = 0;
        var areas = [];
        for (var l = 0; l < ROSE_LAYERS.length; l++) {
            var a = ROSE_LAYERS[l].len * ROSE_LAYERS[l].width * ROSE_LAYERS[l].petal;
            areas.push(a); totalArea += a;
        }
        var petalBudget = Math.round(ROSE_MAX * 0.8);
        for (var l = 0; l < ROSE_LAYERS.length; l++) {
            var L = ROSE_LAYERS[l];
            var perPetal = Math.max(1, Math.round(petalBudget * areas[l] / totalArea / L.petal));
            for (var p = 0; p < L.petal; p++) {
                var ang = (p / L.petal) * Math.PI * 2 + (l % 2) * (Math.PI / L.petal) + l * 0.3;
                addPetalParticles(L, ang, perPetal, l);
            }
        }
        addStemParticles();
        addLeafParticles(-1, -0.30, 0.3, 1);    // 左侧叶
        addLeafParticles(1, -0.55, -0.2, -1);   // 右侧叶
        addBudParticles();
        addSparkles();
        shuffle(rosePoints);
        roseTargetCount = rosePoints.length;
        roseStartTime = performance.now();
        roseBloom = 0;
    }

    // 玫瑰旋转 / 绽放 / 缩放状态更新
    function updateRose(dt, time) {
        if (!roseDragging) {
            roseRotY += 0.0045 * dt + roseVelY;
            roseRotX += roseVelX;
        } else {
            roseRotY += roseVelY;
            roseRotX += roseVelX;
        }
        roseVelY *= 0.94;
        roseVelX *= 0.94;
        // 缩放平滑过渡
        roseZoom += (roseZoomTarget - roseZoom) * 0.08;
        // 绽放进度（easeOutCubic，约 2.6s）
        if (roseBloom < 1 && roseStartTime) {
            var t = Math.min(1, (time - roseStartTime) / 2600);
            roseBloom = 1 - Math.pow(1 - t, 3);
        }
        // 稀释自适应：FPS 低时减少绘制粒子数
        var want = Math.round(ROSE_MAX * Math.max(0.3, dilutionFactor));
        roseTargetCount = Math.max(300, Math.min(rosePoints.length, want));
    }

    function drawRose(time) {
        if (!rosePoints.length) return;
        var cx = W / 2;
        var cy = H * 0.50 + Math.sin(time * 0.0007) * roseBaseR * 0.04; // 轻微漂浮
        var persp = 3.4;                       // 透视距离（越小立体感越强）
        var modelR = roseBaseR * roseZoom;
        var b = roseBloom;
        var cosY = Math.cos(roseRotY), sinY = Math.sin(roseRotY);
        var cosX = Math.cos(roseRotX), sinX = Math.sin(roseRotX);

        var n = Math.min(roseTargetCount, rosePoints.length);
        var scr = [];
        for (var i = 0; i < n; i++) {
            var pt = rosePoints[i];
            // 绽放插值：闭合花苞 → 盛开
            var x = pt.cx + (pt.x - pt.cx) * b;
            var y = pt.cy + (pt.y - pt.cy) * b;
            var z = pt.cz + (pt.z - pt.cz) * b;
            // 星尘微动
            if (pt.type === 'spark') {
                x += Math.sin(time * 0.0006 + pt.phase) * 0.04;
                y += Math.cos(time * 0.0005 + pt.phase) * 0.04;
                z += Math.sin(time * 0.0007 + pt.phase * 2) * 0.04;
            }
            // 绕 Y 旋转
            var x1 = x * cosY + z * sinY;
            var z1 = -x * sinY + z * cosY;
            var y1 = y;
            // 绕 X 旋转
            var y2 = y1 * cosX - z1 * sinX;
            var z2 = y1 * sinX + z1 * cosX;
            // 透视投影
            var pr = persp / (persp + z2);
            if (pr <= 0.02) continue;
            scr.push({
                sx: cx + x1 * pr * modelR,
                sy: cy - (y2 - 0.22) * pr * modelR,
                z: z2, p: pr, pt: pt
            });
        }
        // 深度排序（远处先画，实现遮挡与立体感）
        scr.sort(function (p1, p2) { return p1.z - p2.z; });

        for (var k = 0; k < scr.length; k++) {
            var it = scr[k];
            var pt = it.pt;
            // 距离亮度：近亮大、远暗小
            var near = Math.min(1.25, Math.max(0.35, it.p));
            var size = pt.size * modelR * near;
            var alpha = pt.a * Math.min(1, 0.35 + 0.65 * (near / 1.25));
            var tw = 1;
            if (pt.type === 'bud' || pt.type === 'spark') {
                tw = 0.72 + 0.28 * Math.sin(time * 0.003 + pt.phase); // 闪烁
            }
            ctx.fillStyle = pt.rgb;
            // 光晕
            ctx.globalAlpha = alpha * 0.14 * tw;
            ctx.beginPath();
            ctx.arc(it.sx, it.sy, size * 4.5, 0, Math.PI * 2);
            ctx.fill();
            // 核心
            ctx.globalAlpha = alpha * tw;
            ctx.beginPath();
            ctx.arc(it.sx, it.sy, size * 1.7, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ============ 点击互动：爱心花瓣旋涡 ============
    function spawnSwirl(x, y) {
        var total = Math.round((isMobile ? 24 : 36) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = (Math.PI * 2 * i) / total + Math.random() * 0.3;
            var sp = Math.random() * 3 + 1.5;
            pushParticle({
                type: 'swirl',
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 0.5,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                size: Math.random() * 10 + 6,
                color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
                alpha: 1,
                decay: 0.015,
                gravity: 0.05,
                life: Math.random() * 30 + 40
            });
        }
        // 中心爱心闪光
        pushParticle({
            type: 'heartFlash',
            x: x, y: y,
            size: 8, alpha: 1, decay: 0.03, life: 30
        });
    }

    // ============ 浪漫情话 ============
    var LOVE_LINES = [
        ['玫瑰有刺', '正如我爱你', '带着全部的认真与温柔'],
        ['把所有的偏爱', '都织进这朵玫瑰', '只为一个人绽放'],
        ['我愿做你的园丁', '种一园玫瑰', '只为等你来采'],
        ['风起花落', '思念无声', '却满山遍野都是你'],
        ['你是玫瑰', '也是我的春天', '温柔而盛大'],
        ['这世界盛大灿烂', '可我偏爱', '你这一枝玫瑰'],
        ['玫瑰至死不渝', '爱意生生不息', '予你永远'],
        ['把温柔藏进花瓣', '把深情写进时光', '人间皆你']
    ];
    var usedLine = -1;
    var lastLoveTime = 0;
    var LOVE_INTERVAL = 60000;
    var loveTimes = [];
    var MAX_LOVE_PER_MIN = 2;

    function recordLoveTime() {
        var now = performance.now();
        loveTimes.push(now);
        while (loveTimes.length && now - loveTimes[0] > 60000) loveTimes.shift();
        lastLoveTime = now;
    }

    function loveCount() {
        var now = performance.now();
        while (loveTimes.length && now - loveTimes[0] > 60000) loveTimes.shift();
        return loveTimes.length;
    }

    function pickLoveLine() {
        var idx = Math.floor(Math.random() * LOVE_LINES.length);
        if (idx === usedLine && LOVE_LINES.length > 1) {
            idx = (idx + 1 + Math.floor(Math.random() * (LOVE_LINES.length - 1))) % LOVE_LINES.length;
        }
        usedLine = idx;
        return LOVE_LINES[idx];
    }

    function explodeLoveText(x, y) {
        if (loveCount() >= MAX_LOVE_PER_MIN) return;
        recordLoveTime();
        var lines = pickLoveLine();
        textBursts.push({
            x: x, y: y,
            lines: lines,
            alpha: 0,
            scale: 0.6,
            life: 0,
            fadeIn: 0.045,
            fadeOut: 0.02,
            hold: 130,
            maxLife: 180,
            fontSize: 26
        });
    }

    // 定时保底：1 分钟至少一次
    function ensureLoveAppears(time) {
        if (time - lastLoveTime >= LOVE_INTERVAL && loveCount() < MAX_LOVE_PER_MIN) {
            lastLoveTime = time;
            var lx = W * (0.3 + Math.random() * 0.4);
            var ly = H * (0.3 + Math.random() * 0.2);
            recordLoveTime();
            spawnSwirl(lx, ly);
            var lines = pickLoveLine();
            textBursts.push({
                x: lx, y: ly - 40,
                lines: lines,
                alpha: 0, scale: 0.6, life: 0,
                fadeIn: 0.045, fadeOut: 0.02, hold: 130, maxLife: 180, fontSize: 26
            });
        }
    }

    function drawTextBursts() {
        for (var i = textBursts.length - 1; i >= 0; i--) {
            var tb = textBursts[i];
            tb.life++;
            if (tb.life <= 30) {
                tb.alpha = Math.min(1, tb.alpha + tb.fadeIn);
                tb.scale += (1 - tb.scale) * 0.06;
            } else if (tb.life > 30 + tb.hold) {
                tb.alpha = Math.max(0, tb.alpha - tb.fadeOut);
            }
            tb.scale = Math.min(1.05, tb.scale);
            var alpha = Math.max(0, Math.min(1, tb.alpha));
            if (alpha <= 0.01 && tb.life > 40) {
                textBursts.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.translate(tb.x, tb.y);
            ctx.scale(tb.scale, tb.scale);
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold ' + (tb.fontSize || 26) + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.shadowColor = '#ff9ff3';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#ffe0f0';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);
        updateRose(dt, time);

        // 花瓣：下落 + 漂浮 + 旋转 + 摆动，到底部重置
        for (var i = 0; i < petals.length; i++) {
            var pt = petals[i];
            pt.y += pt.vy * dt;
            pt.x += pt.vx * dt + Math.sin(pt.sway + time * 0.001 * pt.swaySpeed * 1000) * 0.3 * dt;
            pt.rot += pt.rotSpeed * dt;
            pt.sway += pt.swaySpeed * dt;
            if (pt.y > H + 30) {
                petals[i] = createPetal(); // 复用：回到顶部
            }
            if (pt.x < -30) pt.x = W + 20;
            if (pt.x > W + 30) pt.x = -20;
        }

        // 萤火虫
        for (var f = 0; f < fireflies.length; f++) {
            updateFirefly(fireflies[f], dt, time);
        }

        // 旋涡粒子
        for (var p = particles.length - 1; p >= 0; p--) {
            var pp = particles[p];
            pp.life--;
            if (pp.life <= 0) { particles.splice(p, 1); continue; }
            pp.vy += pp.gravity || 0;
            pp.x += pp.vx;
            pp.y += pp.vy;
            pp.alpha -= pp.decay;
            if (pp.alpha < 0) pp.alpha = 0;
            pp.rot += pp.rotSpeed || 0;
        }
    }

    function draw(time) {
        drawSky();

        // 背景星星（简化：少量淡星）
        for (var s = 0; s < stars.length; s++) {
            var st = stars[s];
            var alpha = 0.3 + 0.3 * Math.sin(st.tw + time * 0.001 * st.sp);
            ctx.beginPath();
            ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
            ctx.fill();
        }

        // 萤火虫
        for (var f = 0; f < fireflies.length; f++) {
            drawFirefly(fireflies[f], time);
        }

        // 玫瑰花瓣
        for (var i = 0; i < petals.length; i++) {
            drawPetal(petals[i], time);
        }

        // 中央爱之玫瑰
        drawRose(time);

        // 旋涡粒子
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            ctx.save();
            ctx.translate(pp.x, pp.y);
            if (pp.type === 'heartFlash') {
                ctx.rotate(pp.rot);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#ffb3c8';
                ctx.beginPath();
                ctx.moveTo(0, 3);
                ctx.bezierCurveTo(0, 0, -pp.size * 0.6, -pp.size * 0.5, -pp.size, 0);
                ctx.bezierCurveTo(-pp.size, pp.size * 0.6, -pp.size * 0.5, pp.size * 0.9, 0, pp.size * 1.2);
                ctx.bezierCurveTo(pp.size * 0.5, pp.size * 0.9, pp.size, pp.size * 0.6, pp.size, 0);
                ctx.bezierCurveTo(pp.size, -pp.size * 0.5, pp.size * 0.6, 0, 0, 3);
                ctx.fill();
            } else {
                ctx.rotate(pp.rot);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = pp.color;
                // 花瓣形旋涡粒子
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(-pp.size * 0.4, -pp.size * 0.4, -pp.size * 0.7, pp.size * 0.15, 0, pp.size * 0.55);
                ctx.bezierCurveTo(pp.size * 0.7, pp.size * 0.15, pp.size * 0.4, -pp.size * 0.4, 0, 0);
                ctx.fill();
            }
            ctx.restore();
        }

        // 情话
        drawTextBursts();
    }

    // ============ 动画循环 ============
    var lastTime = 0;
    function loop(time) {
        var dt = lastTime ? (time - lastTime) / 16.67 : 1;
        if (dt > 3) dt = 3;
        lastTime = time;

        updateDilution(time);
        update(dt, time);
        draw(time);

        requestAnimationFrame(loop);
    }

    // ============ 尺寸 / DPR ============
    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        MAX_PARTICLES = computeMaxParticles();
        particleBudget = Math.max(200, Math.round(MAX_PARTICLES * dilutionFactor));

        // 重建背景元素（按新尺寸）
        petals = [];
        for (var i = 0; i < petalCount; i++) petals.push(createPetal());
        fireflies = [];
        for (var j = 0; j < fireflyCount; j++) fireflies.push(createFirefly());
        stars = [];
        var sc = Math.round((isMobile ? 40 : 60) * DENSITY);
        for (var k = 0; k < sc; k++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1 + 0.3,
                tw: Math.random() * Math.PI * 2,
                sp: Math.random() * 0.02 + 0.005
            });
        }
        roseBaseR = Math.min(W, H) * (isMobile ? 0.34 : 0.26);
        buildRose();
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnSwirl(x, y);
        // 点击后短暂加快花瓣飘落（浪漫扰动）
        for (var i = 0; i < petals.length; i++) {
            petals[i].vy += 0.6;
        }
        // 低概率触发情话
        if (Math.random() < 0.12) {
            explodeLoveText(x, y - 50);
        }
        // 震感
        if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch (e) { /* 忽略 */ }
        }
    }

    // ============ 交互：拖拽旋转 3D 花束 / 滚轮·捏合缩放 / 点击撒花瓣 ============
    var dragState = null;        // { x, y, dist, moved, ptrId, lastX, lastY }
    var pointerMap = {};         // 多指跟踪（捏合缩放）
    var pinchDist0 = 0;
    var pinchZoom0 = 1;
    var ROSE_DRAG_THRESHOLD = 10;

    function getPinchDist() {
        var ids = Object.keys(pointerMap);
        if (ids.length < 2) return 0;
        var p1 = pointerMap[ids[0]];
        var p2 = pointerMap[ids[1]];
        return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    function pointerDown(e) {
        pointerMap[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (dragState) return;
        dragState = { x: e.clientX, y: e.clientY, dist: 0, moved: false, ptrId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
        roseDragging = true;
        roseVelY = 0; roseVelX = 0;
        canvas.classList.add('dragging');
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        if (Object.keys(pointerMap).length >= 2) {
            pinchDist0 = getPinchDist();
            pinchZoom0 = roseZoomTarget;
        }
    }

    function pointerMove(e) {
        if (pointerMap[e.pointerId]) pointerMap[e.pointerId] = { x: e.clientX, y: e.clientY };
        if (!dragState || dragState.ptrId !== e.pointerId) return;
        var dx = e.clientX - dragState.lastX;
        var dy = e.clientY - dragState.lastY;
        dragState.lastX = e.clientX;
        dragState.lastY = e.clientY;
        dragState.dist += Math.abs(dx) + Math.abs(dy);
        if (dragState.dist > ROSE_DRAG_THRESHOLD) dragState.moved = true;
        // 拖拽旋转（带惯性）
        roseRotY += dx * 0.006;
        roseRotX += dy * 0.005;
        roseRotX = Math.max(-0.4, Math.min(1.25, roseRotX));
        roseVelY = dx * 0.006;
        roseVelX = dy * 0.005;
        // 双指捏合缩放
        var pd = getPinchDist();
        if (pd > 20 && pinchDist0 > 0) {
            roseZoomTarget = Math.max(0.55, Math.min(2.4, pinchZoom0 * (pd / pinchDist0)));
        }
    }

    function pointerUp(e) {
        delete pointerMap[e.pointerId];
        if (!dragState || dragState.ptrId !== e.pointerId) return;
        var wasMoved = dragState.moved;
        var sx = dragState.x, sy = dragState.y;
        dragState = null;
        roseDragging = Object.keys(pointerMap).length > 0;
        pinchDist0 = 0;
        canvas.classList.remove('dragging');
        // 未拖拽视为点击 → 撒花瓣旋涡
        if (!wasMoved) {
            handlePointer(sx, sy);
        }
    }

    // 滚轮缩放
    canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        roseZoomTarget = Math.max(0.55, Math.min(2.4, roseZoomTarget * (1 - e.deltaY * 0.0012)));
        hideHint();
    }, { passive: false });

    // 双击重置视图
    canvas.addEventListener('dblclick', function (e) {
        roseRotY = 0.6;
        roseRotX = 0.32;
        roseVelY = 0; roseVelX = 0;
        roseZoomTarget = 1;
    });

    // 交互提示文字：首次交互后淡出
    var hintEl = document.getElementById('hint');
    var hintTimer = null;
    function hideHint() {
        if (!hintEl || hintEl.classList.contains('fade-out')) return;
        clearTimeout(hintTimer);
        hintTimer = setTimeout(function () { hintEl.classList.add('fade-out'); }, 2200);
    }
    canvas.addEventListener('pointerdown', hideHint);
    canvas.addEventListener('dblclick', hideHint);

    if (window.PointerEvent) {
        canvas.addEventListener('pointerdown', pointerDown);
        window.addEventListener('pointermove', pointerMove);
        window.addEventListener('pointerup', pointerUp);
        window.addEventListener('pointercancel', pointerUp);
    } else {
        // 老浏览器回退：仅点击撒花瓣
        var lastTap = 0;
        canvas.addEventListener('touchend', function (e) {
            var now = Date.now();
            if (now - lastTap < 400) return;
            lastTap = now;
            var touch = e.changedTouches[0];
            handlePointer(touch.clientX, touch.clientY);
        });
        canvas.addEventListener('click', function (e) {
            var now = Date.now();
            if (now - lastTap < 400) return;
            lastTap = now;
            handlePointer(e.clientX, e.clientY);
        });
    }

    // 启动
    resize();
    lastLoveTime = performance.now() + 1000;
    requestAnimationFrame(loop);

    // 暴露接口（调试/测试）
    global.Roses = {
        debug: function () {
            return {
                petals: petals.length,
                fireflies: fireflies.length,
                rosePoints: rosePoints.length,
                roseTarget: roseTargetCount,
                roseRotY: roseRotY.toFixed(2),
                roseRotX: roseRotX.toFixed(2),
                roseZoom: roseZoom.toFixed(2),
                roseZoomTarget: roseZoomTarget.toFixed(2),
                roseBloom: roseBloom.toFixed(2),
                swirlParticles: particles.length,
                textBursts: textBursts.length,
                dilutionFactor: dilutionFactor,
                particleBudget: particleBudget,
                maxParticles: MAX_PARTICLES,
                hardwareScore: HARDWARE_SCORE,
                loveCount1min: loveCount()
            };
        }
    };
})(window);
