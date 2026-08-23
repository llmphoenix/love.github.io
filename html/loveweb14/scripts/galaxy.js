/* ============================================================
 * 银河倾心 galaxy.js（loveweb14 · 银河倾心）
 *
 * 主题：深邃宇宙中的旋转银河，壮丽而浪漫
 *   - 深空渐变 + 满天星斗 + 流星
 *   - 旋转银河旋涡（多层粒子沿螺旋臂公转，核心明亮）
 *   - 彩色星云（青/紫/粉三团弥散光晕，缓慢漂移）
 *   - 中央「银河之心」：青紫渐变心形粒子，随旋涡呼吸
 *   - 点击/触摸：星尘爆发 + 银河情话浮现
 *   - 沿用 loveweb4~12 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/galaxy.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('galaxy');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var W = 0, H = 0, DPR = 1;

    var isMobile = window.innerWidth <= 480;
    var DENSITY = isMobile ? 0.6 : 1;

    // ============ 动态粒子稀释系统（平台硬件自适应） ============
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
    var particles = [];       // 点击星尘粒子
    var galaxyParticles = []; // 银河旋涡粒子
    var stars = [];           // 背景星星
    var nebulae = [];         // 星云
    var meteors = [];         // 流星
    var textBursts = [];      // 情话

    // ============ 深空背景 ============
    function drawSky() {
        var grad = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.max(W, H) * 0.75);
        grad.addColorStop(0, '#1b1040');
        grad.addColorStop(0.5, '#120a30');
        grad.addColorStop(1, '#05030f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 星星 ============
    var STAR_COUNT = Math.round((isMobile ? 60 : 100) * DENSITY);

    function createStars() {
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.2 + 0.3,
                tw: Math.random() * Math.PI * 2,
                sp: Math.random() * 0.02 + 0.005
            });
        }
    }

    function drawStars(time) {
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var alpha = 0.4 + 0.6 * Math.abs(Math.sin(s.tw + time * s.sp * 40));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(235, 235, 255,' + alpha.toFixed(3) + ')';
            ctx.fill();
        }
    }

    // ============ 星云 ============
    var NEBULA_DEFS = [
        { hue: 265, alpha: 0.10, r: 0.45, y: 0.4, dx: 0.15 },
        { hue: 195, alpha: 0.09, r: 0.35, y: 0.55, dx: -0.18 },
        { hue: 320, alpha: 0.08, r: 0.3, y: 0.3, dx: 0.05 }
    ];

    function drawNebulae(time) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < NEBULA_DEFS.length; i++) {
            var neb = NEBULA_DEFS[i];
            var nx = W * (0.5 + neb.dx) + Math.sin(time * 0.0002 + i * 2) * W * 0.05;
            var ny = H * neb.y + Math.cos(time * 0.0002 + i * 1.5) * H * 0.03;
            var nr = Math.max(W, H) * neb.r;
            var grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
            grad.addColorStop(0, 'hsla(' + neb.hue + ', 90%, 60%, ' + neb.alpha.toFixed(3) + ')');
            grad.addColorStop(1, 'hsla(' + neb.hue + ', 90%, 60%, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // ============ 银河旋涡（螺旋臂粒子） ============
    var GALAXY_COUNT = Math.round((isMobile ? 320 : 620) * DENSITY);
    var galaxyAngle = 0;

    function createGalaxy() {
        galaxyParticles = [];
        for (var i = 0; i < GALAXY_COUNT; i++) {
            // 螺旋臂：r 随 theta 增长，两条主臂 + 随机扰动
            var r = Math.pow(Math.random(), 0.8) * 0.9;
            var arm = Math.floor(Math.random() * 2);
            var theta = (arm * Math.PI) + r * 4.5 + (Math.random() - 0.5) * 0.6;
            var nx = Math.cos(theta) * r;
            var ny = Math.sin(theta) * r;
            // 核心更密更亮
            var core = 1 - r;
            var light = 62 + core * 30 + Math.random() * 8;
            var hue = 240 + Math.random() * 60 + core * 20; // 青紫偏蓝
            var size = 0.004 + Math.random() * 0.006 + core * 0.008;
            galaxyParticles.push({
                x: nx, y: ny,          // 归一化位置（相对中心，半径≤1）
                baseR: r, theta: theta,
                speed: (0.5 + Math.random() * 0.4) * (r < 0.3 ? 0.8 : 1),
                hue: hue,
                light: light,
                size: size,
                alpha: 0.5 + Math.random() * 0.4
            });
        }
    }

    function drawGalaxy(time) {
        var cx = W / 2;
        var cy = H * 0.5;
        galaxyAngle += 0.0006;
        // 旋涡整体微微倾斜（透视感）
        var squash = 0.85;
        var modelR = Math.min(W, H) * (isMobile ? 0.44 : 0.4);
        var cosT = Math.cos(galaxyAngle), sinT = Math.sin(galaxyAngle);

        for (var i = 0; i < galaxyParticles.length; i++) {
            var gp = galaxyParticles[i];
            // 粒子沿螺旋臂公转
            var a = gp.theta + galaxyAngle * gp.speed * 10;
            var r = gp.baseR;
            var px = Math.cos(a) * r;
            var py = Math.sin(a) * r * squash;
            // 轻微径向呼吸
            r += Math.sin(time * 0.0005 + gp.theta * 3) * 0.01;
            var sx = cx + px * modelR;
            var sy = cy + py * modelR;

            var tw = 0.7 + 0.3 * Math.sin(time * 0.002 + i * 0.7);
            var size = gp.size * modelR * (0.8 + tw * 0.4);
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + gp.hue + ', 85%, ' + gp.light + '%, ' + (gp.alpha * tw * 0.85).toFixed(3) + ')';
            ctx.fill();
        }

        // 核心光团
        var corePulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.0015));
        var coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, modelR * 0.25);
        coreGrad.addColorStop(0, 'rgba(230, 220, 255,' + (0.4 * corePulse).toFixed(3) + ')');
        coreGrad.addColorStop(1, 'rgba(160, 140, 255, 0)');
        ctx.fillStyle = coreGrad;
        ctx.fillRect(cx - modelR * 0.25, cy - modelR * 0.25, modelR * 0.5, modelR * 0.5);
    }

    // ============ 流星 ============
    var nextMeteor = 0;
    function maybeSpawnMeteor(time) {
        if (time > nextMeteor) {
            var angle = Math.PI * (0.1 + Math.random() * 0.25);
            var speed = 6 + Math.random() * 5;
            meteors.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.4,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 45 + Math.random() * 30
            });
            nextMeteor = time + (isMobile ? 9000 : 6000) * (0.7 + Math.random() * 0.6);
        }
    }

    function drawMeteors() {
        for (var m = meteors.length - 1; m >= 0; m--) {
            var met = meteors[m];
            met.life--;
            met.x += met.vx;
            met.y += met.vy;
            met.vx *= 0.99;
            met.vy *= 0.99;
            var alpha = Math.max(0, met.life / 40);
            ctx.beginPath();
            ctx.arc(met.x, met.y, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 250, 240,' + alpha.toFixed(3) + ')';
            ctx.fill();
            var tailLen = 18;
            var tailX = met.x - met.vx * tailLen;
            var tailY = met.y - met.vy * tailLen;
            var grad = ctx.createLinearGradient(met.x, met.y, tailX, tailY);
            grad.addColorStop(0, 'rgba(255,250,240,' + (alpha * 0.8).toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(255,250,240,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(met.x, met.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();
            if (met.life <= 0) meteors.splice(m, 1);
        }
    }

    // ============ 中央银河之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawGalaxyHeart(time) {
        var cx = W / 2;
        var cy = H * 0.48;
        heartAngle += 0.003;
        var breathe = 1 + Math.sin(time * 0.0012) * 0.06;

        for (var i = 0; i < HEART_COUNT; i++) {
            var t = (Math.PI * 2 * i) / HEART_COUNT;
            var hx = 16 * Math.pow(Math.sin(t), 3);
            var hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            var orbit = 26 * breathe * (1 + Math.sin(heartAngle * 20 + i * 0.7) * 0.06);
            var px = cx + hx / 16 * orbit + Math.sin(heartAngle * 2 + i) * 2;
            var py = cy + hy / 16 * orbit + Math.cos(heartAngle * 2 + i) * 2;

            var tw = 0.6 + 0.4 * Math.sin(time * 0.004 + i * 0.3);
            // 银河色：青紫渐变
            var hue = 240 + Math.sin(time * 0.002 + i * 0.5) * 60;
            ctx.beginPath();
            ctx.arc(px, py, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + hue + ',90%,72%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(170, 150, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#a08cff';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        for (var j = 0; j <= 120; j++) {
            var a = (Math.PI * 2 * j) / 120;
            var sx = (16 * Math.pow(Math.sin(a), 3)) * 1.7;
            var sy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 1.7;
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();

        // 中心亮光
        var pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.002));
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(225, 215, 255,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：星尘爆发 ============
    function spawnStarBurst(x, y) {
        var total = Math.round((isMobile ? 26 : 40) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 3 + 1;
            var hue = 240 + Math.random() * 90;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                r: Math.random() * 1.6 + 0.6,
                hue: hue,
                alpha: 1, decay: 0.02, life: Math.random() * 30 + 30
            });
        }
        pushParticle({
            heart: true,
            x: x, y: y,
            size: 10, alpha: 1, decay: 0.04, life: 30
        });
    }

    // ============ 银河情话 ============
    var LOVE_LINES = [
        ['银河有迹可循', '而我对你', '情难自禁'],
        ['每一颗星都在闪烁', '像极了我', '见你时的模样'],
        ['把满天星辰摘下', '藏进你眼里', '从此星河滚烫'],
        ['宇宙何其浩瀚', '我却只想', '在你身边打转'],
        ['星轨划过夜空', '你划过我心间', '都是唯一的轨迹'],
        ['你是我的银河', '星光璀璨', '皆为你倾倒'],
        ['愿陪你走过', '亿万光年', '看尽星河璀璨'],
        ['把爱意写进星云', '让整个宇宙', '见证我们的名字']
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
            x: x, y: y, lines: lines,
            alpha: 0, scale: 0.6, life: 0,
            fadeIn: 0.045, fadeOut: 0.02, hold: 130, maxLife: 180, fontSize: 26
        });
    }

    function ensureLoveAppears(time) {
        if (time - lastLoveTime >= LOVE_INTERVAL && loveCount() < MAX_LOVE_PER_MIN) {
            lastLoveTime = time;
            var lx = W * (0.3 + Math.random() * 0.4);
            var ly = H * (0.35 + Math.random() * 0.12);
            recordLoveTime();
            spawnStarBurst(lx, ly);
            var lines = pickLoveLine();
            textBursts.push({
                x: lx, y: ly - 40, lines: lines,
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
            ctx.shadowColor = '#a08cff';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#e5deff';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 点击粒子
        for (var p = particles.length - 1; p >= 0; p--) {
            var pp = particles[p];
            pp.life--;
            if (pp.life <= 0) { particles.splice(p, 1); continue; }
            pp.x += pp.vx;
            pp.y += pp.vy;
            pp.alpha -= pp.decay;
            if (pp.alpha < 0) pp.alpha = 0;
        }
    }

    function draw(time) {
        drawSky();
        drawStars(time);
        drawNebulae(time);
        drawGalaxy(time);
        drawMeteors();

        // 银河之心
        drawGalaxyHeart(time);

        // 点击粒子（星尘爆发）
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#a08cff';
                ctx.shadowColor = '#a08cff';
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.moveTo(0, 3);
                ctx.bezierCurveTo(0, 0, -pp.size * 0.6, -pp.size * 0.5, -pp.size, 0);
                ctx.bezierCurveTo(-pp.size, pp.size * 0.6, -pp.size * 0.5, pp.size * 0.9, 0, pp.size * 1.2);
                ctx.bezierCurveTo(pp.size * 0.5, pp.size * 0.9, pp.size, pp.size * 0.6, pp.size, 0);
                ctx.bezierCurveTo(pp.size, -pp.size * 0.5, pp.size * 0.6, 0, 0, 3);
                ctx.fill();
                ctx.restore();
            } else {
                var glow = 0.6 + 0.4 * Math.sin(performance.now() * 0.003 + pp.x);
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, pp.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pp.hue + ',90%,65%,' + (Math.max(0, pp.alpha) * 0.12).toFixed(3) + ')';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, pp.r, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pp.hue + ',100%,78%,' + (Math.max(0, pp.alpha) * glow).toFixed(3) + ')';
                ctx.fill();
            }
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
        maybeSpawnMeteor(time / 1000);

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

        createStars();
        createGalaxy();
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnStarBurst(x, y);
        if (Math.random() < 0.12) {
            explodeLoveText(x, y - 50);
        }
        if (navigator.vibrate) {
            try { navigator.vibrate(15); } catch (e) { /* 忽略 */ }
        }
    }

    if (window.PointerEvent) {
        canvas.addEventListener('pointerup', function (e) {
            handlePointer(e.clientX, e.clientY);
        });
    } else {
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
    global.Galaxy = {
        debug: function () {
            return {
                stars: stars.length,
                galaxyParticles: galaxyParticles.length,
                nebulae: nebulae.length,
                meteors: meteors.length,
                burstParticles: particles.length,
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
