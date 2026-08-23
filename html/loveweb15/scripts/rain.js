/* ============================================================
 * 雨夜心动 rain.js（loveweb15 · 雨夜心动）
 *
 * 主题：霓虹雨夜的浪漫与心动
 *   - 深蓝雨夜渐变 + 城市霓虹光晕（远处高楼剪影 + 彩灯）
 *   - 斜落雨丝（多层，近大远小）+ 雨滴溅起水花
 *   - 地面水洼 + 涟漪扩散 + 霓虹倒影
 *   - 中央「雨夜之心」：霓虹粉紫色心形粒子，雨中呼吸
 *   - 点击/触摸：涟漪 + 心形水花 + 雨夜情话浮现
 *   - 沿用 loveweb4~12 优化：DPR、移动端密度、动态粒子稀释、
 *     PointerEvent 防双触发、resize 防抖
 *
 * 用法：
 *   <script src="scripts/rain.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('rain');
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
    var particles = [];       // 点击水花粒子
    var raindrops = [];       // 雨滴
    var ripples = [];         // 涟漪
    var cityLights = [];      // 城市霓虹灯
    var textBursts = [];      // 情话

    // ============ 雨夜背景 ============
    function drawSky(time) {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#05070f');   // 深夜
        grad.addColorStop(0.5, '#0a0f22'); // 蓝黑
        grad.addColorStop(1, '#141a30');   // 雨雾
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 城市霓虹剪影 ============
    var CITY_COUNT = Math.round((isMobile ? 8 : 14) * DENSITY);

    function createCity() {
        cityLights = [];
        for (var i = 0; i < CITY_COUNT; i++) {
            var bx = (i + 1) / (CITY_COUNT + 1) * W + (Math.random() - 0.5) * W * 0.04;
            var bw = W * (0.04 + Math.random() * 0.05);
            var bh = H * (0.12 + Math.random() * 0.2);
            cityLights.push({
                x: bx, w: bw, h: bh,
                lights: []
            });
            // 每栋楼若干霓虹窗
            var lc = Math.round((isMobile ? 3 : 6) * (Math.random() * 0.5 + 0.5));
            for (var l = 0; l < lc; l++) {
                cityLights[i].lights.push({
                    lx: (Math.random() * 0.7 + 0.15) * bw,
                    ly: (Math.random() * 0.7 + 0.15) * bh,
                    lw: bw * (0.08 + Math.random() * 0.08),
                    lh: bh * (0.05 + Math.random() * 0.05),
                    hue: [320, 190, 45, 265, 10][Math.floor(Math.random() * 5)],
                    tw: Math.random() * Math.PI * 2,
                    sp: Math.random() * 0.003 + 0.001
                });
            }
        }
    }

    function drawCity(time) {
        // 地面剪影（底部暗色）
        ctx.fillStyle = 'rgba(10, 14, 30, 0.95)';
        ctx.fillRect(0, H * 0.82, W, H * 0.18);

        // 楼宇
        for (var i = 0; i < cityLights.length; i++) {
            var b = cityLights[i];
            ctx.fillStyle = 'rgba(16, 22, 44, 0.9)';
            ctx.fillRect(b.x - b.w / 2, H * 0.82 - b.h, b.w, b.h);
            // 霓虹窗
            for (var l = 0; l < b.lights.length; l++) {
                var wl = b.lights[l];
                var tw = 0.5 + 0.5 * Math.sin(wl.tw + time * wl.sp * 1000);
                ctx.globalAlpha = 0.5 + tw * 0.5;
                ctx.fillStyle = 'hsla(' + wl.hue + ', 95%, 65%, 0.9)';
                ctx.fillRect(b.x - b.w / 2 + wl.lx, H * 0.82 - b.h + wl.ly, wl.lw, wl.lh);
            }
            ctx.globalAlpha = 1;
        }
    }

    // ============ 雨丝 ============
    var RAIN_COUNT = Math.round((isMobile ? 70 : 130) * DENSITY);

    function createRain() {
        return {
            x: Math.random() * W,
            y: Math.random() * H,
            len: Math.random() * 16 + 8,
            speed: Math.random() * 12 + 8,
            drift: Math.random() * 2 - 1,
            alpha: Math.random() * 0.4 + 0.2,
            layer: Math.random()
        };
    }

    function updateRain(r, dt) {
        r.y += r.speed * dt;
        r.x += r.drift * dt;
        if (r.y > H + 20) {
            r.y = -20;
            r.x = Math.random() * W;
        }
        if (r.x < -20) r.x = W + 10;
        if (r.x > W + 20) r.x = -10;
    }

    function drawRain(r) {
        ctx.strokeStyle = 'rgba(190, 210, 255, ' + r.alpha.toFixed(3) + ')';
        ctx.lineWidth = r.layer > 0.7 ? 1.4 : 0.8;
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.drift * 2, r.y - r.len);
        ctx.stroke();
    }

    // ============ 地面涟漪（随机雨滴溅落） ============
    function spawnRipple(x, y, r0, alpha) {
        if (ripples.length > (isMobile ? 30 : 50)) ripples.shift();
        ripples.push({
            x: x, y: y,
            r: r0 || 1,
            alpha: alpha || 0.5,
            grow: Math.random() * 0.5 + 0.4
        });
    }

    function updateRipples(dt) {
        for (var i = ripples.length - 1; i >= 0; i--) {
            var rp = ripples[i];
            rp.r += rp.grow * dt;
            rp.alpha -= 0.02 * dt;
            if (rp.alpha <= 0.02) ripples.splice(i, 1);
        }
    }

    function drawRipples() {
        for (var i = 0; i < ripples.length; i++) {
            var rp = ripples[i];
            ctx.strokeStyle = 'rgba(160, 200, 255, ' + Math.max(0, rp.alpha).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    // ============ 中央雨夜之心 ============
    var heartAngle = 0;
    var HEART_COUNT = Math.round((isMobile ? 60 : 90) * DENSITY);

    function drawRainHeart(time) {
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
            // 霓虹粉紫渐变
            var hue = 310 + Math.sin(time * 0.002 + i * 0.5) * 40;
            ctx.beginPath();
            ctx.arc(px, py, 1.6 * tw + 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'hsla(' + hue + ',90%,68%,' + (0.6 * tw).toFixed(3) + ')';
            ctx.fill();
        }

        // 心形轮廓光晕（霓虹粉）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(breathe, breathe);
        ctx.strokeStyle = 'rgba(255, 110, 200, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#ff6ec7';
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
        ctx.fillStyle = 'rgba(255, 180, 230,' + (pulse * 0.7).toFixed(3) + ')';
        ctx.fill();
    }

    // ============ 点击互动：心形水花 + 涟漪 ============
    function spawnSplash(x, y) {
        spawnRipple(x, y, 3, 0.6);
        var total = Math.round((isMobile ? 24 : 36) * DENSITY * dilutionFactor);
        for (var i = 0; i < total; i++) {
            var a = Math.random() * Math.PI * 2;
            var sp = Math.random() * 3 + 1;
            var hue = 310 + Math.random() * 50;
            pushParticle({
                x: x, y: y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 0.5,
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

    // ============ 雨夜情话 ============
    var LOVE_LINES = [
        ['下雨了', '好巧', '我也在想你'],
        ['雨落屋檐', '思念滴答', '每一滴都是你'],
        ['霓虹灯下', '人影匆匆', '我的眼里只有你'],
        ['把伞向你倾斜', '宁愿淋湿自己', '也要护你周全'],
        ['雨停了', '彩虹未现', '而你就站在眼前'],
        ['这场雨', '淋湿了整座城', '也淋湿了我的心'],
        ['在雨夜写下', '你的名字', '让雨水带去'],
        ['窗前听雨', '心底念你', '此夜温柔']
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
            var ly = H * (0.3 + Math.random() * 0.15);
            recordLoveTime();
            spawnSplash(lx, ly);
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
            ctx.shadowColor = '#ff6ec7';
            ctx.shadowBlur = 20;
            var lineH = 34;
            var startY = -((tb.lines.length - 1) * lineH) / 2;
            for (var li = 0; li < tb.lines.length; li++) {
                var lineAlpha = alpha;
                var lineProgress = tb.life - li * 8;
                if (lineProgress < 0) continue;
                if (lineProgress < 30) lineAlpha = alpha * (lineProgress / 30);
                ctx.globalAlpha = lineAlpha;
                ctx.fillStyle = '#ffe0f2';
                ctx.fillText(tb.lines[li], 0, startY + li * lineH);
            }
            ctx.restore();
            if (tb.life >= tb.maxLife) textBursts.splice(i, 1);
        }
    }

    // ============ 主循环 ============
    function update(dt, time) {
        ensureLoveAppears(time);

        // 雨滴
        for (var i = 0; i < raindrops.length; i++) {
            var rd = raindrops[i];
            updateRain(rd, dt);
            // 落地溅起涟漪
            if (rd.y > H * 0.82 && rd.y < H * 0.82 + 20 && Math.random() < 0.02 * dt) {
                spawnRipple(rd.x, H * 0.84, 1, 0.35);
            }
        }
        updateRipples(dt);

        // 点击粒子
        for (var p = particles.length - 1; p >= 0; p--) {
            var pp = particles[p];
            pp.life--;
            if (pp.life <= 0) { particles.splice(p, 1); continue; }
            pp.vy += 0.05;
            pp.x += pp.vx;
            pp.y += pp.vy;
            pp.alpha -= pp.decay;
            if (pp.alpha < 0) pp.alpha = 0;
        }
    }

    function draw(time) {
        drawSky(time);
        drawCity(time);

        // 雨丝
        for (var i = 0; i < raindrops.length; i++) {
            drawRain(raindrops[i]);
        }

        // 地面涟漪
        drawRipples();

        // 雨夜之心
        drawRainHeart(time);

        // 点击粒子（心形水花）
        for (var p = 0; p < particles.length; p++) {
            var pp = particles[p];
            if (pp.heart) {
                ctx.save();
                ctx.translate(pp.x, pp.y);
                ctx.globalAlpha = Math.max(0, pp.alpha);
                ctx.fillStyle = '#ff6ec7';
                ctx.shadowColor = '#ff6ec7';
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
                ctx.fillStyle = 'hsla(' + pp.hue + ',90%,62%,' + (Math.max(0, pp.alpha) * 0.12).toFixed(3) + ')';
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

        createCity();
        raindrops = [];
        for (var i = 0; i < RAIN_COUNT; i++) raindrops.push(createRain());
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸 ============
    function handlePointer(x, y) {
        spawnSplash(x, y);
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
    global.Rain = {
        debug: function () {
            return {
                raindrops: raindrops.length,
                ripples: ripples.length,
                cityLights: cityLights.length,
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
