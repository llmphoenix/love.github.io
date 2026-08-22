/* ============================================================
 * 云端之恋 clouds.js（loveweb8 · 天空之恋）
 *
 * 主题：云端之上的浪漫飞翔
 *   - 粉紫朝霞渐变天空
 *   - 云海翻涌（多朵半透明云彩缓缓漂移、翻腾变形）
 *   - 热气球缓缓上升（带吊篮与花纹）
 *   - 飞鸟掠过
 *   - 中央「云上之心」：漂浮在云端的心形，散发柔光
 *   - 点击/触摸：云朵涟漪扩散 + 云端情话浮现
 *   - 沿用 loveweb4/5/6/7 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/clouds.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('clouds');
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
    var particles = [];       // 点击云朵涟漪粒子
    var clouds = [];          // 云海
    var balloons = [];        // 热气球
    var birds = [];           // 飞鸟
    var textBursts = [];      // 情话

    // ============ 朝霞天空背景 ============
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#f9a8d4');   // 粉
        grad.addColorStop(0.4, '#fbcfe8'); // 浅粉
        grad.addColorStop(0.7, '#fde68a'); // 暖黄
        grad.addColorStop(1, '#fef3c7');   // 奶油
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 云海 ============
    var CLOUD_COUNT = Math.round((isMobile ? 8 : 12) * DENSITY);

    function createCloud() {
        return {
            x: Math.random() * W,
            y: H * (0.1 + Math.random() * 0.7),
            w: Math.random() * 160 + 90,
            h: Math.random() * 50 + 30,
            speed: Math.random() * 0.3 + 0.1,
            alpha: Math.random() * 0.4 + 0.3,
            puffs: 5 + Math.floor(Math.random() * 3),
            phase: Math.random() * Math.PI * 2
        };
    }

    function drawCloud(c, time) {
        var bob = Math.sin(c.phase + time * 0.0005) * 6; // 云朵上下浮动
        ctx.save();
        ctx.globalAlpha = c.alpha;
        ctx.fillStyle = '#ffffff';
        var cx = c.x;
        var cy = c.y + bob;
        // 云朵 = 多个圆叠加
        for (var i = 0; i < c.puffs; i++) {
            var px = cx - c.w * 0.4 + (i / (c.puffs - 1)) * c.w * 0.8;
            var py = cy + Math.sin(i * 1.3) * c.h * 0.15;
            var pr = c.h * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + time * 0.0003)));
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
        }
        // 底部扁平化（云座）
        ctx.beginPath();
        ctx.ellipse(cx, cy + c.h * 0.3, c.w * 0.5, c.h * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ============ 热气球 ============
    var BALLOON_COUNT = Math.round((isMobile ? 2 : 3) * DENSITY);

    function createBalloon() {
        return {
            x: Math.random() * W,
            y: H * (0.5 + Math.random() * 0.4),
            size: Math.random() * 30 + 25,
            speed: Math.random() * 0.3 + 0.15,   // 上升
            sway: Math.random() * Math.PI * 2,
            swaySpeed: Math.random() * 0.01 + 0.005,
            hue: [330, 25, 200, 120][Math.floor(Math.random() * 4)] // 粉/橙/蓝/绿
        };
    }

    function drawBalloon(b, time) {
        ctx.save();
        ctx.translate(b.x, b.y);
        var sway = Math.sin(b.sway + time * 0.001 * b.swaySpeed * 1000) * 5;
        ctx.rotate(sway * 0.02);

        // 气囊（圆 + 高光）
        var grad = ctx.createRadialGradient(-b.size * 0.3, -b.size * 0.3, b.size * 0.2, 0, 0, b.size * 1.3);
        grad.addColorStop(0, 'hsla(' + b.hue + ',90%,85%,1)');
        grad.addColorStop(1, 'hsla(' + b.hue + ',80%,55%,1)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, -b.size * 0.3, b.size * 0.7, b.size * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        // 条纹（气球花纹）
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        for (var i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.ellipse(0, -b.size * 0.3, b.size * 0.7, b.size * 0.85, 0, 0, Math.PI * 2);
            ctx.closePath();
            // 简化：画竖直条纹弧
            ctx.beginPath();
            ctx.moveTo(i * b.size * 0.25, -b.size * 1.1);
            ctx.quadraticCurveTo(i * b.size * 0.45, -b.size * 0.3, i * b.size * 0.25, b.size * 0.5);
            ctx.stroke();
        }
        // 吊篮绳索
        ctx.strokeStyle = 'rgba(120, 90, 60, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-b.size * 0.3, b.size * 0.55);
        ctx.lineTo(-b.size * 0.18, b.size * 0.9);
        ctx.moveTo(b.size * 0.3, b.size * 0.55);
        ctx.lineTo(b.size * 0.18, b.size * 0.9);
        ctx.stroke();
        // 吊篮
        ctx.fillStyle = '#8b5e3c';
        ctx.fillRect(-b.size * 0.22, b.size * 0.88, b.size * 0.44, b.size * 0.22);
        ctx.restore();
    }

    // ============ 飞鸟 ============
    var BIRD_COUNT = Math.round((isMobile ? 4 : 7) * DENSITY);

    function createBird() {
        var dir = Math.random() > 0.5 ? 1 : -1;
        return {
            x: dir > 0 ? -30 : W + 30,
            y: H * (0.15 + Math.random() * 0.3),
            speed: Math.random() * 1.2 + 0.8,
            dir: dir,
            size: Math.random() * 7 + 5,
            flap: Math.random() * Math.PI * 2,
            flapSpeed: Math.random() * 0.1 + 0.08
        };
    }

    function updateBird(b, dt, time) {
        b.x += b.dir * b.speed * dt;
        b.y += Math.sin(time * 0.002 + b.flap) * 0.2 * dt;
        b.flap += b.flapSpeed * dt;
        if (b.dir > 0 && b.x > W + 40) Object.assign(b, createBird());
        else if (b.dir < 0 && b.x < -40) Object.assign(b, createBird());
    }

    function drawBird(b, time) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(b.dir, 1);
        ctx.strokeStyle = 'rgba(60, 60, 80, 0.7)';
        ctx.lineWidth = 1.5;
        var flap = Math.sin(b.flap) * 0.6;
        // 双翅（V 形）
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-b.size * 0.5, -b.size * (0.5 + flap), -b.size, -flap * b.size * 0.6);
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(b.size * 0.5, -b.size * (0.5 + flap), b.size, -flap * b.size * 0.6);
        ctx.stroke();
        ctx.restore();
    }

    // ============ 中央云上之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawCloudHeart(time) {
        var cx = W / 2;
        var cy = H * 0.45;
        heartAngle += 0.003;
        var breathe = 1 + Math.sin(time * 0.0012) * 0.06;

        // 心形下方一朵托举的云
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#ffffff';
        for (var c = 0; c < 6; c++) {
            var px = cx - 60 + (c / 5) * 120;
            ctx.beginPath();
            ctx.arc(px, cy + 50, 22, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 心形粒子（暖粉光）
        for (var i = 0; i < HEART_COUNT; i++) {
            var t = (Math.PI * 2 * i) / HEART_COUNT;
            var hx = 16 * Math.pow(Math.sin(t), 3);
            var hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            var orbit = 26 * breathe * (1 + Math.sin(heartAngle * 20 + i * 0.7) * 0.06);
            var px2 = cx + hx / 16 * orbit + Math.sin(heartAngle * 2 + i) * 2;
            var py2 = cy + hy / 16 * orbit + Math.cos(heartAngle * 2 + i) * 2;

            var tw = 0.6 + 0.4 * Math.sin(time * 0.004 + i * 0.3);
            ctx.beginPath();
            ctx.arc(px2, py2, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(330, 90%, 75%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（云白粉）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(255, 200, 220, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#fda4af';
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
        ctx.fillStyle = 'rgba(255, 230, 240,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：云朵涟漪 ============
    function spawnCloudRipple(x, y) {
        var total = Math.round((isMobile ? 24 : 36) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 2.2 + 0.7;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                r: Math.random() * 5 + 2,
                alpha: 0.7,
                decay: 0.018,
                life: Math.random() * 30 + 30
            });
        }
        pushParticle({
            heart: true,
            x: x, y: y,
            size: 10, alpha: 1, decay: 0.04, life: 30
        });
    }

    // ============ 云端情话 ============
    var LOVE_LINES = [
        ['乘着云朵去看你', '风是我的信使', '云是我的情书'],
        ['天上的云是我的思念', '一团一团', '全是关于你'],
        ['想和你一起', '飞到云上', '把余生看遍'],
        ['你是云端之城', '我是路过却', '不肯离去的风'],
        ['我愿做你的云', '轻轻托起你', '不让你坠落'],
        ['天空很大', '云朵很多', '而我眼里只有你'],
        ['把爱写在云上', '风会替我', '告诉你'],
        ['你一笑', '云都散了', '阳光都偏爱你了']
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
            spawnCloudRipple(lx, ly);
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
                ctx.fillStyle = '#7a2e5a';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 云海漂移
        for (var i = 0; i < clouds.length; i++) {
            var c = clouds[i];
            c.x += c.speed * dt;
            if (c.x > W + 120) {
                c.x = -120;
                c.y = H * (0.1 + Math.random() * 0.7);
            }
        }

        // 热气球上升
        for (var j = 0; j < balloons.length; j++) {
            var b = balloons[j];
            b.y -= b.speed * dt;
            b.sway += b.swaySpeed * dt;
            if (b.y < -60) {
                balloons[j] = createBalloon();
                balloons[j].y = H + 60;
            }
        }

        // 飞鸟
        for (var k = 0; k < birds.length; k++) {
            updateBird(birds[k], dt, time);
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

        // 远景云（淡）
        for (var i = 0; i < clouds.length; i++) {
            if (clouds[i].alpha < 0.45) drawCloud(clouds[i], time);
        }

        // 飞鸟（在云与心之间）
        for (var k = 0; k < birds.length; k++) {
            drawBird(birds[k], time);
        }

        // 热气球
        for (var j = 0; j < balloons.length; j++) {
            drawBalloon(balloons[j], time);
        }

        // 云上之心
        drawCloudHeart(time);

        // 近景云（浓）
        for (var i2 = 0; i2 < clouds.length; i2++) {
            if (clouds[i2].alpha >= 0.45) drawCloud(clouds[i2], time);
        }

        // 点击粒子（云朵涟漪）
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#fda4af';
                ctx.shadowColor = '#fda4af';
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
                ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, pp.alpha).toFixed(3) + ')';
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

        clouds = [];
        for (var i = 0; i < CLOUD_COUNT; i++) clouds.push(createCloud());
        balloons = [];
        for (var j = 0; j < BALLOON_COUNT; j++) balloons.push(createBalloon());
        birds = [];
        for (var k = 0; k < BIRD_COUNT; k++) birds.push(createBird());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnCloudRipple(x, y);
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
    global.Clouds = {
        debug: function () {
            return {
                clouds: clouds.length,
                balloons: balloons.length,
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
