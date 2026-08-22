/* ============================================================
 * 月下柔情 moonlight.js（loveweb7 · 月光之恋）
 *
 * 主题：月光辉映下的温柔告白
 *   - 深蓝夜空 + 一轮圆月（环形光晕、月面微影）
 *   - 流星划过（星语心愿）
 *   - 城市剪影（灯光点点）
 *   - 银辉流萤（缓缓飘荡的光点）
 *   - 中央「月下之心」：月光色的心形，静静发光
 *   - 点击/触摸：银辉光晕扩散 + 月光情话浮现
 *   - 沿用 loveweb4/5/6 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/moonlight.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('moonlight');
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
    var particles = [];       // 点击光晕粒子
    var stars = [];           // 星星
    var meteors = [];         // 流星
    var fireflies = [];       // 银辉流萤
    var textBursts = [];      // 情话

    // ============ 夜空背景 ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0b1026');
        grad.addColorStop(0.5, '#141b3a');
        grad.addColorStop(1, '#1e2447');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 星星 ============
    var STAR_COUNT = Math.round((isMobile ? 50 : 80) * DENSITY);

    function createStars() {
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.7,
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
            ctx.fillStyle = 'rgba(220, 230, 255,' + alpha.toFixed(3) + ')';
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
            // 流星头
            ctx.beginPath();
            ctx.arc(met.x, met.y, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 250, 230,' + alpha.toFixed(3) + ')';
            ctx.fill();
            // 流星尾
            var tailLen = 18;
            var tailX = met.x - met.vx * tailLen;
            var tailY = met.y - met.vy * tailLen;
            var grad = ctx.createLinearGradient(met.x, met.y, tailX, tailY);
            grad.addColorStop(0, 'rgba(255,250,220,' + (alpha * 0.8).toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(255,250,220,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(met.x, met.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();
            if (met.life <= 0) meteors.splice(m, 1);
        }
    }

    // ============ 月亮 ============
    var moonX, moonY, moonR;

    function initMoon() {
        moonX = W * 0.5;
        moonY = H * 0.22;
        moonR = Math.min(W, H) * 0.1;
    }

    function drawMoon(time) {
        var breathe = 1 + Math.sin(time * 0.001) * 0.02;
        var r = moonR * breathe;

        // 大光晕
        var halo = ctx.createRadialGradient(moonX, moonY, r * 0.5, moonX, moonY, r * 4);
        halo.addColorStop(0, 'rgba(240, 235, 255, 0.35)');
        halo.addColorStop(0.4, 'rgba(200, 210, 255, 0.12)');
        halo.addColorStop(1, 'rgba(200, 210, 255, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(moonX, moonY, r * 4, 0, Math.PI * 2);
        ctx.fill();

        // 月体
        var moonGrad = ctx.createRadialGradient(
            moonX - r * 0.3, moonY - r * 0.3, r * 0.2,
            moonX, moonY, r
        );
        moonGrad.addColorStop(0, '#fffdf0');
        moonGrad.addColorStop(0.8, '#f5eedd');
        moonGrad.addColorStop(1, '#e8dfc8');
        ctx.fillStyle = moonGrad;
        ctx.beginPath();
        ctx.arc(moonX, moonY, r, 0, Math.PI * 2);
        ctx.fill();

        // 月面微影（环形山）
        ctx.fillStyle = 'rgba(200, 190, 170, 0.18)';
        ctx.beginPath();
        ctx.arc(moonX - r * 0.25, moonY - r * 0.2, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(moonX + r * 0.2, moonY + r * 0.15, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
    }

    // ============ 银辉流萤（月光下飘荡的光点） ============
    var FLY_COUNT = Math.round((isMobile ? 14 : 22) * DENSITY);

    function createFly() {
        return {
            x: Math.random() * W,
            y: H * (0.3 + Math.random() * 0.6),
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.2,
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: Math.random() * 0.04 + 0.02,
            r: Math.random() * 1.2 + 0.6,
            wander: Math.random() * 300
        };
    }

    function updateFly(f, dt) {
        f.wander -= dt;
        if (f.wander <= 0) {
            f.vx = (Math.random() - 0.5) * 0.4;
            f.vy = (Math.random() - 0.5) * 0.3;
            f.wander = Math.random() * 300 + 100;
        }
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.x < -10) f.x = W + 10;
        if (f.x > W + 10) f.x = -10;
        if (f.y < -10) f.y = H + 10;
        if (f.y > H + 10) f.y = -10;
    }

    function drawFly(f, time) {
        var glow = 0.5 + 0.5 * Math.sin(f.phase + time * 0.001 * f.phaseSpeed * 100);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230, 235, 255,' + (glow * 0.1).toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245, 245, 255,' + Math.max(0.15, glow).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 城市剪影 ============
    var cityWindows = [];

    function createCity() {
        cityWindows = [];
        var wCount = Math.round((isMobile ? 30 : 50) * DENSITY);
        for (var i = 0; i < wCount; i++) {
            cityWindows.push({
                x: Math.random() * W,
                y: H * (0.72 + Math.random() * 0.2),
                r: Math.random() * 1 + 0.5,
                tw: Math.random() * Math.PI * 2,
                sp: Math.random() * 0.02 + 0.005
            });
        }
    }

    function drawCity(time) {
        // 楼宇剪影（起伏的深色块）
        ctx.fillStyle = 'rgba(8, 12, 32, 0.92)';
        var buildingW = 60;
        for (var i = 0; i < W / buildingW + 1; i++) {
            var bh = H * (0.12 + Math.random() * 0.1) + Math.sin(i * 1.7) * H * 0.03;
            ctx.fillRect(i * buildingW, H - bh, buildingW - 4, bh);
        }
        // 万家灯火
        for (var j = 0; j < cityWindows.length; j++) {
            var w = cityWindows[j];
            var alpha = 0.3 + 0.4 * Math.abs(Math.sin(w.tw + time * w.sp * 40));
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 150,' + alpha.toFixed(3) + ')';
            ctx.fill();
        }
    }

    // ============ 中央月下之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawMoonHeart(time) {
        var cx = W / 2;
        var cy = H * 0.55;
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
            ctx.beginPath();
            ctx.arc(px, py, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(45, 90%, 80%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（月光金）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(255, 240, 190, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ffe9a8';
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
        ctx.fillStyle = 'rgba(255, 235, 180,' + (pulse * 0.6).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：银辉光晕扩散 ============
    function spawnMoonRipple(x, y) {
        var total = Math.round((isMobile ? 24 : 36) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.5 + 0.8;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                r: Math.random() * 3 + 1,
                alpha: 0.9,
                decay: 0.02,
                life: Math.random() * 30 + 30,
                hue: Math.random() > 0.5 ? 45 : 200
            });
        }
        pushParticle({
            heart: true,
            x: x, y: y,
            size: 10, alpha: 1, decay: 0.04, life: 30
        });
    }

    // ============ 月光情话 ============
    var LOVE_LINES = [
        ['月色落在你肩上', '便是我见过', '最温柔的时光'],
        ['月亮很圆', '风很温柔', '而你在我心上'],
        ['我把思念折成纸船', '放进月光里', '漂到你身边'],
        ['这月亮是为你而亮的', '就像我的心', '只为你跳动'],
        ['今夜月色真美', '风也温柔', '适合说爱你'],
        ['万家灯火亮起', '我唯独想', '留在你身边'],
        ['你踏月而来', '我便觉得', '这世间值得'],
        ['月色与雪色之间', '你是第三种', '绝色']
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
            var ly = H * (0.35 + Math.random() * 0.15);
            recordLoveTime();
            spawnMoonRipple(lx, ly);
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
            ctx.shadowColor = '#ffe9a8';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#fff3d6';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 银辉流萤
        for (var f = 0; f < fireflies.length; f++) {
            updateFly(fireflies[f], dt);
        }

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
        drawMoon(time);

        // 银辉流萤
        for (var f = 0; f < fireflies.length; f++) {
            drawFly(fireflies[f], time);
        }

        // 城市剪影
        drawCity(time);

        // 月下之心
        drawMoonHeart(time);

        // 点击粒子
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#ffe9a8';
                ctx.shadowColor = '#ffe9a8';
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
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, pp.r, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pp.hue + ',90%,80%,' + Math.max(0, pp.alpha).toFixed(3) + ')';
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
        initMoon();
        createCity();
        fireflies = [];
        for (var i = 0; i < FLY_COUNT; i++) fireflies.push(createFly());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnMoonRipple(x, y);
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
    global.Moonlight = {
        debug: function () {
            return {
                stars: stars.length,
                fireflies: fireflies.length,
                cityWindows: cityWindows.length,
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
