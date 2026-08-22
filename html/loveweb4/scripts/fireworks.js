/* ============================================================
 * 绚烂烟花 fireworks.js (v2 · 激情系统增强版)
 *
 * 功能：
 *   - 深蓝夜空 + 闪烁星星背景
 *   - 自动持续发射烟花（圆形 / 心形 / 环状 / 玫瑰 / 螺旋 / 扇形 / 牡丹）
 *   - 点击 / 触摸屏幕任意处绽放烟花
 *   - 【激情系统】以 60 秒滑动窗口统计点击频率：
 *     点击越频繁 → 烟花数量越多、越绚烂、越浪漫（含随机波动）
 *   - 真实感增强：粒子大小分布、闪烁、核心爆光、二次爆裂 crackle
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

    // 粒子总数上限（性能保护，防止连点导致粒子爆炸）
    var MAX_PARTICLES = Math.round((isMobile ? 2000 : 5000) * DENSITY);

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

    // 烟花形状：返回粒子角度/参数数组
    // 0 圆形 | 1 心形 | 2 双层环 | 3 玫瑰花瓣 | 4 螺旋 | 5 扇形 | 6 千层牡丹
    function shapePoints(type, total) {
        var pts = [];
        var i, t, a, r;
        switch (type) {
            case 0: // 圆形
                for (i = 0; i < total; i++) {
                    pts.push({ a: (Math.PI * 2 * i) / total, d: 1 });
                }
                break;
            case 1: // 心形参数方程
                for (i = 0; i < total; i++) {
                    t = (Math.PI * 2 * i) / total;
                    pts.push({ a: t, d: 1, heart: true });
                }
                break;
            case 2: // 双层环（外环 + 反向内环，旋转感）
                for (i = 0; i < total; i++) {
                    a = (Math.PI * 2 * i) / total;
                    if (i % 2 === 0) pts.push({ a: a, d: 1 });
                    else pts.push({ a: -a + Math.PI, d: 0.7 });
                }
                break;
            case 3: // 玫瑰花瓣（r = |cos(3θ)| 三瓣玫瑰）
                for (i = 0; i < total; i++) {
                    t = (Math.PI * 2 * i) / total;
                    r = Math.abs(Math.cos(3 * t));
                    pts.push({ a: t, d: Math.max(0.3, r) });
                }
                break;
            case 4: // 螺旋（3 臂，半径随角度增长）
                for (i = 0; i < total; i++) {
                    t = (Math.PI * 2 * i) / total;
                    var arms = 3;
                    pts.push({ a: t * arms, d: (i / total) * 0.9 + 0.1 });
                }
                break;
            case 5: // 扇形（孔雀开屏：一个角度扇区，半径略带差异）
                for (i = 0; i < total; i++) {
                    var spread = 1.7;
                    a = -spread / 2 + (spread * i) / total;
                    pts.push({ a: a, d: 0.55 + Math.random() * 0.55 });
                }
                break;
            case 6: // 千层牡丹（3 层同心环，不同半径与相位）
                for (i = 0; i < total; i++) {
                    a = (Math.PI * 2 * i) / total;
                    var layer = i % 3;
                    pts.push({ a: a + layer * 0.18, d: [1, 0.72, 0.5][layer] });
                }
                break;
            default:
                for (i = 0; i < total; i++) {
                    pts.push({ a: (Math.PI * 2 * i) / total, d: 1 });
                }
        }
        return pts;
    }

    // 爆炸一朵烟花（真实感增强版）
    // opts: { type, palette, scale(粒子倍率), speedScale, crackle(二次爆裂概率), glow(核心光强度) }
    function explode(x, y, opts) {
        opts = opts || {};
        var type = opts.type !== undefined ? opts.type : Math.floor(Math.random() * 7);
        var palette = opts.palette || randomPalette();

        var total = Math.round((type === 2 || type === 6 ? 90 : 120) * DENSITY * (opts.scale || 1));
        var speedBase = (Math.random() * 1.2 + 2.6) * (opts.speedScale || 1);
        var pts = shapePoints(type, total);
        var coreGlow = opts.glow || 1;

        for (var i = 0; i < pts.length; i++) {
            var ang = pts[i];
            var speed = speedBase * ang.d;
            var life = Math.random() * 20 + 45;
            var vx, vy;

            if (ang.heart) {
                // 心形：x = 16sin^3(t), y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
                var t = ang.a;
                var hx = 16 * Math.pow(Math.sin(t), 3);
                var hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
                var len = Math.hypot(hx, hy) || 1;
                vx = (hx / len) * speed;
                vy = (hy / len) * speed;
            } else {
                vx = Math.cos(ang.a) * speed;
                vy = Math.sin(ang.a) * speed;
            }

            var color = palette[Math.floor(Math.random() * palette.length)];

            // 粒子大小分布：约 70% 小粒子 + 30% 大粒子（更接近真实烟花）
            var r = Math.random();
            var size = r < 0.7 ? (Math.random() * 1 + 1.1) : (Math.random() * 2.4 + 2);

            var p = {
                x: x, y: y,
                vx: vx, vy: vy,
                gravity: 0.045 * (0.9 + Math.random() * 0.2),
                friction: 0.985,
                alpha: 1,
                decay: Math.random() * 0.012 + 0.008,
                life: life,
                color: color,
                size: size,
                // 拖尾
                trail: [],
                // 真实感增强
                twinkle: Math.random() * Math.PI * 2,      // 闪烁相位
                twinkleSpeed: Math.random() * 0.15 + 0.05, // 闪烁速度
                twinkleAmt: Math.random() * 0.25 + 0.1,    // 闪烁幅度
                crackle: opts.crackle && Math.random() < opts.crackle ? 1 : 0, // 二次爆裂
                crackleTimer: 0,
                core: false
            };
            pushParticle(p);
        }

        // 中心爆闪（真实烟花核心：白色亮光 + 强光晕，随激情增强）
        pushParticle({
            x: x, y: y, vx: 0, vy: 0, gravity: 0, friction: 1,
            alpha: 1, decay: 0.028, life: 20, color: '#ffffff',
            size: 5 * coreGlow, trail: [], flash: true, core: true,
            twinkle: 0, twinkleSpeed: 0, twinkleAmt: 0,
            crackle: 0, crackleTimer: 1
        });
    }

    // 发射一枚火箭（从底部随机位置升起）；intensity 记录激情强度，决定爆炸绚烂度
    function launch(intensity) {
        intensity = intensity || 0;
        var targetY = H * (0.12 + Math.random() * 0.35);
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
            trail: [],
            intensity: intensity
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

    // ============ 激情系统（60 秒滑动窗口点击统计） ============
    var clickTimes = [];
    var MAX_CPM = 30; // 每分钟 30 次点击视为满激情

    // 记录一次点击（供 60s 窗口统计）
    function recordClick() {
        var now = performance.now();
        clickTimes.push(now);
        while (clickTimes.length && now - clickTimes[0] > 60000) clickTimes.shift();
    }

    // 当前激情 0~1（60s 滑动窗口内点击率）
    function getPassion() {
        var now = performance.now();
        while (clickTimes.length && now - clickTimes[0] > 60000) clickTimes.shift();
        return Math.min(1, clickTimes.length / MAX_CPM);
    }

    // 粒子入队（性能保护：超过上限丢弃新粒子）
    function pushParticle(p) {
        if (particles.length >= MAX_PARTICLES) return false;
        particles.push(p);
        return true;
    }

    // 根据激情挑选更绚烂的形状（高激情偏向复杂绚丽造型）
    function pickType(p) {
        if (p > 0.7) {
            // 高激情：心形 / 玫瑰 / 螺旋 / 牡丹
            return [1, 3, 4, 6][Math.floor(Math.random() * 4)];
        } else if (p > 0.35) {
            // 中激情：混合
            return [0, 1, 2, 3, 4, 6][Math.floor(Math.random() * 6)];
        } else {
            // 低激情：基础圆形 / 心形 / 环状
            return [0, 1, 2][Math.floor(Math.random() * 3)];
        }
    }

    // ============ 点击爆炸组合（数量 / 绚烂 / 浪漫随激情变化） ============
    function explodeBurst(x, y) {
        recordClick();
        var p = getPassion();

        // 随机波动：每次点击效果在 ±20% 内浮动
        var jitter = 0.8 + Math.random() * 0.4;
        var pj = Math.min(1, p * jitter);

        // 主烟花数量：低激情 1 朵 → 高激情 2~3 朵
        var mainCount = 1 + Math.floor(Math.random() * (1 + Math.round(p * 2)));
        // 卫星烟花数量：低激情 0 → 高激情 2~6 朵（环绕主烟花）
        var satCount = Math.round(p * (2 + Math.random() * 4));

        var particleScale = 1 + p * 0.9 + Math.random() * 0.3;
        var speedScale = 1 + p * 0.35 + Math.random() * 0.2;
        var crackleChance = p * 0.35;
        var glow = 1 + p * 1.2 + Math.random() * 0.3;
        var heartChance = 0.15 + p * 0.45;
        var textChance = 0.08 + p * 0.6;
        var heartCount = Math.round(1 + p * 6 + Math.random() * 3);

        // 主烟花（多个时错开一点位置，组合更立体）
        for (var m = 0; m < mainCount; m++) {
            var mx = x + (Math.random() * 70 - 35);
            var my = y + (Math.random() * 50 - 25);
            explode(mx, my, {
                type: pickType(pj),
                scale: particleScale / Math.sqrt(Math.max(1, mainCount)),
                speedScale: speedScale,
                crackle: crackleChance,
                glow: glow,
                palette: randomPalette()
            });
        }

        // 卫星烟花：环绕点击点一周，如喷泉喷涌
        if (satCount > 0) {
            for (var s = 0; s < satCount; s++) {
                var ang = (Math.PI * 2 * s) / satCount + Math.random() * 0.5;
                var dist = 70 + Math.random() * 70;
                var sx = x + Math.cos(ang) * dist;
                var sy = y + Math.sin(ang) * dist * 0.7;
                explode(sx, sy, {
                    type: pickType(pj),
                    scale: (0.5 + pj * 0.5) * (0.7 + Math.random() * 0.5),
                    speedScale: speedScale * 0.9,
                    crackle: crackleChance * 0.6,
                    glow: glow * 0.7,
                    palette: randomPalette()
                });
            }
        }

        // 浪漫度：飘落爱心（数量随激情）
        if (Math.random() < heartChance) {
            for (var h = 0; h < heartCount; h++) spawnFallingHeart(x, y);
        }

        // 文字祝福（概率随激情）
        if (Math.random() < textChance) {
            explodeText(x, y);
        }

        // 震感随激情增强（支持的设备）
        if (navigator.vibrate) {
            try {
                if (p > 0.6) navigator.vibrate([30, 40, 50]);
                else navigator.vibrate(20);
            } catch (e) { /* 忽略 */ }
        }
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
        // 自动发射（激情越高，发射越频繁、越绚烂）
        if (time > nextLaunch) {
            var passion = getPassion();
            launch(passion);
            nextLaunch = time + autoLaunchInterval * (0.6 + Math.random() * 0.8) * (1 - passion * 0.5);
            // 每 2~4 朵烟花，顺带打一个文字祝福（概率随激情）
            if (Math.random() < (0.3 + passion * 0.4)) {
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

            // 到达目标附近 → 爆炸（自动烟花的绚烂度也随激情提升）
            if (Math.abs(r.x - r.targetX) < 10 && Math.abs(r.y - r.targetY) < 12) {
                var inten = r.intensity || 0;
                explode(r.x, r.y, {
                    type: pickType(inten),
                    scale: 1 + inten * 0.5 + Math.random() * 0.2,
                    speedScale: 1 + inten * 0.25,
                    crackle: inten * 0.25,
                    glow: 1 + inten * 0.8,
                    palette: randomPalette()
                });
                // 偶尔飘落爱心 + 文字（概率随激情）
                if (Math.random() < (0.3 + inten * 0.4)) {
                    for (var h = 0; h < Math.round(1 + inten * 3); h++) spawnFallingHeart(r.x, r.y);
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

            // 二次爆裂（crackle）：生命后期爆出一圈金色小星火（真实烟花的沙沙尾声）
            if (pt.crackle && pt.crackleTimer === 0 && pt.life < 24 && pt.life > 16) {
                pt.crackleTimer = 1;
                var n = 8;
                for (var c = 0; c < n; c++) {
                    var ca = (Math.PI * 2 * c) / n + Math.random() * 0.4;
                    var cs = Math.random() * 1.6 + 0.5;
                    pushParticle({
                        x: pt.x, y: pt.y,
                        vx: Math.cos(ca) * cs,
                        vy: Math.sin(ca) * cs,
                        gravity: 0.03,
                        friction: 0.97,
                        alpha: 1,
                        decay: 0.04,
                        life: 18,
                        color: Math.random() > 0.5 ? '#ffd700' : '#fff3bf',
                        size: 1,
                        trail: [],
                        twinkle: 0, twinkleSpeed: 0.1, twinkleAmt: 0.3,
                        crackle: 0, crackleTimer: 1,
                        spark: true
                    });
                }
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

        // 爆炸粒子（含拖尾、闪烁、核心光）
        var timeS = performance.now() / 1000;
        for (var p = 0; p < particles.length; p++) {
            var pt = particles[p];

            // 闪烁：粒子明暗微波动（更真实）
            var flicker = 1;
            if (pt.twinkleAmt > 0) {
                flicker = 1 - pt.twinkleAmt / 2 + (pt.twinkleAmt / 2) * Math.sin(pt.twinkle + timeS * pt.twinkleSpeed * 60);
            }
            var a = pt.alpha * flicker;

            // 拖尾光带
            for (var k = 0; k < pt.trail.length; k++) {
                var trk = pt.trail[k];
                var ratio = (k + 1) / pt.trail.length;
                ctx.beginPath();
                ctx.arc(trk.x, trk.y, pt.size * ratio * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = hexToRgba(pt.color, a * ratio * 0.5);
                ctx.fill();
            }

            // 核心粒子（爆炸中心）：更强的白色光晕
            if (pt.core) {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.size * 5, 0, Math.PI * 2);
                ctx.fillStyle = hexToRgba('#ffffff', a * 0.18);
                ctx.fill();
            }

            // 粒子主体（发光）
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
            if (pt.flash) {
                ctx.fillStyle = hexToRgba('#ffffff', a);
            } else {
                ctx.fillStyle = hexToRgba(pt.color, a);
            }
            ctx.fill();

            // 光晕
            var glowMul = pt.core ? 4 : 2.6;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.size * glowMul, 0, Math.PI * 2);
            ctx.fillStyle = hexToRgba(pt.color, a * 0.16);
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
        // 随激情与随机绽放一簇绚烂烟花（数量 / 绚烂 / 浪漫均随点击频率变化）
        explodeBurst(x, y);
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
    global.Fireworks = {
        launch: launch,
        explode: explode,
        explodeBurst: explodeBurst,
        getPassion: getPassion,
        recordClick: recordClick
    };
})(window);
