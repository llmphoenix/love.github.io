/**
 * 爱心流星 · 鼠标轨迹拖尾效果
 * 纯 Canvas 实现，无任何依赖，全页面通用。
 * 用法：在 <body> 闭合前引入本脚本即可自动生效。
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    function init() {
        var canvas = document.createElement('canvas');
        canvas.id = 'heart-trail-canvas';
        var style = canvas.style;
        style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'width:100%',
            'height:100%',
            'pointer-events:none',
            'z-index:9999',
            'display:block'
        ].join(';') + ';';
        document.body.appendChild(canvas);
        main(canvas);
    }

    // 若脚本在 <head> 中执行、body 尚未存在，则等待 DOM 就绪
    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    function main(canvas) {
    var ctx = canvas.getContext('2d');
    var timer = null;         // 动画循环句柄
    var hearts = [];          // 活跃爱心粒子
    var past = [];            // 鼠标历史轨迹
    var mouseX = -100;
    var mouseY = -100;
    var hasMouse = false;
    var lastMoveTime = 0;     // 最近一次鼠标动作时间
    var lastSpawn = 0;
    var W = 0;
    var H = 0;

    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function random(min, max) {
        return min + Math.random() * (max - min);
    }

    // 绘制一颗爱心（path）
    function drawHeartPath(x, y, size) {
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.3);
        ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + size * 0.3);
        ctx.bezierCurveTo(x - size / 2, y + size * 0.6, x, y + size * 0.75, x, y + size);
        ctx.bezierCurveTo(x, y + size * 0.75, x + size / 2, y + size * 0.6, x + size / 2, y + size * 0.3);
        ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size * 0.3);
        ctx.closePath();
    }

    // 尾迹粒子
    function createTail(x, y) {
        var hue = random(335, 355); // 粉红 ~ 玫红
        return {
            x: x,
            y: y,
            vx: random(-0.6, 0.6),
            vy: random(-0.6, 0.6),
            size: random(1, 2.6),
            life: 1,
            decay: random(0.035, 0.06),
            hue: hue,
            alpha: random(0.25, 0.5)
        };
    }

    // 爱心粒子（流星主体）
    function createHeart(x, y, vx, vy) {
        var size = random(8, 18);
        return {
            x: x,
            y: y,
            vx: vx + random(-0.8, 0.8),
            vy: vy + random(-0.8, 0.8),
            size: size,
            initSize: size,
            rotation: random(-Math.PI, Math.PI),
            rotSpeed: random(-0.12, 0.12),
            life: 1,
            decay: random(0.015, 0.028),
            hue: random(335, 355),
            sat: random(85, 100),
            light: random(55, 70),
            // 星星闪烁
            sparkle: Math.random() < 0.4,
            sparklePhase: random(0, Math.PI * 2),
            // 拖尾
            tails: [],
            lastTail: 0
        };
    }

    function spawn(x, y, vx, vy) {
        // 流星主体
        var h = createHeart(x, y, vx, vy);
        hearts.push(h);
        // 拖尾粒子
        var n = Math.floor(random(5, 10));
        for (var i = 0; i < n; i++) {
            h.tails.push(createTail(
                x - vx * random(0.5, 3),
                y - vy * random(0.5, 3)
            ));
        }
    }

    function addTrailPoint(x, y) {
        past.push({ x: x, y: y, t: Date.now() });
        if (past.length > 24) past.shift();
    }

    function update() {
        // 清理过期轨迹点
        var now = Date.now();
        while (past.length > 0 && now - past[0].t > 180) {
            past.shift();
        }

        // 每帧沿轨迹生成流星（仅最近有移动时）
        if (hasMouse && now - lastMoveTime < 300) {
            var rate = Math.max(40, 110 - past.length * 3);
            if (now - lastSpawn > rate) {
                lastSpawn = now;
                if (past.length >= 2) {
                    var p0 = past[past.length - 2];
                    var p1 = past[past.length - 1];
                    var vx = (p1.x - p0.x) * 0.15;
                    var vy = (p1.y - p0.y) * 0.15;
                    spawn(p1.x, p1.y, vx, vy);
                } else {
                    spawn(mouseX, mouseY, random(-0.6, 0.6), random(-0.6, 0.6));
                }
            }
        }

        // 更新粒子
        for (var i = hearts.length - 1; i >= 0; i--) {
            var h = hearts[i];
            h.life -= h.decay;
            h.rotation += h.rotSpeed;
            h.vx *= 0.94;
            h.vy *= 0.94;
            h.x += h.vx;
            h.y += h.vy;

            // 尾迹粒子更新
            for (var t = h.tails.length - 1; t >= 0; t--) {
                var tl = h.tails[t];
                tl.life -= tl.decay;
                tl.x += tl.vx;
                tl.y += tl.vy;
                tl.vx *= 0.94;
                tl.vy *= 0.94;
                if (tl.life <= 0) h.tails.splice(t, 1);
            }

            // 移动时补充拖尾
            if (Math.abs(h.vx) + Math.abs(h.vy) > 0.4 && now - h.lastTail > 24) {
                h.lastTail = now;
                h.tails.push(createTail(h.x, h.y));
            }

            if (h.life <= 0) hearts.splice(i, 1);
        }
    }

    function render() {
        ctx.clearRect(0, 0, W, H);

        // 拖尾粒子
        for (var i = 0; i < hearts.length; i++) {
            var h = hearts[i];
            for (var j = 0; j < h.tails.length; j++) {
                var tl = h.tails[j];
                ctx.globalAlpha = Math.max(0, tl.life * tl.alpha);
                ctx.fillStyle = 'hsl(' + tl.hue + ', 100%, 68%)';
                ctx.beginPath();
                ctx.arc(tl.x, tl.y, tl.size * tl.life, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 爱心主体
        for (var k = 0; k < hearts.length; k++) {
            var hh = hearts[k];
            var scale = Math.max(0.15, hh.life);
            var size = hh.size * (0.4 + 0.6 * scale);

            ctx.save();
            ctx.translate(hh.x, hh.y);
            ctx.rotate(hh.rotation);
            // 发光
            ctx.globalAlpha = 0.35 * scale;
            ctx.fillStyle = 'hsla(' + hh.hue + ', ' + hh.sat + '%, ' + (hh.light + 8) + '%, 1)';
            ctx.shadowColor = 'hsla(' + hh.hue + ', 100%, 70%, 0.9)';
            ctx.shadowBlur = 18;
            drawHeartPath(0, 0, size);
            ctx.fill();
            // 主体
            ctx.globalAlpha = 0.95 * scale;
            ctx.shadowBlur = 8;
            var grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
            grad.addColorStop(0, 'hsl(' + hh.hue + ', ' + hh.sat + '%, ' + hh.light + '%)');
            grad.addColorStop(1, 'hsl(' + (hh.hue - 12) + ', ' + hh.sat + '%, ' + (hh.light - 12) + '%)');
            ctx.fillStyle = grad;
            drawHeartPath(0, 0, size);
            ctx.fill();

            // 高光
            ctx.globalAlpha = 0.5 * scale;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(-size * 0.18, -size * 0.2, size * 0.1, 0, Math.PI * 2);
            ctx.fill();

            // 星星闪烁
            if (hh.sparkle) {
                hh.sparklePhase += 0.15;
                var tw = (Math.sin(hh.sparklePhase) * 0.5 + 0.5) * scale;
                ctx.globalAlpha = tw * 0.9;
                ctx.fillStyle = '#fff';
                var sw = size * 0.22;
                ctx.fillRect(-sw / 2, -sw / 2, sw, sw);
            }
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    }

    function frame() {
        update();
        render();
        // 仍有活跃粒子或仍在移动时继续下一帧，否则停止循环（省电）
        if (hearts.length > 0 || Date.now() - lastMoveTime < 300) {
            timer = setTimeout(frame, 16); // ~60fps
        } else {
            timer = null;
        }
    }

    // ---- 事件 ----
    function onMove(e) {
        var x = e.clientX;
        var y = e.clientY;
        mouseX = x;
        mouseY = y;
        hasMouse = true;
        lastMoveTime = Date.now();
        addTrailPoint(x, y);
        ensureLoop();
    }

    function onTouch(e) {
        if (e.touches.length > 0) {
            var x = e.touches[0].clientX;
            var y = e.touches[0].clientY;
            mouseX = x;
            mouseY = y;
            hasMouse = true;
            lastMoveTime = Date.now();
            addTrailPoint(x, y);
            ensureLoop();
        }
    }

    // 确保动画循环在运行（首次移动时启动）
    function ensureLoop() {
        if (timer === null) {
            timer = setTimeout(frame, 0);
        }
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('resize', resize);

    resize();
    timer = null; // 循环由首次鼠标/触摸移动触发，空闲时零开销
    } // end main
})();
