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

    // ============ 动态星空背景 ============
    var stars = [];
    var meteors = []; // 流星
    var STAR_COUNT = Math.round((isMobile ? 90 : 150) * DENSITY);

    function createStars() {
        stars = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.3 + 0.3,
                twinkle: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.02 + 0.005,       // 闪烁速度
                amp: Math.random() * 0.5 + 0.3,           // 闪烁幅度（动态差异）
                // 漂移（非常缓慢，星星有生命感）
                vx: (Math.random() - 0.5) * 0.04,
                vy: (Math.random() - 0.5) * 0.02,
                // 偶尔的"呼吸"：整体明暗节奏差异
                phase: Math.random() * Math.PI * 2,
                layer: Math.random() // 远近层次：远处小淡、近处大亮
            });
        }
    }

    function drawStars(time) {
        // 流星（偶尔划过，增强动态感）
        for (var m = meteors.length - 1; m >= 0; m--) {
            var met = meteors[m];
            met.life--;
            met.x += met.vx;
            met.y += met.vy;
            met.vx *= 0.99;
            met.vy *= 0.99;

            var malpha = Math.max(0, met.life / 40);
            // 流星头
            ctx.beginPath();
            ctx.arc(met.x, met.y, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + malpha.toFixed(3) + ')';
            ctx.fill();
            // 流星尾（拖拽亮线）
            var tailLen = 18;
            var tailX = met.x - met.vx * tailLen;
            var tailY = met.y - met.vy * tailLen;
            var grad = ctx.createLinearGradient(met.x, met.y, tailX, tailY);
            grad.addColorStop(0, 'rgba(255,255,255,' + (malpha * 0.8).toFixed(3) + ')');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(met.x, met.y);
            ctx.lineTo(tailX, tailY);
            ctx.stroke();

            if (met.life <= 0) meteors.splice(m, 1);
        }

        for (var i = 0; i < stars.length; i++) {
            var s = stars[i];

            // 缓慢漂移
            s.x += s.vx;
            s.y += s.vy;
            // 越界回绕（从天幕一侧漂到另一侧）
            if (s.x < -5) s.x = W + 5;
            if (s.x > W + 5) s.x = -5;
            if (s.y < -5) s.y = H + 5;
            if (s.y > H + 5) s.y = -5;

            // 闪烁：叠加慢呼吸，让每颗星有自己的节奏
            var breathe = 0.7 + 0.3 * Math.sin(s.phase + time * 0.3);
            var flicker = Math.abs(Math.sin(s.twinkle + time * s.speed * 40));
            var alpha = s.amp * (0.35 + 0.65 * flicker) * breathe;
            alpha = Math.max(0.05, Math.min(1, alpha));

            // 远近层次：远星小而暗，近星大而亮 + 微光晕
            var far = s.layer;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * (0.7 + far * 0.6), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
            ctx.fill();
            // 近星加一点光晕（层次感）
            if (far > 0.7) {
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r * 2.2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.12).toFixed(3) + ')';
                ctx.fill();
            }
        }
    }

    // 偶尔生成流星（动态点缀）
    var nextMeteor = 0;
    function maybeSpawnMeteor(time) {
        if (time > nextMeteor) {
            var angle = Math.PI * (0.15 + Math.random() * 0.3); // 斜向划过
            var speed = 5 + Math.random() * 6;
            meteors.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.4,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 40 + Math.random() * 30
            });
            nextMeteor = time + (isMobile ? 9000 : 6000) * (0.7 + Math.random() * 0.6);
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
    // 7 双心交叠 | 8 水母(下拉丝) | 9 彗星(拖尾) | 10 垂柳(泪滴下坠) | 11 皇冠 | 12 六瓣花 | 13 亮环(单圈火环)
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
            case 7: // 双心交叠（一大一小两颗心，位置错开）
                for (i = 0; i < total; i++) {
                    t = (Math.PI * 2 * i) / total;
                    if (i % 2 === 0) pts.push({ a: t, d: 1, heart: true });
                    else pts.push({ a: t + Math.PI * 0.5, d: 0.72, heart: true });
                }
                break;
            case 8: // 水母（上半圆 + 下半部下拉丝垂须）
                for (i = 0; i < total; i++) {
                    if (i < total / 2) {
                        // 上半圆伞面
                        a = Math.PI * (i / (total / 2));
                        pts.push({ a: a, d: 1 });
                    } else {
                        // 下半部：向下拉长的须（速度慢、重力强 → 形成垂丝）
                        a = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
                        pts.push({ a: a, d: Math.random() * 0.5 + 0.5, droop: true });
                    }
                }
                break;
            case 9: // 彗星（一个方向喷射 + 强拖尾）
                for (i = 0; i < total; i++) {
                    a = -Math.PI / 2 + (Math.random() - 0.5) * 0.7; // 主要向上偏
                    pts.push({ a: a, d: Math.random() * 0.8 + 0.4, comet: true });
                }
                break;
            case 10: // 垂柳（顶部炸开，粒子带重力下坠如柳丝）
                for (i = 0; i < total; i++) {
                    a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
                    pts.push({ a: a, d: Math.random() * 0.9 + 0.3, willow: true });
                }
                break;
            case 11: // 皇冠（顶部圆 + 两侧向下展开）
                for (i = 0; i < total; i++) {
                    a = (Math.PI * 2 * i) / total;
                    var hc = Math.abs(Math.cos(a)) < 0.3 ? 1 : 0.4;
                    pts.push({ a: a, d: hc });
                }
                break;
            case 12: // 六瓣花（r = |cos(3θ)| 六瓣）
                for (i = 0; i < total; i++) {
                    t = (Math.PI * 2 * i) / total;
                    r = Math.abs(Math.cos(3 * t / 1));
                    pts.push({ a: t, d: Math.max(0.35, r * 0.85 + 0.15) });
                }
                break;
            case 13: // 亮环（单圈，速度快，无内层 → 细密火环）
                for (i = 0; i < total; i++) {
                    a = (Math.PI * 2 * i) / total;
                    pts.push({ a: a, d: 1, ringThin: true });
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
    // 效果计数：用于统计一次点击 1s 内的实际烟花效果数（验证上限 2~5）
    var burstEffectLog = []; // 记录最近爆炸时间戳（用于测试统计）

    function explode(x, y, opts) {
        // 记录本次爆炸时间（供效果数统计）
        burstEffectLog.push(performance.now());
        if (burstEffectLog.length > 30) burstEffectLog.shift();

        opts = opts || {};
        var type = opts.type !== undefined ? opts.type : Math.floor(Math.random() * 14);
        var palette = opts.palette || randomPalette();

        // 特殊类型的粒子数微调
        var baseTotal = 120;
        if (type === 2 || type === 6 || type === 11) baseTotal = 90;
        if (type === 13) baseTotal = 100;  // 亮环：细密
        if (type === 8 || type === 10) baseTotal = 110; // 水母/垂柳
        if (type === 9) baseTotal = 60;    // 彗星：集中喷射
        var total = Math.round(baseTotal * DENSITY * (opts.scale || 1));

        var speedBase = (Math.random() * 1.2 + 2.6) * (opts.speedScale || 1);
        // 垂柳/彗星用略低的初速，靠重力形成垂坠
        if (type === 10) speedBase *= 0.7;
        if (type === 9) speedBase *= 1.15;
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

            // 特殊形状的物理属性
            var gravity = 0.045 * (0.9 + Math.random() * 0.2);
            var friction = 0.985;
            var extraTrail = 4;
            if (ang.droop) { gravity *= 0.85; friction *= 0.995; extraTrail = 8; } // 水母垂须：长拖尾、缓坠
            if (ang.willow) { gravity *= 1.5; friction *= 0.99; extraTrail = 9; size *= 0.8; } // 垂柳：强重力下坠 + 长丝
            if (ang.comet) { gravity *= 0.4; friction *= 0.99; extraTrail = 12; size *= 1.4; } // 彗星：长亮尾
            if (ang.ringThin) { size *= 0.85; extraTrail = 5; } // 亮环：细密小粒子

            var p = {
                x: x, y: y,
                vx: vx, vy: vy,
                gravity: gravity,
                friction: friction,
                alpha: 1,
                decay: Math.random() * 0.012 + 0.008,
                life: life,
                color: color,
                size: size,
                // 拖尾
                trail: [],
                maxTrail: extraTrail,
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

    // ============ 延迟绽放调度（性能优化） ============
    // 一次点击的烟花不再同时出现，而是分散到 ~1s 内依次绽放：
    //   - 单帧粒子峰值被摊平（同一帧最多 1 朵爆炸），高激情连点也不卡
    //   - 视觉上是连珠式连续绽放，更接近真实烟花节奏
    var pendingEffects = []; // { at: 触发时间戳, fn: 回调 }
    var MAX_PENDING = 600;  // 待触发上限（极端连点时优先丢弃较晚的爱心/次要效果）

    // 注册一个延迟效果
    function scheduleEffect(delayMs, fn) {
        if (pendingEffects.length >= MAX_PENDING) return;
        pendingEffects.push({ at: performance.now() + delayMs, fn: fn });
    }

    // 注册一朵延迟爆炸的烟花
    function scheduleExplode(delayMs, x, y, opts) {
        scheduleEffect(delayMs, function () {
            explode(x, y, opts);
        });
    }

    // 在主循环中触发到期效果（按时间排序处理，避免长时堆积）
    function processPending(time) {
        if (!pendingEffects.length) return;
        // 到期的立即触发；未到期的保留
        for (var i = pendingEffects.length - 1; i >= 0; i--) {
            if (time >= pendingEffects[i].at) {
                var fn = pendingEffects[i].fn;
                pendingEffects.splice(i, 1);
                fn();
            }
        }
    }

    // 根据激情挑选更绚烂的形状（高激情偏向复杂绚丽造型）
    function pickType(p) {
        if (p > 0.7) {
            // 高激情：双心 / 玫瑰 / 螺旋 / 牡丹 / 六瓣花 / 皇冠 / 水母
            return [1, 3, 4, 6, 7, 8, 11, 12][Math.floor(Math.random() * 8)];
        } else if (p > 0.35) {
            // 中激情：混合（含垂柳、彗星、亮环）
            return [0, 1, 2, 3, 4, 6, 9, 10, 12, 13][Math.floor(Math.random() * 10)];
        } else {
            // 低激情：基础圆形 / 心形 / 环状
            return [0, 1, 2][Math.floor(Math.random() * 3)];
        }
    }

    // ============ 点击爆炸组合（数量 / 绚烂 / 浪漫随激情变化） ============
    // 性能档位：移动端效果上限更低（考虑 PC/手机性能最大值）
    var MAX_BURST_EFFECTS = isMobile ? 4 : 5; // 一次点击 1s 内最多烟花效果数

    function explodeBurst(x, y) {
        recordClick();
        var p = getPassion();

        // 随机波动：每次点击效果在 ±20% 内浮动
        var jitter = 0.8 + Math.random() * 0.4;
        var pj = Math.min(1, p * jitter);

        // 主烟花数量：低激情 1 朵 → 高激情 2~3 朵（但受总效果上限约束）
        var mainCount = 1 + Math.floor(Math.random() * (1 + Math.round(p * 2)));
        // 卫星烟花数量：低激情 0 → 高激情 2~6 朵（受上限约束）
        var satCount = Math.round(p * (2 + Math.random() * 4));

        // 【性能约束】1s 内总烟花效果数控制在 2~5 个（移动端 ≤4）
        // 先满足主烟花，多余额度给卫星烟花
        var totalEffects = mainCount + satCount;
        var effectBudget = 2 + Math.round(Math.random() * (MAX_BURST_EFFECTS - 2)); // 2~5（移动2~4）
        if (totalEffects > effectBudget) {
            // 优先保留主烟花，压缩卫星烟花数量
            mainCount = Math.min(mainCount, Math.max(1, effectBudget - 1));
            satCount = Math.max(0, effectBudget - mainCount);
        }

        var particleScale = 1 + p * 0.9 + Math.random() * 0.3;
        var speedScale = 1 + p * 0.35 + Math.random() * 0.2;
        var crackleChance = p * 0.35;
        var glow = 1 + p * 1.2 + Math.random() * 0.3;
        var heartChance = 0.15 + p * 0.45;
        var shortTextChance = 0.08 + p * 0.6; // 短词：保持原频率
        var loveChance = 0.05 + p * 0.06;      // 长情话：低概率（约 5%~11%）
        var heartCount = Math.round(1 + p * 6 + Math.random() * 3);

        // 主烟花：第一发立即绽放，其余在 60~280ms 内错开（尽量短，不超过 ~0.3s）
        for (var m = 0; m < mainCount; m++) {
            var delay = m === 0 ? 0 : (60 + Math.random() * 220);
            scheduleExplode(delay, x, y, {
                type: pickType(pj),
                scale: particleScale / Math.sqrt(Math.max(1, mainCount)),
                speedScale: speedScale,
                crackle: crackleChance,
                glow: glow,
                palette: randomPalette()
            });
        }

        // 卫星烟花：环绕点击点一周，在 120~880ms 内依次点亮（如连珠绽放）
        if (satCount > 0) {
            for (var s = 0; s < satCount; s++) {
                var ang = (Math.PI * 2 * s) / satCount + Math.random() * 0.5;
                var dist = 70 + Math.random() * 70;
                var sx = x + Math.cos(ang) * dist;
                var sy = y + Math.sin(ang) * dist * 0.7;
                // 依次递增延迟，整体不超过 ~0.9s
                var sDelay = 120 + (s / satCount) * 620 + Math.random() * 120;
                scheduleExplode(sDelay, sx, sy, {
                    type: pickType(pj),
                    scale: (0.5 + pj * 0.5) * (0.7 + Math.random() * 0.5),
                    speedScale: speedScale * 0.9,
                    crackle: crackleChance * 0.6,
                    glow: glow * 0.7,
                    palette: randomPalette()
                });
            }
        }

        // 浪漫度：爱心在 80~700ms 内分批飘落（不一次堆满屏）
        if (Math.random() < heartChance) {
            for (var h = 0; h < heartCount; h++) {
                scheduleEffect(80 + Math.random() * 620, (function (hx, hy) {
                    return function () { spawnFallingHeart(hx, hy); };
                })(x, y));
            }
        }

        // 短词祝福：保持原频率（单行，延迟 ~200~500ms）
        if (Math.random() < shortTextChance) {
            scheduleEffect(200 + Math.random() * 300, (function (tx, ty) {
                return function () { explodeShortText(tx, ty); };
            })(x, y));
        }

        // 长情话：低概率触发（多行，延迟稍晚），由 ensureLoveAppears 保证最低频率
        if (Math.random() < loveChance) {
            scheduleEffect(250 + Math.random() * 300, (function (tx, ty) {
                return function () { tryLoveText(tx, ty); };
            })(x, y));
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

    // ============ 文字系统 ============
    // 短词：高频出现（保持原频率），单行小字，如 "爱你" / "520" / "Forever"
    var SHORT_WORDS = ['爱你', 'Forever', '甄玥', '♡', '520', '1314'];
    // 长情话：低频出现（完整三行短句），由定时器保证 1min 至少一次
    var LOVE_WORDS = [
        ['甄玥,爱你Forever', '♡', '5201314'],
        ['我想把全世界的浪漫', '都藏进一朵烟花里', '只为在你抬头时绽放'],
        ['爱意像夜空里最亮的星', '穿越亿万光年', '只为落在你眼里'],
        ['遇见你之后', '人间四季皆是春天', '星河滚烫也及不上你半分温柔'],
        ['愿陪你走过山川湖海', '也陪你细数晨昏四季', '一生一世，眼里只有你'],
        ['你是我漫长岁月里', '最盛大的一场心动', '也是我余生唯一的偏袒'],
        ['这世间万物皆明码标价', '唯独我对你的爱意', '无条件奉上，永不收回'],
        ['所有晦暗都留给过往', '从遇见你开始', '凛冬散尽，星河长明'],
        ['我看过一千个关于秋天的句子', '都不及这一刻', '微风落下的你'],
        ['你是藏在云层里的月亮', '也是我穷极一生', '想要奔赴的远方'],
        ['春风十里不如你', '夏阳满山不如你', '秋雨淅沥不如你，冬雪皑皑不如你'],
        ['我这一生都是坚定的唯物主义者', '唯有你', '我希望有来生'],
        ['海底月是天上月', '眼前人是心上人', '向来心是看客心'],
        ['纵使生活一地鸡毛', '我也愿为你', '编织成最美的烟火'],
        ['愿我如星君如月', '夜夜流光相皎洁', '月暂晦，星常明'],
        ['你是我的独家记忆', '也是我的来日方长', '岁岁年年，皆是你']
    ];
    var textBursts = [];
    var lastLoveTime = 0; // 上一次长情话出现时间（用于保证 1min 至少一次）
    var LOVE_INTERVAL = 60000; // 60 秒保底
    var usedLoveIndex = -1;
    var usedShortIndex = -1;
    // 1min 内情话出现次数统计（用于上限控制，最多 ~2 次）
    var loveTimes = [];
    var MAX_LOVE_PER_MIN = 2;

    // 记录一次长情话出现时间（用于 1min 频率上限统计）
    function recordLoveTime() {
        var now = performance.now();
        loveTimes.push(now);
        while (loveTimes.length && now - loveTimes[0] > 60000) loveTimes.shift();
        lastLoveTime = now;
    }

    // 1min 内长情话出现次数
    function loveCountInMinute() {
        var now = performance.now();
        while (loveTimes.length && now - loveTimes[0] > 60000) loveTimes.shift();
        return loveTimes.length;
    }

    // 短词：随机选一个不连续重复
    function pickShortWord() {
        var idx = Math.floor(Math.random() * SHORT_WORDS.length);
        if (idx === usedShortIndex && SHORT_WORDS.length > 1) {
            idx = (idx + 1 + Math.floor(Math.random() * (SHORT_WORDS.length - 1))) % SHORT_WORDS.length;
        }
        usedShortIndex = idx;
        return SHORT_WORDS[idx];
    }

    // 长情话：随机选一句不重复（避免连续重复）
    function pickLoveLine() {
        var idx = Math.floor(Math.random() * LOVE_WORDS.length);
        if (idx === usedLoveIndex && LOVE_WORDS.length > 1) {
            idx = (idx + 1 + Math.floor(Math.random() * (LOVE_WORDS.length - 1))) % LOVE_WORDS.length;
        }
        usedLoveIndex = idx;
        return LOVE_WORDS[idx];
    }

    // 短词：单行大字，快速浮现后淡出（保持原频率与观感）
    function explodeShortText(x, y) {
        var word = pickShortWord();
        textBursts.push({
            x: x, y: y,
            lines: [word],
            alpha: 0,
            scale: 0.6,
            life: 0,
            fadeIn: 0.06,
            fadeOut: 0.025,
            hold: 55,       // 短词停留短一些
            maxLife: 110,
            fontSize: 34
        });
    }

    // 长情话：多行逐行浮现，仅当 1min 内未超上限时才显示
    function tryLoveText(x, y) {
        if (loveCountInMinute() >= MAX_LOVE_PER_MIN) return; // 超过 1min 2 次上限则跳过
        recordLoveTime();
        explodeLoveText(x, y);
    }

    // 打出完整情话（多行，逐行绽放效果）
    function explodeLoveText(x, y) {
        var lines = pickLoveLine();
        textBursts.push({
            x: x, y: y,
            lines: lines,
            alpha: 0,
            scale: 0.6,
            life: 0,
            lineStart: 0,
            fadeIn: 0.045,  // 渐显速度
            fadeOut: 0.02,  // 渐隐速度
            hold: 130,      // 停留帧数
            maxLife: 180,
            fontSize: 26
        });
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
                // 逐行浮现：每行错开约 8 帧
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

    // 确保长情话 1 分钟至少出现一次、最多约 2 次：定时检查保底 + 频率上限
    function ensureLoveAppears(time) {
        var now = time; // ms
        // 距上次 ≥60s 且 1min 内 <2 次 → 保底触发
        if (now - lastLoveTime >= LOVE_INTERVAL && loveCountInMinute() < MAX_LOVE_PER_MIN) {
            lastLoveTime = now;
            var lx = W * (0.3 + Math.random() * 0.4);
            var ly = H * (0.25 + Math.random() * 0.2);
            recordLoveTime();
            explodeLoveText(lx, ly);
            // 伴随一朵爱心烟花，呼应情话（更浪漫）
            scheduleExplode(150, lx, ly + 40, {
                type: 1,
                scale: 0.55,
                speedScale: 0.8,
                crackle: 0.2,
                glow: 1.4,
                palette: randomPalette()
            });
        }
    }

    function update(dt, time) {
        // 触发到期的延迟绽放效果（一次点击的烟花分散在 ~1s 内依次出现）
        processPending(time);

        // 确保浪漫情话 1 分钟至少出现一次
        ensureLoveAppears(time);

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
                    explodeShortText(r.x, r.y);
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
            if (pt.trail.length > (pt.maxTrail || 4)) pt.trail.shift();
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
        maybeSpawnMeteor(performance.now() / 1000);

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
    lastLoveTime = performance.now() + 1000; // 首次长情话在页面加载约 1s 后即可出现
    nextLaunch = performance.now() + 1200;
    requestAnimationFrame(loop);

    // 暴露接口（调试用）
    global.Fireworks = {
        launch: launch,
        explode: explode,
        explodeBurst: explodeBurst,
        getPassion: getPassion,
        recordClick: recordClick,
        // 调试/测试：返回内部状态（粒子数、待触发效果数、激情）
        debug: function () {
            var now = performance.now();
            // 统计最近 1s 内实际爆炸的烟花效果数
            var recent = 0;
            for (var i = burstEffectLog.length - 1; i >= 0; i--) {
                if (now - burstEffectLog[i] <= 1000) recent++;
                else break;
            }
            return {
                particles: particles.length,
                pending: pendingEffects.length,
                rockets: rockets.length,
                fallingHearts: fallingHearts.length,
                passion: getPassion(),
                burstLast1s: recent,
                loveCount1min: loveCountInMinute()
            };
        }
    };
})(window);
