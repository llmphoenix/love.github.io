/* ============================================================
 * 落雪誓言 snowfall.js（loveweb9 · 冬雪告白）
 *
 * 主题：初雪飘落时的温暖誓言
 *   - 冬日暮色天空 + 远山雪线
 *   - 雪花结晶飘落（六角形雪花、大小层次、旋转飘舞）
 *   - 暖黄灯光小屋（窗口透出温暖）
 *   - 中央「雪中之心」：雪白色心形，静静发光
 *   - 点击/触摸：雪花旋舞 + 冬雪情话浮现
 *   - 沿用 loveweb4~8 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/snowfall.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('snowfall');
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
    var particles = [];       // 点击雪花旋舞粒子
    var snowflakes = [];      // 背景雪花
    var textBursts = [];      // 情话

    // ============ 冬日暮色背景 ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1e3a5f');   // 深冬蓝
        grad.addColorStop(0.45, '#3d5a80'); // 中蓝
        grad.addColorStop(0.75, '#98c1d9'); // 暮蓝
        grad.addColorStop(1, '#e0fbfc');    // 雪白地平线
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 远山雪线 ============
    function drawMountains() {
        ctx.fillStyle = 'rgba(30, 50, 80, 0.85)';
        // 远山轮廓
        ctx.beginPath();
        ctx.moveTo(0, H);
        ctx.lineTo(0, H * 0.72);
        for (var x = 0; x <= W; x += 20) {
            var y = H * 0.72 - Math.sin(x * 0.005) * H * 0.06 - Math.sin(x * 0.011 + 2) * H * 0.04;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();

        // 雪线（山脊的白色）
        ctx.fillStyle = 'rgba(240, 250, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(0, H * 0.74);
        for (var x2 = 0; x2 <= W; x2 += 20) {
            var y2 = H * 0.72 - Math.sin(x2 * 0.005) * H * 0.06 - Math.sin(x2 * 0.011 + 2) * H * 0.04;
            ctx.lineTo(x2, y2);
        }
        ctx.lineTo(W, H * 0.7);
        ctx.lineTo(0, H * 0.7);
        ctx.closePath();
        ctx.fill();
    }

    // ============ 暖黄小屋 ============
    var HUT_COUNT = isMobile ? 3 : 5;

    function drawHuts() {
        // 固定几座小屋（底部雪地）
        for (var i = 0; i < HUT_COUNT; i++) {
            var hx = (i + 0.6) * (W / (HUT_COUNT + 0.2));
            var hy = H * (0.86 + (i % 2) * 0.03);
            var hs = (W / HUT_COUNT) * 0.22;
            // 屋顶（三角，覆盖雪）
            ctx.fillStyle = '#4a3a55';
            ctx.beginPath();
            ctx.moveTo(hx - hs * 0.6, hy);
            ctx.lineTo(hx, hy - hs * 0.55);
            ctx.lineTo(hx + hs * 0.6, hy);
            ctx.closePath();
            ctx.fill();
            // 屋顶积雪
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath();
            ctx.moveTo(hx - hs * 0.55, hy - 2);
            ctx.lineTo(hx, hy - hs * 0.5);
            ctx.lineTo(hx + hs * 0.55, hy - 2);
            ctx.lineTo(hx, hy - 6);
            ctx.closePath();
            ctx.fill();
            // 屋身
            ctx.fillStyle = '#5c4a6e';
            ctx.fillRect(hx - hs * 0.5, hy, hs, hs * 0.45);
            // 窗户（暖黄光）
            var glow = 0.6 + 0.4 * Math.abs(Math.sin(i * 2.1 + performance.now() * 0.001));
            ctx.fillStyle = 'rgba(255, 200, 100,' + (0.5 + glow * 0.5).toFixed(3) + ')';
            ctx.shadowColor = '#ffd080';
            ctx.shadowBlur = 12;
            ctx.fillRect(hx - hs * 0.3, hy + hs * 0.1, hs * 0.22, hs * 0.22);
            ctx.shadowBlur = 0;
        }
        // 地面雪
        ctx.fillStyle = 'rgba(240, 250, 255, 0.95)';
        ctx.fillRect(0, H * 0.95, W, H * 0.05);
    }

    // ============ 雪花 ============
    var SNOW_COUNT = Math.round((isMobile ? 55 : 90) * DENSITY);

    function createSnow() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 2.5 + 1,
            vy: Math.random() * 1.2 + 0.4,
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.02 + 0.01,
            swayAmp: Math.random() * 25 + 10,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.05,
            alpha: Math.random() * 0.5 + 0.4,
            // 六角雪花显示比例（部分用六角，部分圆点省性能）
            crystal: Math.random() > 0.5
        };
    }

    function drawSnowflake(s, time) {
        var x = s.x + Math.sin(s.sway + time * 0.001 * s.swaySpeed * 1000) * s.swayAmp * 0.01;
        ctx.save();
        ctx.translate(x, s.y);
        ctx.rotate(s.rot);
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = '#ffffff';
        if (s.crystal && s.r > 1.8) {
            // 六角雪花（简洁绘制）
            for (var arm = 0; arm < 6; arm++) {
                var ang = (Math.PI / 3) * arm;
                ctx.save();
                ctx.rotate(ang);
                ctx.fillRect(0, -s.r * 0.15, s.r, s.r * 0.3);
                ctx.fillRect(s.r * 0.7, -s.r * 0.25, s.r * 0.35, s.r * 0.5);
                ctx.restore();
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, s.r * 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ============ 中央雪中之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawSnowHeart(time) {
        var cx = W / 2;
        var cy = H * 0.4;
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
            ctx.fillStyle = 'hsla(210, 60%, 90%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（雪白透蓝）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(230, 245, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#bfe3ff';
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
        ctx.fillStyle = 'rgba(240, 250, 255,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：雪花旋舞 ============
    function spawnSnowSwirl(x, y) {
        var total = Math.round((isMobile ? 24 : 36) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.2 + 0.7;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                r: Math.random() * 2.5 + 1,
                alpha: 0.9,
                decay: 0.02,
                life: Math.random() * 30 + 30,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.1
            });
        }
        pushParticle({
            heart: true,
            x: x, y: y,
            size: 10, alpha: 1, decay: 0.04, life: 30
        });
    }

    // ============ 冬雪情话 ============
    var LOVE_LINES = [
        ['今冬的雪都落尽了', '我还是想', '和你一起白头'],
        ['雪是天空的告白', '每一片都写着', '我喜欢你'],
        ['想在这初雪天', '牵你的手', '走完这一生'],
        ['下雪的时候', '世界都安静了', '只剩心跳和想你'],
        ['你在雪里回头', '那一瞬', '我便把余生交给了你'],
        ['陪你淋一场雪', '也算', '共白头了'],
        ['冬天的风很冷', '但想到你', '心里就暖了'],
        ['雪落无声', '爱你有声', '响彻整个冬天']
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
            spawnSnowSwirl(lx, ly);
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
            ctx.shadowColor = '#bfe3ff';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#eef7ff';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 背景雪花飘落
        for (var i = 0; i < snowflakes.length; i++) {
            var s = snowflakes[i];
            s.y += s.vy * dt;
            s.rot += s.rotSpeed * dt;
            s.sway += s.swaySpeed * dt;
            if (s.y > H + 20) {
                snowflakes[i] = createSnow();
                snowflakes[i].y = -10;
            }
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
        drawMountains();

        // 背景雪花
        for (var i = 0; i < snowflakes.length; i++) {
            drawSnowflake(snowflakes[i], time);
        }

        // 雪中之心
        drawSnowHeart(time);

        // 暖黄小屋（覆盖在雪上，营造冬日暖意）
        drawHuts();

        // 点击粒子（雪花旋舞）
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#bfe3ff';
                ctx.shadowColor = '#bfe3ff';
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
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(0, 0, pp.r, 0, Math.PI * 2);
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

        snowflakes = [];
        for (var i = 0; i < SNOW_COUNT; i++) snowflakes.push(createSnow());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnSnowSwirl(x, y);
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
    global.Snowfall = {
        debug: function () {
            return {
                snowflakes: snowflakes.length,
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
