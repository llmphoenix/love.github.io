/* ============================================================
 * 花雨之约 blossom.js（loveweb11 · 樱花之恋）
 *
 * 主题：樱花漫天飞舞的春日告白
 *   - 粉白天际渐变 + 淡云
 *   - 樱花树剪影（远景）+ 飘落花瓣（大量、多色、旋转）
 *   - 花瓣旋风（偶然出现）
 *   - 中央「花中之心」：樱花粉的心形，散发柔光
 *   - 点击/触摸：花瓣雨集中飘落 + 樱花情话浮现
 *   - 沿用 loveweb4~10 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/blossom.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('blossom');
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
    var particles = [];       // 点击花瓣粒子
    var petals = [];          // 背景飘落花瓣
    var textBursts = [];      // 情话

    // ============ 粉白天际背景 ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#fdf2f8');   // 极浅粉
        grad.addColorStop(0.5, '#fce7f3'); // 浅粉
        grad.addColorStop(1, '#fbcfe8');   // 樱花粉
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 淡云 ============
    var clouds = [];

    function createClouds() {
        clouds = [];
        var count = isMobile ? 4 : 6;
        for (var i = 0; i < count; i++) {
            clouds.push({
                x: Math.random() * W,
                y: H * (0.05 + Math.random() * 0.25),
                w: Math.random() * 180 + 80,
                speed: Math.random() * 0.15 + 0.05,
                alpha: Math.random() * 0.25 + 0.15
            });
        }
    }

    function drawClouds(time) {
        for (var i = 0; i < clouds.length; i++) {
            var c = clouds[i];
            c.x += c.speed;
            if (c.x > W + 150) c.x = -150;
            ctx.globalAlpha = c.alpha;
            ctx.fillStyle = '#ffffff';
            for (var p = 0; p < 4; p++) {
                var px = c.x - c.w * 0.3 + (p / 3) * c.w * 0.6;
                var py = c.y + Math.sin(p * 1.4) * 12;
                ctx.beginPath();
                ctx.arc(px, py, c.w * 0.18, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    // ============ 樱花树剪影 ============
    function drawTrees() {
        ctx.fillStyle = 'rgba(190, 130, 160, 0.5)';
        // 底部樱树林（圆形树冠）
        for (var i = 0; i < (isMobile ? 5 : 8); i++) {
            var x = (i / 8) * W + 40;
            var r = 30 + (i % 3) * 15;
            // 树干
            ctx.fillStyle = 'rgba(120, 80, 100, 0.5)';
            ctx.fillRect(x - 4, H * 0.85, 8, H * 0.15);
            // 树冠
            ctx.fillStyle = 'rgba(240, 180, 200, 0.5)';
            for (var c = 0; c < 5; c++) {
                ctx.beginPath();
                ctx.arc(x + (c - 2) * r * 0.4, H * 0.83 - Math.abs(c - 2) * r * 0.35, r * (0.6 + (c % 3) * 0.15), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // 地面
        ctx.fillStyle = 'rgba(240, 190, 210, 0.4)';
        ctx.fillRect(0, H * 0.95, W, H * 0.05);
    }

    // ============ 飘落花瓣 ============
    var PETAL_COLORS = ['#ffb7c5', '#ffc2d1', '#ffd6e0', '#f8c8dc', '#f9a8d4', '#fbcfe8'];
    var PETAL_COUNT = Math.round((isMobile ? 40 : 65) * DENSITY);

    function createPetal() {
        return {
            x: Math.random() * W,
            y: Math.random() * H - H,
            size: (Math.random() * 10 + 6) * (isMobile ? 0.85 : 1),
            vx: (Math.random() - 0.5) * 0.6,
            vy: Math.random() * 1 + 0.5,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.05,
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.02 + 0.01,
            swayAmp: Math.random() * 30 + 15,
            color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
            alpha: Math.random() * 0.5 + 0.4,
            layer: Math.random()
        };
    }

    function drawPetal(p, time) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + Math.sin(p.sway + time * 0.001) * 0.3);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        // 花瓣形（五瓣简化为弧线）
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-p.size * 0.5, -p.size * 0.5, -p.size * 0.8, p.size * 0.2, 0, p.size * 0.7);
        ctx.bezierCurveTo(p.size * 0.8, p.size * 0.2, p.size * 0.5, -p.size * 0.5, 0, 0);
        ctx.fill();
        ctx.restore();
    }

    // ============ 花瓣旋风（偶然出现） ============
    var nextSwirl = 0;
    function maybeSwirl(time) {
        if (time > nextSwirl) {
            var sx = Math.random() * W;
            var sy = H * (0.3 + Math.random() * 0.3);
            var n = Math.round((isMobile ? 10 : 16) * DENSITY * dilutionFactor);
            for (var i = 0; i < n; i++) {
                pushParticle({
                    x: sx, y: sy,
                    vx: (Math.random() - 0.5) * 2.5,
                    vy: (Math.random() - 0.5) * 2.5 - 0.5,
                    rot: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.15,
                    size: Math.random() * 9 + 5,
                    color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
                    alpha: 1, decay: 0.015, life: Math.random() * 30 + 30,
                    spiral: true
                });
            }
            nextSwirl = time + (isMobile ? 8000 : 5000) * (0.7 + Math.random() * 0.6);
        }
    }

    // ============ 中央花中之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawBlossomHeart(time) {
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
            ctx.beginPath();
            ctx.arc(px, py, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(335, 90%, 80%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（樱花粉）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(255, 170, 200, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#f9a8d4';
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
        ctx.fillStyle = 'rgba(255, 220, 235,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：花瓣雨集中飘落 ============
    function spawnPetalRain(x, y) {
        var total = Math.round((isMobile ? 26 : 40) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.5 + 0.8;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp + 0.5,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.15,
                size: Math.random() * 9 + 5,
                color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
                alpha: 1, decay: 0.018, life: Math.random() * 30 + 30
            });
        }
        pushParticle({
            heart: true,
            x: x, y: y,
            size: 10, alpha: 1, decay: 0.04, life: 30
        });
    }

    // ============ 樱花情话 ============
    var LOVE_LINES = [
        ['樱花落下的速度', '是每秒五厘米', '而我走向你的心', '是一瞬'],
        ['满树繁花', '不及你回眸一笑', '半分温柔'],
        ['花开是春的信', '花落是风的诗', '而你是我的人间'],
        ['樱花树下', '落英缤纷', '我眼里只有你'],
        ['愿陪你走过', '每一场花雨', '从春到冬'],
        ['你是四月的风', '吹开满树樱花', '也吹进我心里'],
        ['花雨如约而至', '正如我', '如约爱你'],
        ['人间四月芳菲尽', '山中桃花始盛开', '而你四季常在']
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
            spawnPetalRain(lx, ly);
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
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#8a1e4d';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 背景花瓣飘落
        for (var i = 0; i < petals.length; i++) {
            var p = petals[i];
            p.y += p.vy * dt;
            p.x += p.vx * dt + Math.sin(p.sway + time * 0.001 * p.swaySpeed * 1000) * 0.3 * dt;
            p.rot += p.rotSpeed * dt;
            p.sway += p.swaySpeed * dt;
            if (p.y > H + 30) { petals[i] = createPetal(); }
            if (p.x < -30) p.x = W + 20;
            if (p.x > W + 30) p.x = -20;
        }

        // 点击粒子
        for (var q = particles.length - 1; q >= 0; q--) {
            var pp = particles[q];
            pp.life--;
            if (pp.life <= 0) { particles.splice(q, 1); continue; }
            pp.x += pp.vx;
            pp.y += pp.vy;
            pp.alpha -= pp.decay;
            if (pp.alpha < 0) pp.alpha = 0;
        }
    }

    function draw(time) {
        drawSky();
        drawClouds(time);
        drawTrees();

        // 背景花瓣
        for (var i = 0; i < petals.length; i++) {
            drawPetal(petals[i], time);
        }

        // 花中之心
        drawBlossomHeart(time);

        // 点击/旋涡粒子
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#f9a8d4';
                ctx.shadowColor = '#f9a8d4';
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
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.rotate(pp.rot || 0);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = pp.color;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.bezierCurveTo(-pp.size * 0.5, -pp.size * 0.5, -pp.size * 0.8, pp.size * 0.2, 0, pp.size * 0.7);
                ctx.bezierCurveTo(pp.size * 0.8, pp.size * 0.2, pp.size * 0.5, -pp.size * 0.5, 0, 0);
                ctx.fill();
                ctx.restore();
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
        maybeSwirl(time);

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

        createClouds();
        petals = [];
        for (var i = 0; i < PETAL_COUNT; i++) petals.push(createPetal());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnPetalRain(x, y);
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
    global.Blossom = {
        debug: function () {
            return {
                clouds: clouds.length,
                petals: petals.length,
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
