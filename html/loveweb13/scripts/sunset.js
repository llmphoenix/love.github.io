/* ============================================================
 * 暖金落日 sunset.js（loveweb13 · 暖金落日）
 *
 * 主题：暖橙暮色与海面波光，温柔而盛大
 *   - 黄昏渐变天际（金黄→橙红→暮紫）+ 晚霞云带
 *   - 缓缓沉落的落日（光晕 + 半圆日轮 + 海面倒影）
 *   - 海面粼粼波光（横向闪烁光带）+ 飞鸟剪影（V 形扇翅）
 *   - 中央「落日之心」：暖金色心形粒子，随落日一同呼吸
 *   - 点击/触摸：余晖光晕扩散 + 暮色情话浮现
 *   - 沿用 loveweb4~12 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/sunset.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('sunset');
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
    var particles = [];       // 点击余晖粒子
    var glowRays = [];        // 落日光晕射线
    var birds = [];           // 飞鸟
    var textBursts = [];      // 情话

    // ============ 黄昏天际背景 ============
    function drawSky(time) {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#2b1030');   // 暮紫
        grad.addColorStop(0.35, '#5b2a52'); // 玫紫
        grad.addColorStop(0.6, '#c95a3e');  // 橙红
        grad.addColorStop(0.8, '#ffb84d');  // 金黄
        grad.addColorStop(1, '#ffe9b8');    // 暖黄地平线
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // 晚霞云带（横向条状，缓慢漂移）
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < 5; i++) {
            var cloudY = H * (0.15 + i * 0.09) + Math.sin(time * 0.0003 + i * 2.1) * H * 0.02;
            var cloudA = 0.05 + (i % 2) * 0.03;
            var grad2 = ctx.createLinearGradient(0, cloudY - 14, 0, cloudY + 14);
            grad2.addColorStop(0, 'rgba(255,180,120,0)');
            grad2.addColorStop(0.5, 'rgba(255,190,130,' + cloudA.toFixed(3) + ')');
            grad2.addColorStop(1, 'rgba(255,180,120,0)');
            ctx.fillStyle = grad2;
            ctx.fillRect(0, cloudY - 14, W, 28);
        }
        ctx.restore();
    }

    // ============ 落日（含光晕射线） ============
    var sunX = 0, sunY = 0, sunR = 0;

    function createSun() {
        sunX = W * 0.5;
        sunY = H * 0.62;
        sunR = Math.min(W, H) * (isMobile ? 0.1 : 0.085);
        glowRays = [];
        var rayCount = Math.round((isMobile ? 10 : 16) * DENSITY);
        for (var i = 0; i < rayCount; i++) {
            var a = Math.PI * (0.15 + 0.7 * i / rayCount) + (Math.random() - 0.5) * 0.3;
            glowRays.push({
                a: a,
                len: sunR * (1.6 + Math.random() * 1.2),
                w: sunR * (0.05 + Math.random() * 0.05),
                drift: Math.random() * Math.PI * 2
            });
        }
    }

    function drawSun(time) {
        var breathe = 1 + Math.sin(time * 0.001) * 0.02;

        // 外发光（大光晕）
        var glowGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 4 * breathe);
        glowGrad.addColorStop(0, 'rgba(255, 200, 120, 0.5)');
        glowGrad.addColorStop(0.4, 'rgba(255, 160, 90, 0.2)');
        glowGrad.addColorStop(1, 'rgba(255, 120, 70, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(sunX - sunR * 4, sunY - sunR * 4, sunR * 8, sunR * 8);

        // 光晕射线（缓慢旋转）
        ctx.save();
        ctx.translate(sunX, sunY);
        ctx.rotate(Math.sin(time * 0.0004) * 0.15);
        for (var i = 0; i < glowRays.length; i++) {
            var ray = glowRays[i];
            var tw = 0.7 + 0.3 * Math.sin(time * 0.002 + ray.drift);
            ctx.save();
            ctx.rotate(ray.a);
            ctx.globalAlpha = 0.28 * tw;
            ctx.fillStyle = '#ffd9a0';
            ctx.fillRect(-ray.w / 2, 0, ray.w, ray.len);
            ctx.restore();
        }
        ctx.restore();

        // 日轮（半圆，沉在地平线下）
        ctx.save();
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunR * breathe, Math.PI, 0);
        ctx.closePath();
        var sunGrad = ctx.createRadialGradient(sunX - sunR * 0.3, sunY - sunR * 0.3, 0, sunX, sunY, sunR * breathe);
        sunGrad.addColorStop(0, '#fff4d6');
        sunGrad.addColorStop(0.6, '#ffd166');
        sunGrad.addColorStop(1, '#ff9f43');
        ctx.fillStyle = sunGrad;
        ctx.fill();
        ctx.restore();

        // 海面倒影（日轮下方光柱）
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var r = 0; r < 5; r++) {
            var rw = sunR * (0.7 - r * 0.1) * (0.6 + 0.4 * Math.sin(time * 0.003 + r));
            var alpha = 0.16 - r * 0.025;
            if (alpha <= 0) break;
            var grad = ctx.createLinearGradient(sunX - rw, 0, sunX + rw, 0);
            grad.addColorStop(0, 'rgba(255,190,100,0)');
            grad.addColorStop(0.5, 'rgba(255,205,120,' + alpha.toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(255,190,100,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(sunX - rw, sunY + sunR * 0.5 + r * H * 0.03, rw * 2, H * 0.045);
        }
        ctx.restore();
    }

    // ============ 海面波光 ============
    var GLINT_COUNT = Math.round((isMobile ? 24 : 42) * DENSITY);
    var glints = [];

    function createGlints() {
        glints = [];
        for (var i = 0; i < GLINT_COUNT; i++) {
            glints.push({
                x: Math.random() * W,
                y: H * (0.72 + Math.random() * 0.24),
                w: Math.random() * 6 + 3,
                h: Math.random() * 2 + 1,
                phase: Math.random() * Math.PI * 2,
                sp: Math.random() * 0.004 + 0.002,
                hue: Math.random() > 0.5 ? 35 : 28
            });
        }
    }

    function drawGlints(time) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < glints.length; i++) {
            var g = glints[i];
            var tw = 0.5 + 0.5 * Math.sin(g.phase + time * g.sp * 1000);
            if (tw < 0.15) continue;
            // 随波晃动
            var gx = g.x + Math.sin(time * 0.001 + g.phase) * 4;
            ctx.globalAlpha = tw * 0.7;
            ctx.fillStyle = 'hsla(' + g.hue + ', 95%, 70%, 0.85)';
            ctx.beginPath();
            ctx.ellipse(gx, g.y, g.w * tw + 1, g.h, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // ============ 飞鸟剪影 ============
    var BIRD_COUNT = Math.round((isMobile ? 3 : 5) * DENSITY);

    function createBird() {
        return {
            x: Math.random() * W,
            y: H * (0.15 + Math.random() * 0.2),
            vx: (Math.random() * 0.8 + 0.5) * (Math.random() > 0.5 ? 1 : -1),
            vy: Math.sin(Math.random() * 6) * 0.2,
            wingPhase: Math.random() * Math.PI * 2,
            wingSpeed: Math.random() * 0.1 + 0.08,
            size: Math.random() * 0.6 + 0.5
        };
    }

    function drawBird(b, time) {
        b.x += b.vx;
        b.y += b.vy;
        // 越界回绕
        if (b.x < -30) b.x = W + 30;
        if (b.x > W + 30) b.x = -30;
        if (b.y < H * 0.05) b.y = H * 0.05;
        if (b.y > H * 0.4) b.y = H * 0.4;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.fillStyle = 'rgba(45, 20, 30, 0.8)';
        var flap = Math.sin(b.wingPhase + time * b.wingSpeed);
        var span = 8 * b.size;
        // 左翼
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-span * 0.6, -span * flap, -span, -span * flap * 0.8);
        ctx.lineTo(-span * 0.9, 0);
        ctx.closePath();
        ctx.fill();
        // 右翼
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(span * 0.6, -span * flap, span, -span * flap * 0.8);
        ctx.lineTo(span * 0.9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // ============ 中央落日之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawSunsetHeart(time) {
        var cx = W / 2;
        var cy = H * 0.42;
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
            // 暖金色渐变
            var light = 60 + Math.sin(time * 0.002 + i * 0.5) * 10;
            ctx.beginPath();
            ctx.arc(px, py, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(40, 95%, ' + light + '%, ' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（落日金）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(255, 200, 110, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffd166';
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
        ctx.fillStyle = 'rgba(255, 236, 180,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：余晖光晕 ============
    function spawnSunsetGlow(x, y) {
        var total = Math.round((isMobile ? 24 : 36) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.5 + 0.8;
            var hue = 30 + Math.random() * 40;
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

    // ============ 暮色情话 ============
    var LOVE_LINES = [
        ['晚霞再美', '也不及你', '回眸时的那抹温柔'],
        ['把落日藏进眼里', '把黄昏写进心里', '余生都是你'],
        ['日落以后', '星辰与你', '皆为我的奔赴'],
        ['暖阳沉入海面', '而你沉入我心', '悄无声息'],
        ['黄昏的晚风', '吹过你的发梢', '也吹动我的心'],
        ['落日归山海', '山海藏深意', '我藏着你'],
        ['暮色四合', '灯火万家', '只想与你共赏'],
        ['把余晖撒满来路', '只想照亮', '你回家的方向']
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
            spawnSunsetGlow(lx, ly);
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
            ctx.shadowColor = '#ffd166';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#ffe9c9';
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
        drawSky(time);
        drawSun(time);
        drawGlints(time);

        // 飞鸟
        for (var i = 0; i < birds.length; i++) {
            drawBird(birds[i], time);
        }

        // 落日之心
        drawSunsetHeart(time);

        // 点击粒子（余晖光晕）
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#ffd166';
                ctx.shadowColor = '#ffd166';
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

        createSun();
        createGlints();
        birds = [];
        for (var i = 0; i < BIRD_COUNT; i++) birds.push(createBird());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnSunsetGlow(x, y);
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
    global.Sunset = {
        debug: function () {
            return {
                glints: glints.length,
                glowRays: glowRays.length,
                birds: birds.length,
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
