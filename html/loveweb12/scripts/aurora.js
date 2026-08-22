/* ============================================================
 * 极光之恋 aurora.js（loveweb12 · 极光之恋）
 *
 * 主题：北极光帷幕下的雪原誓言
 *   - 深蓝夜空 + 漫天星斗 + 流星
 *   - 流动的极光帷幕（多层彩色光带、波状流动）
 *   - 雪原剪影（起伏雪丘）+ 冰晶飘落
 *   - 中央「极光之心」：青紫色心形，散发冷冽又温柔的光
 *   - 点击/触摸：极光涟漪 + 极光情话浮现
 *   - 沿用 loveweb4~11 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/aurora.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('aurora');
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
    var particles = [];       // 点击极光粒子
    var stars = [];           // 星星
    var meteors = [];         // 流星
    var iceCrystals = [];     // 冰晶飘落
    var textBursts = [];      // 情话

    // ============ 极光夜空背景 ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#030712');
        grad.addColorStop(0.5, '#0b1020');
        grad.addColorStop(1, '#101830');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 星星 ============
    var STAR_COUNT = Math.round((isMobile ? 55 : 90) * DENSITY);

    function createStars() {
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.75,
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
            ctx.fillStyle = 'rgba(230, 240, 255,' + alpha.toFixed(3) + ')';
            ctx.fill();
        }
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

    // ============ 极光帷幕 ============
    var auroraTime = 0;
    var AURORA_LAYERS = [
        { hue: 165, alpha: 0.10, amp: 90, speed: 0.0005, base: 0.25 },
        { hue: 280, alpha: 0.09, amp: 70, speed: 0.0004, base: 0.32 },
        { hue: 195, alpha: 0.12, amp: 110, speed: 0.0006, base: 0.2 }
    ];

    function drawAurora(time) {
        auroraTime += 0.004;
        // 极光在顶部飘动
        for (var l = 0; l < AURORA_LAYERS.length; l++) {
            var layer = AURORA_LAYERS[l];
            var baseY = H * layer.base;
            ctx.save();
            ctx.beginPath();
            // 用贝塞尔波状路径画光带
            var segments = Math.max(10, Math.floor(W / 60));
            ctx.moveTo(0, baseY);
            for (var i = 0; i <= segments; i++) {
                var x = (i / segments) * W;
                var y = baseY
                    + Math.sin(x * 0.004 + auroraTime * layer.speed * 10000 + l * 2) * layer.amp
                    + Math.sin(x * 0.008 + auroraTime * 0.0003 * 10000) * layer.amp * 0.4;
                ctx.lineTo(x, y);
            }
            // 底部收窄到 0（形成帷幕形状）
            for (var i2 = segments; i2 >= 0; i2--) {
                var x2 = (i2 / segments) * W;
                ctx.lineTo(x2, baseY + H * 0.4);
            }
            ctx.closePath();
            var grad = ctx.createLinearGradient(0, baseY - layer.amp * 2, 0, baseY + H * 0.4);
            grad.addColorStop(0, 'hsla(' + layer.hue + ',90%,60%,' + layer.alpha.toFixed(3) + ')');
            grad.addColorStop(0.6, 'hsla(' + layer.hue + ',80%,55%,' + (layer.alpha * 0.5).toFixed(3) + ')');
            grad.addColorStop(1, 'hsla(' + layer.hue + ',80%,50%,0)');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        }
    }

    // ============ 雪原剪影 ============
    function drawSnowfield() {
        // 起伏雪丘
        ctx.fillStyle = 'rgba(20, 30, 55, 0.9)';
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, H * 0.82);
        for (var x = 0; x <= W; x += 20) {
            var y = H * 0.82 + Math.sin(x * 0.003) * H * 0.03 + Math.sin(x * 0.007 + 1) * H * 0.015;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        // 雪线（顶部高光）
        ctx.strokeStyle = 'rgba(180, 210, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (var x2 = 0; x2 <= W; x2 += 20) {
            var y2 = H * 0.82 + Math.sin(x2 * 0.003) * H * 0.03 + Math.sin(x2 * 0.007 + 1) * H * 0.015;
            if (x2 === 0) ctx.moveTo(x2, y2);
            else ctx.lineTo(x2, y2);
        }
        ctx.stroke();
    }

    // ============ 冰晶飘落 ============
    var ICE_COUNT = Math.round((isMobile ? 20 : 35) * DENSITY);

    function createIce() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 2 + 0.8,
            vy: Math.random() * 1 + 0.5,
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.02 + 0.01,
            alpha: Math.random() * 0.5 + 0.3,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.05
        };
    }

    function drawIce(s, time) {
        s.y += s.vy;
        s.rot += s.rotSpeed;
        if (s.y > H + 10) { s.y = -5; s.x = Math.random() * W; }
        ctx.save();
        ctx.translate(s.x + Math.sin(s.sway + time * 0.001) * 8, s.y);
        ctx.rotate(s.rot);
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#e6f4ff';
        // 冰晶（六角星简化）
        for (var a = 0; a < 6; a++) {
            ctx.save();
            ctx.rotate((Math.PI / 3) * a);
            ctx.fillRect(0, -s.r * 0.2, s.r, s.r * 0.4);
            ctx.restore();
        }
        ctx.restore();
    }

    // ============ 中央极光之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawAuroraHeart(time) {
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
            // 心形粒子颜色在青/紫间变化（极光色）
            var hue = 165 + Math.sin(time * 0.002 + i * 0.5) * 60;
            ctx.beginPath();
            ctx.arc(px, py, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + hue + ',90%,70%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（极光青紫）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(130, 220, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#7dd3fc';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        for (var j = 0; j <= 120; j++) {
            var a = (Math.PI * 2 * j) / 120;
            var sx = (16 * Math.pow(Math.sin(a), 3)) * 1.8;
            var sy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 1.8;
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();

        // 中心亮光
        var pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.002));
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + pulse * 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 240, 255,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：极光涟漪 ============
    function spawnAuroraRipple(x, y) {
        var total = Math.round((isMobile ? 24 : 36) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.5 + 0.8;
            var hue = 165 + Math.random() * 120;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                r: Math.random() * 2 + 1,
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

    // ============ 极光情话 ============
    var LOVE_LINES = [
        ['极光再美', '也不及你', '眼里的星辰大海'],
        ['愿与你共赴', '世界的尽头', '看一场永不落幕的极光'],
        ['你是我的北极光', '在漫漫长夜', '为我点亮'],
        ['雪落无声', '极光流转', '而我只想牵你的手'],
        ['在极光之下', '许你一个', '永不褪色的誓言'],
        ['寒夜再长', '有你的光', '便是春天'],
        ['把我们的名字', '写进极光里', '让宇宙作证'],
        ['雪原上两道脚印', '是我想', '与你走到白头']
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
            var ly = H * (0.38 + Math.random() * 0.12);
            recordLoveTime();
            spawnAuroraRipple(lx, ly);
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
            ctx.shadowColor = '#7dd3fc';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#e6f7ff';
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
        drawMeteors();
        drawAurora(time);

        // 冰晶
        for (var i = 0; i < iceCrystals.length; i++) {
            drawIce(iceCrystals[i], time);
        }

        // 极光之心
        drawAuroraHeart(time);

        // 雪原（覆盖在底部）
        drawSnowfield();

        // 点击粒子（极光涟漪）
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#7dd3fc';
                ctx.shadowColor = '#7dd3fc';
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
                ctx.fillStyle = 'hsla(' + pp.hue + ',90%,60%,' + (Math.max(0, pp.alpha) * 0.12).toFixed(3) + ')';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, pp.r, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pp.hue + ',100%,75%,' + (Math.max(0, pp.alpha) * glow).toFixed(3) + ')';
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
        iceCrystals = [];
        for (var i = 0; i < ICE_COUNT; i++) iceCrystals.push(createIce());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnAuroraRipple(x, y);
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
    global.Aurora = {
        debug: function () {
            return {
                stars: stars.length,
                iceCrystals: iceCrystals.length,
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
