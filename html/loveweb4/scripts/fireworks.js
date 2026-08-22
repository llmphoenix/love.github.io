/* ============================================================
 * 绚烂烟花 fireworks.js
 *
 * 功能：
 *   - 深蓝夜空 + 闪烁星星背景
 *   - 自动持续发射烟花（圆形 / 心形 / 环状 / 爱心飘落）
 *   - 点击 / 触摸屏幕任意处，在点击位置绽放一朵烟花
 *   - DPR 缩放 + 移动端粒子密度优化（参考 loveweb3 优化经验）
 *
 * 用法：
 *   <script src="scripts/fireworks.js"></script>
 * ============================================================ */
(function (global) {
    'use strict';

    var canvas = document.getElementById('fireworks');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    var W = 0, H = 0, DPR = 1;

    // 移动端判断
    var isMobile = window.innerWidth <= 480;

    // 粒子数量比例（移动端降低密度，保证流畅）
    var DENSITY = isMobile ? 0.6 : 1;

    // 夜空背景（带渐变）——每次渲染重绘背景，实现烟花拖尾
    function drawSky() {
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#05070f');
        grad.addColorStop(0.55, '#0a0e1e');
        grad.addColorStop(1, '#141024');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
    }

    // ============ 星星背景 ============
    var stars = [];
    var STAR_COUNT = Math.round((isMobile ? 90 : 150) * DENSITY);

    function createStars() {
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.2 + 0.3,
                twinkle: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.02 + 0.005
            });
        }
    }

    function drawStars(time) {
        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];
            var alpha = 0.4 + 0.6 * Math.abs(Math.sin(s.twinkle + time * s.speed * 40));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
            ctx.fill();
        }
    }

    // ============ 调色板（绚烂烟花色系） ============
    var PALETTES = [
        ['#ff6b6b', '#ffa94d', '#ffd43b', '#ffc078'],
        ['#74c0fc', '#4dabf7', '#a5d8ff', '#e7f5ff'],
        ['#ff9ff3', '#f368e0', '#d6336c', '#ffd1dc'],
        ['#63e6be', '#38d9a9', '#96f2d7', '#e6fcf5'],
        ['#ffd43b', '#ffa94d', '#ff8787', '#ffe066'],
        ['#b197fc', '#9775fa', '#d0bfff', '#f3f0ff'],
        ['#ffe066', '#ffd43b', '#ffa94d', '#ff6b6b'],
        ['#ff922b', '#ff6b6b', '#f783ac', '#ffa94d']
    ];

    function randomPalette() {
        return PALETTES[Math.floor(Math.random() * PALETTES.length)];
    }

    // ============ 烟花系统 ============
    var rockets = []; // 上升中的火箭
    var particles = []; // 爆炸粒子
    var fallingHearts = []; // 飘落爱心

    // 爆炸形状：0 圆形 / 1 心形 / 2 环状
    function burstShape(type, baseAngle, total) {
        var angles = [];
        switch (type) {
            case 0: // 圆形
                for (var i = 0; i < total; i++) {
                    angles.push((Math.PI * 2 * i) / total);
                }
                break;
            case 1: { // 心形参数方程
                for (var j = 0; j < total; j++) {
                    var t = (Math.PI * 2 * j) / total;
                    angles.push({ t: t, heart: true });
                }
                break;
            }
            case 2: // 环状（两层同心环）
                for (var k = 0; k < total; k++) {
                    var a = (Math.PI * 2 * k) / total;
                    angles.push({ t: a, ring: true, layer: k % 2 });
                }
                break;
            default:
                for (var m = 0; m < total; m++) {
                    angles.push((Math.PI * 2 * m) / total);
                }
        }
        return angles;
    }

    // 爆炸一朵烟花
    function explode(x, y) {
        var type = Math.floor(Math.random() * 3);
        var palette = randomPalette();
        var baseColor = palette[Math.floor(Math.random() * palette.length)];

        var total = Math.round((type === 2 ? 90 : 120) * DENSITY);
        var speedBase = type === 0 ? (Math.random() * 1.2 + 2.6) : (Math.random() * 1 + 2.2);
        var angles = burstShape(type, 0, total);

        for (var i = 0; i < angles.length; i++) {
            var ang = angles[i];
            var vx, vy, speed = speedBase;
            var startX = x, startY = y;
            var life = Math.random() * 20 + 45;

            if (typeof ang === 'object') {
                if (ang.heart) {
                    // 心形：x = 16sin^3(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
                    var t = ang.t;
                    var hx = 16 * Math.pow(Math.sin(t), 3);
                    var hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
                    var len = Math.hypot(hx, hy) || 1;
                    vx = (hx / len) * speed;
                    vy = (hy / len) * speed;
                } else if (ang.ring) {
                    // 环状：外层正常圆、内层反向小圆（旋转感）
                    var ra = ang.t;
                    if (ang.layer === 0) {
                        vx = Math.cos(ra) * speed;
                        vy = Math.sin(ra) * speed;
                    } else {
                        vx = Math.cos(-ra + Math.PI) * speed * 0.75;
                        vy = Math.sin(-ra + Math.PI) * speed * 0.75;
                    }
                } else {
                    vx = Math.cos(ang.t) * speed;
                    vy = Math.sin(ang.t) * speed;
                }
            } else {
                vx = Math.cos(ang) * speed;
                vy = Math.sin(ang) * speed;
            }

            // 粒子颜色：从调色板取，略带随机
            var color = palette[Math.floor(Math.random() * palette.length)];

            particles.push({
                x: startX,
                y: startY,
                vx: vx,
                vy: vy,
                gravity: 0.045,
                friction: 0.985,
                alpha: 1,
                decay: Math.random() * 0.012 + 0.008,
                life: life,
                color: color,
                size: Math.random() * 1.6 + 1.2,
                // 拖尾
                trail: []
            });
        }

        // 中心闪光
        particles.push({
            x: x, y: y, vx: 0, vy: 0, gravity: 0, friction: 1,
            alpha: 1, decay: 0.03, life: 22, color: '#ffffff',
            size: 6, trail: [], flash: true
        });
    }

    // 发射一枚火箭（从底部随机位置升起）
    function launch() {
        var targetY = H * (0.15 + Math.random() * 0.35);
        var x = W * (0.15 + Math.random() * 0.7);
        var targetX = x + (Math.random() * 160 - 80);
        var dy = H - targetY;
        var dx = targetX - x;
        var dist = Math.hypot(dx, dy) || 1;

        rockets.push({
            x: x,
            y: H + 5,
            vx: (dx / dist) * (Math.random() * 2 + 7),
            vy: -(Math.random() * 2 + 7.5),
            targetX: targetX,
            targetY: targetY,
            trail: []
        });
    }

    // 飘落爱心（爆炸后的额外浪漫效果）
    function spawnFallingHeart(x, y) {
        fallingHearts.push({
            x: x + (Math.random() * 60 - 30),
            y: y + (Math.random() * 30 - 10),
            vx: Math.random() * 0.8 - 0.4,
            vy: Math.random() * 1 + 0.5,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.06,
            alpha: 1,
            size: Math.random() * 10 + 8,
            life: Math.random() * 60 + 60,
            color: Math.random() > 0.5 ? '#ff6b9d' : '#ffd1dc'
        });
    }

    // 画爱心形状
    function drawHeart(x, y, size, color, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 16, size / 16);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.bezierCurveTo(0, 0, -8, -6, -16, 0);
        ctx.bezierCurveTo(-16, 8, -8, 14, 0, 20);
        ctx.bezierCurveTo(8, 14, 16, 8, 16, 0);
        ctx.bezierCurveTo(16, -6, 8, 0, 0, 5);
        ctx.fill();
        ctx.restore();
    }

    // ============ 主循环 ============
    var nextLaunch = 0;
    var autoLaunchInterval = isMobile ? 2200 : 1400; // 自动发射间隔（ms）
    var lastTime = 0;

    // 文字祝福（爆炸时偶尔打出）
    var WORDS = ['爱你', 'Forever', '甄玥', '♡', '520', '1314'];
    var textBursts = [];
    var currentWord = '';

    function explodeText(x, y) {
        var word = WORDS[Math.floor(Math.random() * WORDS.length)];
        currentWord = word;
        textBursts.push({
            x: x, y: y,
            word: word,
            alpha: 1,
            scale: 0.4,
            life: 90
        });
    }

    function drawTextBursts() {
        for (var i = textBursts.length - 1; i >= 0; i--) {
            var tb = textBursts[i];
            tb.life--;
            tb.scale += 0.02;
            if (tb.life <= 60) tb.alpha -= 1 / 60;

            var alpha = Math.max(0, tb.alpha);
            ctx.save();
            ctx.translate(tb.x, tb.y);
            ctx.scale(tb.scale, tb.scale);
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#ff9ff3';
            ctx.shadowBlur = 18;
            ctx.fillStyle = '#ffe0f0';
            ctx.fillText(tb.word, 0, 0);
            ctx.restore();

            if (tb.life <= 0 || tb.alpha <= 0) {
                textBursts.splice(i, 1);
            }
        }
    }

    function update(dt, time) {
        // 自动发射
        if (time > nextLaunch) {
            launch();
            nextLaunch = time + autoLaunchInterval * (0.6 + Math.random() * 0.8);
            // 每 3~5 朵烟花，顺带打一个文字祝福
            if (Math.random() < 0.35) {
                var last = rockets[rockets.length - 1];
                // 记录标记：这枚火箭爆炸后显示文字
                if (last) last.textBurst = true;
            }
        }

        // 更新火箭
        for (var i = rockets.length - 1; i >= 0; i--) {
            var r = rockets[i];
            r.trail.push({ x: r.x, y: r.y });
            if (r.trail.length > 8) r.trail.shift();

            r.x += r.vx;
            r.y += r.vy;

            // 到达目标附近 → 爆炸
            if (Math.abs(r.x - r.targetX) < 10 && Math.abs(r.y - r.targetY) < 12) {
                explode(r.x, r.y);
                // 偶尔飘落爱心 + 文字
                if (Math.random() < 0.4) {
                    for (var h = 0; h < 3; h++) spawnFallingHeart(r.x, r.y);
                }
                if (r.textBurst) {
                    explodeText(r.x, r.y);
                }
                rockets.splice(i, 1);
                continue;
            }

            // 超出边界兜底
            if (r.y < 0 || r.y > H + 40) {
                rockets.splice(i, 1);
            }
        }

        // 更新爆炸粒子
        for (var p = particles.length - 1; p >= 0; p--) {
            var pt = particles[p];
            pt.life--;
            if (pt.life <= 0) {
                particles.splice(p, 1);
                continue;
            }

            // 拖尾
            if (pt.trail.length > 4) pt.trail.shift();
            pt.trail.push({ x: pt.x, y: pt.y });

            pt.vy += pt.gravity;
            pt.vx *= pt.friction;
            pt.vy *= pt.friction;
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.alpha -= pt.decay;
            if (pt.alpha < 0) pt.alpha = 0;
        }

        // 更新飘落爱心
        for (var h2 = fallingHearts.length - 1; h2 >= 0; h2--) {
            var fh = fallingHearts[h2];
            fh.life--;
            fh.x += fh.vx;
            fh.y += fh.vy;
            fh.vy += 0.03;
            fh.rot += fh.rotSpeed;
            fh.alpha = Math.min(1, fh.life / 40);
            if (fh.life <= 0 || fh.y > H + 30) {
                fallingHearts.splice(h2, 1);
            }
        }
    }

    function draw() {
        drawSky();
        drawStars(performance.now() / 1000);

        // 火箭拖尾
        for (var i = 0; i < rockets.length; i++) {
            var r = rockets[i];
            for (var t = 0; t < r.trail.length; t++) {
                var tr = r.trail[t];
                ctx.beginPath();
                ctx.arc(tr.x, tr.y, t * 0.18 + 0.3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 200, 120,' + (t / r.trail.length * 0.5).toFixed(3) + ')';
                ctx.fill();
            }
            // 火箭头
            ctx.beginPath();
            ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffd43b';
            ctx.fill();
        }

        // 爆炸粒子（含拖尾）
        for (var p = 0; p < particles.length; p++) {
            var pt = particles[p];

            // 拖尾光带
            for (var k = 0; k < pt.trail.length; k++) {
                var trk = pt.trail[k];
                var ratio = (k + 1) / pt.trail.length;
                ctx.beginPath();
                ctx.arc(trk.x, trk.y, pt.size * ratio * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = hexToRgba(pt.color, pt.alpha * ratio * 0.5);
                ctx.fill();
            }

            // 粒子主体（发光）
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            if (pt.flash) {
                ctx.fillStyle = hexToRgba('#ffffff', pt.alpha);
            } else {
                ctx.fillStyle = hexToRgba(pt.color, pt.alpha);
            }
            ctx.fill();

            // 光晕
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * 2.6, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(pt.color, pt.alpha * 0.16);
            ctx.fill();
        }

        // 飘落爱心
        for (var f = 0; f < fallingHearts.length; f++) {
            var h = fallingHearts[f];
            drawHeart(h.x, h.y, h.size, h.color, h.alpha);
        }

        // 文字祝福
        drawTextBursts();
    }

    // hex 颜色转 rgba 字符串
    function hexToRgba(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(1, alpha)).toFixed(3) + ')';
    }

    // ============ 动画循环 ============
    function loop(time) {
        var dt = lastTime ? (time - lastTime) / 16.67 : 1;
        if (dt > 3) dt = 3; // 帧率骤降时限制步长，避免粒子飞散
        lastTime = time;

        update(dt, time);
        draw();

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
        createStars();
    }

    // resize 防抖
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // ============ 交互：点击 / 触摸绽放烟花 ============
    function handlePointer(x, y) {
        explode(x, y);
        if (Math.random() < 0.5) {
            for (var i = 0; i < 3; i++) spawnFallingHeart(x, y);
        }
        // 触发一次小震感（支持的设备）
        if (navigator.vibrate) {
            try { navigator.vibrate(20); } catch (e) { /* 忽略 */ }
        }
    }

    // 优先 PointerEvent，避免移动端 click+touch 双触发
    if (window.PointerEvent) {
        canvas.addEventListener('pointerup', function (e) {
            handlePointer(e.clientX, e.clientY);
        });
    } else {
        // 回退方案 + 时间戳防抖
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

    // 初始发射几发预热
    resize();
    for (var n = 0; n < 3; n++) {
        setTimeout(launch, n * 400);
    }
    nextLaunch = performance.now() + 1200;
    requestAnimationFrame(loop);

    // 暴露接口（调试用）
    global.Fireworks = { launch: launch, explode: explode };
})(window);
