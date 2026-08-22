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
    var roseParticles = [];   // 中央玫瑰的粒子
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

    // ============ 中央爱之玫瑰（粒子构成，缓缓旋转绽放） ============
    var roseAngle = 0;
    var ROSE_COUNT = Math.round((isMobile ? 90 : 130) * DENSITY);

    function createRose() {
        roseParticles = [];
        for (var i = 0; i < ROSE_COUNT; i++) {
            // 用玫瑰参数方程：r = a * sin(3θ) + 心形混合，生成花瓣状分布
            var t = (Math.PI * 2 * i) / ROSE_COUNT;
            var rose = Math.abs(Math.sin(3 * t)) * 0.6 + 0.4; // 3瓣玫瑰基础
            var heart = 16 * Math.pow(Math.abs(Math.sin(t)), 3); // 心形
            var mix = 0.55 * rose + 0.45 * (heart / 16);
            var r = mix * 60;
            var hue = 340 + Math.sin(i * 0.5) * 30; // 玫红~粉
            roseParticles.push({
                baseT: t,
                baseR: r,
                orbitR: r,          // 到中心距离
                orbitSpeed: 0.0015 * (Math.random() > 0.5 ? 1 : -1), // 有的逆时针
                phase: Math.random() * Math.PI * 2,
                hue: hue,
                size: Math.random() * 2 + 1.2,
                alpha: 0.7,
                y: (Math.random() - 0.5) * 10
            });
        }
    }

    function drawRose(time) {
        var cx = W / 2;
        var cy = H * 0.4;
        roseAngle += 0.004;
        var breathe = 1 + Math.sin(time * 0.001) * 0.03; // 呼吸缩放

        for (var i = 0; i < roseParticles.length; i++) {
            var rp = roseParticles[i];
            var a = rp.baseT + roseAngle + rp.phase * 0.01;
            var x = cx + Math.cos(a) * rp.orbitR * breathe;
            var y = cy + Math.sin(a) * rp.orbitR * breathe + rp.y;

            // 发光花瓣粒子
            var tw = 0.7 + 0.3 * Math.sin(rp.phase + time * 0.003);
            ctx.beginPath();
            ctx.arc(x, y, rp.size * (0.8 + tw * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + rp.hue + ',80%,65%,' + (rp.alpha * tw * 0.85).toFixed(3) + ')';
            ctx.fill();
            // 光晕
            ctx.beginPath();
            ctx.arc(x, y, rp.size * 3, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + rp.hue + ',80%,65%,' + (rp.alpha * tw * 0.12).toFixed(3) + ')';
            ctx.fill();
        }

        // 花心亮光
        ctx.beginPath();
        ctx.arc(cx, cy, 6 + Math.sin(time * 0.002) * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 220, 0.35)';
        ctx.fill();
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
        createRose();
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
    global.Roses = {
        debug: function () {
            return {
                petals: petals.length,
                fireflies: fireflies.length,
                roseParticles: roseParticles.length,
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
