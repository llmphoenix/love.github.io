/* ============================================================
 * 萤火森林 forest.js（loveweb10 · 森林之恋）
 *
 * 主题：幽深森林里萤火虫与月光交织的静谧浪漫
 *   - 深绿夜空 + 月光斑驳
 *   - 树木剪影（层次感）
 *   - 萤火虫群（大量、自主飞舞、发光呼吸）
 *   - 飘落的光点（林间星光）
 *   - 中央「林中心」：萤绿色的心形，静静发亮
 *   - 点击/触摸：萤火虫群涌向点击点 + 森林情话浮现
 *   - 沿用 loveweb4~9 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/forest.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('forest');
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
    var particles = [];       // 点击萤火粒子
    var fireflies = [];       // 萤火虫群
    var sparks = [];          // 林间飘落光点
    var textBursts = [];      // 情话

    // ============ 森林夜空背景 ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0a1f16');
        grad.addColorStop(0.5, '#0d2b1e');
        grad.addColorStop(1, '#123527');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // 月光洒落（顶部暖白光晕）
        var moonGlow = ctx.createRadialGradient(W * 0.5, 0, 10, W * 0.5, 0, H * 0.6);
        moonGlow.addColorStop(0, 'rgba(200, 230, 200, 0.15)');
        moonGlow.addColorStop(1, 'rgba(200, 230, 200, 0)');
        ctx.fillStyle = moonGlow;
        ctx.fillRect(0, 0, W, H * 0.6);
    }

    // ============ 树木剪影 ============
    var trees = [];

    function createTrees() {
        trees = [];
        var count = Math.round((isMobile ? 6 : 9) * DENSITY);
        for (var i = 0; i < count; i++) {
            var layer = i % 3; // 3 层远近
            trees.push({
                x: (i / count) * W + Math.random() * 40,
                w: (Math.random() * 60 + 40) * (1 + layer * 0.2),
                h: H * (0.35 + Math.random() * 0.25) * (1 + layer * 0.1),
                layer: layer,
                lean: (Math.random() - 0.5) * 0.2
            });
        }
    }

    function drawTrees() {
        // 从远到近绘制（远的淡，近的浓）
        for (var l = 0; l < 3; l++) {
            for (var i = 0; i < trees.length; i++) {
                var t = trees[i];
                if (t.layer !== l) continue;
                var alpha = 0.35 + t.layer * 0.25;
                ctx.fillStyle = 'rgba(4, 16, 10,' + alpha.toFixed(3) + ')';
                var trunkW = t.w * 0.12;
                var x = t.x;
                // 树干
                ctx.fillRect(x - trunkW / 2, t.h, trunkW, H - t.h);
                // 树冠（多个圆）
                var crownY = t.h;
                var crownR = t.w * 0.3;
                for (var c = 0; c < 5; c++) {
                    var cx = x + (c - 2) * crownR * 0.5 + t.lean * t.h * 0.2;
                    var cy = crownY - Math.abs(c - 2) * crownR * 0.4;
                    ctx.beginPath();
                    ctx.arc(cx, cy, crownR * (1 - Math.abs(c - 2) * 0.15), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    // ============ 萤火虫群 ============
    var FLY_COUNT = Math.round((isMobile ? 26 : 40) * DENSITY);

    function createFly() {
        return {
            x: Math.random() * W,
            y: H * (0.25 + Math.random() * 0.7),
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.3,
            tx: Math.random() * W,
            ty: H * (0.25 + Math.random() * 0.7),
            wander: Math.random() * 200,
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: Math.random() * 0.05 + 0.02,
            r: Math.random() * 1.4 + 0.6,
            hue: 75 + Math.random() * 40  // 黄绿
        };
    }

    function updateFly(f, dt) {
        f.wander -= dt;
        if (f.wander <= 0) {
            f.tx = Math.random() * W;
            f.ty = H * (0.25 + Math.random() * 0.7);
            f.wander = Math.random() * 300 + 100;
        }
        var dx = f.tx - f.x;
        var dy = f.ty - f.y;
        var dist = Math.hypot(dx, dy) || 1;
        var sp = 0.15;
        f.x += (dx / dist) * sp * dt;
        f.y += (dy / dist) * sp * dt;
        f.x += (Math.random() - 0.5) * 0.3;
        f.y += (Math.random() - 0.5) * 0.3;
    }

    function drawFly(f, time) {
        var glow = 0.5 + 0.5 * Math.sin(f.phase + time * 0.001 * f.phaseSpeed * 100);
        var alpha = Math.max(0.1, glow);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + f.hue + ',90%,60%,' + (alpha * 0.12).toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = 'hsla(' + f.hue + ',100%,70%,' + alpha.toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 林间飘落光点 ============
    var SPARK_COUNT = Math.round((isMobile ? 18 : 30) * DENSITY);

    function createSpark() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.5 + 0.5,
            vy: Math.random() * 0.5 + 0.2,
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.02 + 0.01,
            phase: Math.random() * Math.PI * 2,
            alpha: Math.random() * 0.4 + 0.2
        };
    }

    function drawSpark(s, time) {
        s.y += s.vy;
        s.sway += s.swaySpeed;
        if (s.y > H + 10) {
            s.y = -5;
            s.x = Math.random() * W;
        }
        var tw = 0.6 + 0.4 * Math.sin(s.phase + time * 0.003);
        ctx.beginPath();
        ctx.arc(s.x + Math.sin(s.sway) * 10, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(210, 255, 210,' + (s.alpha * tw).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 中央林中心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawForestHeart(time) {
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
            ctx.fillStyle = 'hsla(85, 90%, 65%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（萤绿）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(180, 255, 150, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#a8ff7f';
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
        ctx.fillStyle = 'rgba(200, 255, 170,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：萤火群涌向点击点 ============
    function spawnFlyBurst(x, y) {
        var total = Math.round((isMobile ? 26 : 40) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.5 + 0.8;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                r: Math.random() * 1.8 + 0.8,
                hue: 75 + Math.random() * 40,
                alpha: 1,
                decay: 0.02,
                life: Math.random() * 30 + 30,
                phase: Math.random() * Math.PI * 2
            });
        }
        pushParticle({
            heart: true,
            x: x, y: y,
            size: 10, alpha: 1, decay: 0.04, life: 30
        });
    }

    // ============ 森林情话 ============
    var LOVE_LINES = [
        ['走进这片森林', '满眼萤火', '都是想你的光'],
        ['森林深处有萤火', '我心底深处', '有你'],
        ['你像森林里的月光', '穿过层层树影', '落在我心上'],
        ['愿化作一只萤火虫', '陪你在黑暗里', '把路照亮'],
        ['风吹过林间', '萤火纷飞', '每一只都写着喜欢你'],
        ['这片森林很大', '可我的目光', '始终只追随你'],
        ['林深时见鹿', '梦醒时见你', '是此生幸事'],
        ['我把爱藏进树洞', '等萤火虫', '替我说给你听']
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
            spawnFlyBurst(lx, ly);
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
            ctx.shadowColor = '#a8ff7f';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#eaffdc';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 萤火虫
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

        // 背景树木（中远层）
        for (var i = 0; i < trees.length; i++) {
            if (trees[i].layer < 2) drawTreeSingle(trees[i]);
        }

        // 林间飘落光点
        for (var s = 0; s < sparks.length; s++) {
            drawSpark(sparks[s], time);
        }

        // 萤火虫群
        for (var f = 0; f < fireflies.length; f++) {
            drawFly(fireflies[f], time);
        }

        // 林中心
        drawForestHeart(time);

        // 前景树木（近层，覆盖营造层次）
        for (var i2 = 0; i2 < trees.length; i2++) {
            if (trees[i2].layer === 2) drawTreeSingle(trees[i2]);
        }

        // 点击粒子
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#a8ff7f';
                ctx.shadowColor = '#a8ff7f';
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
                var glow = 0.6 + 0.4 * Math.sin(pp.phase + performance.now() * 0.003);
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, pp.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pp.hue + ',90%,60%,' + (Math.max(0, pp.alpha) * 0.12).toFixed(3) + ')';
                ctx.fill();
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, pp.r * 1.5, 0, Math.PI * 2);
                ctx.fillStyle = 'hsla(' + pp.hue + ',100%,70%,' + (Math.max(0, pp.alpha) * glow).toFixed(3) + ')';
                ctx.fill();
            }
        }

        // 情话
        drawTextBursts();
    }

    function drawTreeSingle(t) {
        var alpha = 0.35 + t.layer * 0.25;
        ctx.fillStyle = 'rgba(4, 16, 10,' + alpha.toFixed(3) + ')';
        var trunkW = t.w * 0.12;
        var x = t.x;
        ctx.fillRect(x - trunkW / 2, t.h, trunkW, H - t.h);
        var crownY = t.h;
        var crownR = t.w * 0.3;
        for (var c = 0; c < 5; c++) {
            var cx = x + (c - 2) * crownR * 0.5 + t.lean * t.h * 0.2;
            var cy = crownY - Math.abs(c - 2) * crownR * 0.4;
            ctx.beginPath();
            ctx.arc(cx, cy, crownR * (1 - Math.abs(c - 2) * 0.15), 0, Math.PI * 2);
            ctx.fill();
        }
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

        createTrees();
        fireflies = [];
        for (var i = 0; i < FLY_COUNT; i++) fireflies.push(createFly());
        sparks = [];
        for (var j = 0; j < SPARK_COUNT; j++) sparks.push(createSpark());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnFlyBurst(x, y);
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
    global.Forest = {
        debug: function () {
            return {
                trees: trees.length,
                fireflies: fireflies.length,
                sparks: sparks.length,
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
