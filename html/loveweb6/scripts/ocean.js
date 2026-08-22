/* ============================================================
 * 海洋之心 ocean.js（loveweb6 · 深海之恋）
 *
 * 主题：潜入深海，静默深情的浪漫
 *   - 海面光线穿透（摇曳光束）
 *   - 气泡缓缓上升（大小、透明度、折射光）
 *   - 水母优雅漂浮（触手摇曳、发光呼吸）
 *   - 鱼群穿梭游动
 *   - 中央「海洋之心」：发光的心形宝石，静静呼吸脉动
 *   - 点击/触摸：爱心气泡喷涌 + 海洋情话浮现
 *   - 沿用 loveweb4/5 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/ocean.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('ocean');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var W = 0, H = 0, DPR = 1;

    // 移动端判断
    var isMobile = window.innerWidth <= 480;

    // 粒子数量比例（移动端降低密度）
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
    var particles = [];       // 点击喷涌的气泡粒子
    var bubbles = [];         // 背景上升气泡
    var jellies = [];         // 水母
    var fishes = [];          // 鱼群
    var textBursts = [];      // 情话

    // ============ 深海背景（上浅下深） ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0e7490');   // 海面浅青
        grad.addColorStop(0.35, '#155e75'); // 中青
        grad.addColorStop(0.7, '#0c4a6e');  // 深青
        grad.addColorStop(1, '#082f49');    // 深海蓝
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // 顶部海面微光（透光带）
        var lightGrad = ctx.createLinearGradient(0, 0, 0, H * 0.3);
        lightGrad.addColorStop(0, 'rgba(190, 242, 255, 0.12)');
        lightGrad.addColorStop(1, 'rgba(190, 242, 255, 0)');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, W, H * 0.3);
    }

    // ============ 海面光束（摇曳光柱） ============
    var beams = [];
    var BEAM_COUNT = isMobile ? 4 : 6;

    function createBeams() {
        beams = [];
        for (var i = 0; i < BEAM_COUNT; i++) {
            beams.push({
                x: Math.random() * W,
                w: Math.random() * 60 + 30,
                sway: Math.random() * Math.PI * 2,
                swaySpeed: Math.random() * 0.002 + 0.001,
                alpha: Math.random() * 0.08 + 0.04
            });
        }
    }

    function drawBeams(time) {
        for (var i = 0; i < beams.length; i++) {
            var b = beams[i];
            var sway = Math.sin(b.sway + time * b.swaySpeed) * 20;
            var x = b.x + sway;
            var grad = ctx.createLinearGradient(x, 0, x + b.w, H * 0.8);
            grad.addColorStop(0, 'rgba(190, 242, 255,' + b.alpha.toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(190, 242, 255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + b.w * 0.4, 0);
            ctx.lineTo(x + b.w, H * 0.8);
            ctx.lineTo(x + b.w * 0.6, H * 0.8);
            ctx.closePath();
            ctx.fill();
        }
    }

    // ============ 气泡 ============
    var BUBBLE_COUNT = Math.round((isMobile ? 28 : 45) * DENSITY);

    function createBubble() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 5 + 1.5,
            vy: Math.random() * 0.8 + 0.3,   // 上升速度
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.02 + 0.01,
            alpha: Math.random() * 0.3 + 0.15,
            wobble: Math.random() * 0.04 + 0.02
        };
    }

    function drawBubble(b, time) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(210, 240, 255,' + b.alpha.toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
        // 高光点（折射）
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,' + (b.alpha * 0.6).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 水母 ============
    var JELLY_COUNT = Math.round((isMobile ? 3 : 5) * DENSITY);

    function createJelly() {
        return {
            x: Math.random() * W,
            y: H * (0.3 + Math.random() * 0.6),
            r: Math.random() * 30 + 20,
            vy: (Math.random() - 0.5) * 0.3,     // 缓慢上下
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.01 + 0.005,
            phase: Math.random() * Math.PI * 2,
            hue: [190, 210, 280, 330][Math.floor(Math.random() * 4)], // 青/蓝/紫/粉
            alpha: Math.random() * 0.25 + 0.2,
            tentacles: 6
        };
    }

    function drawJelly(j, time) {
        var pulse = Math.sin(j.phase + time * 0.002);
        var r = j.r * (1 + pulse * 0.08); // 呼吸收缩

        ctx.save();
        ctx.translate(j.x, j.y);

        // 触手（摇曳的线）
        ctx.strokeStyle = 'hsla(' + j.hue + ',80%,70%,' + (j.alpha * 0.6).toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        for (var t = 0; t < j.tentacles; t++) {
            var ang = Math.PI * 0.5 + (t - (j.tentacles - 1) / 2) * 0.35;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * r * 0.6, r * 0.5);
            var tentLen = r * (1.4 + pulse * 0.3);
            for (var s = 1; s <= 6; s++) {
                var seg = s / 6;
                var sx = Math.cos(ang) * r * 0.6 * (1 - seg * 0.4) + Math.sin(j.sway + time * 0.002 + s * 0.5) * seg * r * 0.4;
                var sy = r * 0.5 + seg * tentLen;
                ctx.lineTo(sx, sy);
            }
            ctx.stroke();
        }

        // 伞面（半透明发光）
        var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, 'hsla(' + j.hue + ',90%,75%,' + j.alpha.toFixed(3) + ')');
        grad.addColorStop(1, 'hsla(' + j.hue + ',90%,55%,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // ============ 鱼群 ============
    var FISH_COUNT = Math.round((isMobile ? 8 : 14) * DENSITY);

    function createFish() {
        var dir = Math.random() > 0.5 ? 1 : -1;
        return {
            x: dir > 0 ? -30 : W + 30,
            y: H * (0.2 + Math.random() * 0.6),
            size: Math.random() * 12 + 8,
            speed: Math.random() * 1 + 0.5,
            dir: dir,
            wave: Math.random() * Math.PI * 2,
            color: ['#67e8f9', '#7dd3fc', '#a5b4fc', '#f0abfc'][Math.floor(Math.random() * 4)]
        };
    }

    function updateFish(f, dt) {
        f.x += f.dir * f.speed * dt;
        f.wave += 0.05 * dt;
        if (f.dir > 0 && f.x > W + 40) {
            Object.assign(f, createFish());
            f.dir = -1;
        } else if (f.dir < 0 && f.x < -40) {
            Object.assign(f, createFish());
            f.dir = 1;
        }
    }

    function drawFish(f, time) {
        ctx.save();
        ctx.translate(f.x, f.y + Math.sin(f.wave) * 4);
        ctx.scale(f.dir, 1);

        // 鱼身
        ctx.beginPath();
        ctx.ellipse(0, 0, f.size, f.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 0.75;
        ctx.fill();
        // 尾巴（摆动）
        var tailW = Math.sin(f.wave + time * 0.01) * 0.4;
        ctx.beginPath();
        ctx.moveTo(-f.size * 0.7, 0);
        ctx.lineTo(-f.size * 1.3, -f.size * 0.4 + tailW * f.size);
        ctx.lineTo(-f.size * 1.3, f.size * 0.4 + tailW * f.size);
        ctx.closePath();
        ctx.fill();
        // 眼睛
        ctx.beginPath();
        ctx.arc(f.size * 0.4, -f.size * 0.12, f.size * 0.09, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.restore();
    }

    // ============ 中央海洋之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 70 : 100) * DENSITY);

    function drawOceanHeart(time) {
        var cx = W / 2;
        var cy = H * 0.42;
        heartAngle += 0.003;
        var breathe = 1 + Math.sin(time * 0.0012) * 0.06; // 心跳呼吸

        // 心形粒子（发光蓝宝石）
        for (var i = 0; i < HEART_COUNT; i++) {
            var t = (Math.PI * 2 * i) / HEART_COUNT;
            // 心形参数方程
            var hx = 16 * Math.pow(Math.sin(t), 3);
            var hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            var len = Math.hypot(hx, hy) || 1;
            // 每个粒子绕心形轨道 + 微小抖动
            var r = 34 * breathe;
            var orbit = r * (1 + Math.sin(heartAngle * 20 + i * 0.7) * 0.06);
            var px = cx + hx / 16 * orbit + Math.sin(heartAngle * 2 + i) * 2;
            var py = cy + hy / 16 * orbit + Math.cos(heartAngle * 2 + i) * 2;

            var tw = 0.6 + 0.4 * Math.sin(time * 0.004 + i * 0.3);
            ctx.beginPath();
            ctx.arc(px, py, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(195, 90%, 65%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#7dd3fc';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        for (var j = 0; j <= 120; j++) {
            var a = (Math.PI * 2 * j) / 120;
            var sx = (16 * Math.pow(Math.sin(a), 3)) * 2.2;
            var sy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 2.2;
            if (j === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.restore();

        // 中心亮光（心跳）
        var pulse = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.002));
        ctx.beginPath();
        ctx.arc(cx, cy, 5 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(165, 243, 252,' + (pulse * 0.6).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：爱心气泡喷涌 ============
    function spawnBubbleBurst(x, y) {
        var total = Math.round((isMobile ? 20 : 30) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.5 + 0.8;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 1,  // 略向上
                r: Math.random() * 4 + 1.5,
                alpha: 0.9,
                decay: 0.02,
                life: Math.random() * 30 + 30,
                sway: Math.random() * Math.PI * 2
            });
        }
        // 中心爱心闪光
        pushParticle({
            heart: true,
            x: x, y: y,
            size: 10, alpha: 1, decay: 0.04, life: 30
        });
    }

    // ============ 海洋情话 ============
    var LOVE_LINES = [
        ['深海两万里', '也不及我对你', '沉入心底的深情'],
        ['你是海上的灯塔', '让我漂泊的心', '终于有了归途'],
        ['海水是咸的', '眼泪是苦的', '而你是甜的'],
        ['愿沉入你的深海', '做一颗小小的珍珠', '被你温柔包裹'],
        ['海枯石烂', '沧海桑田', '唯有爱你不变'],
        ['我见过最深的海', '也见过最亮的心', '都在你眼里'],
        ['你在岸上吹风', '我在海里做梦', '梦见的都是你'],
        ['海浪拍岸千万遍', '如同我说爱你', '一遍又一遍']
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
            spawnBubbleBurst(lx, ly);
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
            ctx.shadowColor = '#67e8f9';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#e0f7ff';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 背景气泡上升
        for (var i = 0; i < bubbles.length; i++) {
            var b = bubbles[i];
            b.y -= b.vy * dt;
            b.x += Math.sin(b.sway + time * 0.001 * b.swaySpeed * 1000) * 0.2 * dt;
            if (b.y < -20) {
                bubbles[i] = createBubble();
                bubbles[i].y = H + 20;
            }
        }

        // 水母上下浮动
        for (var j = 0; j < jellies.length; j++) {
            var jl = jellies[j];
            jl.y += jl.vy * dt;
            if (jl.y < H * 0.2) jl.vy = Math.abs(jl.vy);
            if (jl.y > H * 0.9) jl.vy = -Math.abs(jl.vy);
            jl.sway += jl.swaySpeed * dt;
        }

        // 鱼群
        for (var f = 0; f < fishes.length; f++) {
            updateFish(fishes[f], dt);
        }

        // 点击气泡粒子
        for (var p = particles.length - 1; p >= 0; p--) {
            var pp = particles[p];
            pp.life--;
            if (pp.life <= 0) { particles.splice(p, 1); continue; }
            pp.vy += 0.02; // 略受浮力影响
            pp.x += pp.vx;
            pp.y += pp.vy;
            pp.alpha -= pp.decay;
            if (pp.alpha < 0) pp.alpha = 0;
        }
    }

    function draw(time) {
        drawSky();
        drawBeams(time);

        // 背景气泡
        for (var i = 0; i < bubbles.length; i++) {
            drawBubble(bubbles[i], time);
        }

        // 鱼群（在深海之心后面，营造层次）
        for (var f = 0; f < fishes.length; f++) {
            drawFish(fishes[f], time);
        }

        // 水母
        for (var j = 0; j < jellies.length; j++) {
            drawJelly(jellies[j], time);
        }

        // 中央海洋之心
        drawOceanHeart(time);

        // 点击气泡粒子
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                // 爱心闪光
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
                // 气泡
                ctx.beginPath();
                ctx.arc(pp.x, pp.y, pp.r, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(210, 240, 255,' + Math.max(0, pp.alpha).toFixed(3) + ')';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(pp.x - pp.r * 0.3, pp.y - pp.r * 0.3, pp.r * 0.2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + (Math.max(0, pp.alpha) * 0.6).toFixed(3) + ')';
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

        // 重建背景元素
        createBeams();
        bubbles = [];
        for (var i = 0; i < BUBBLE_COUNT; i++) bubbles.push(createBubble());
        jellies = [];
        for (var j = 0; j < JELLY_COUNT; j++) jellies.push(createJelly());
        fishes = [];
        for (var k = 0; k < FISH_COUNT; k++) fishes.push(createFish());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnBubbleBurst(x, y);
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
    global.Ocean = {
        debug: function () {
            return {
                bubbles: bubbles.length,
                jellies: jellies.length,
                fishes: fishes.length,
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
