/* ============================================================
 * 爱情对白播放器 voice-player.js
 *
 * 用法：
 *   <script src="../../js/voice-player.js"></script>
 *   <script>
 *       VoicePlayer.init({ theme: 'rose', canvasId: 'roses', variants: { f: 2, m: 2, b: 2 } });
 *   </script>
 *
 * 功能：
 *   - 每个主题对应多组爱情对白（女声/男声/男女对话，各有若干句）
 *   - 点击画布时随机播放其中一段，且尽量不与上次重复
 *   - 播放对白时压低背景音乐音量（混合播放，不暂停/关闭），对白结束恢复
 *   - 用"引用计数"协调：多条对白叠放时，全部播完才恢复背景音乐音量
 *   - 定时器兜底：即使对白播放失败/onended 不触发，也会恢复背景音乐音量
 *
 * ★ 手机端多路混音方案（重要）：
 *   手机（尤其 iOS Safari）同时只允许一个 <audio> 元素出声。
 *   因此本播放器【改用 Web Audio API】播放对白，实现三声真正同时混合：
 *     - 背景音乐：<audio>（唯一 audio，连续播放稳定，不与任何声音争抢）
 *     - 环境音：  Web Audio（AudioContext 循环播放）
 *     - 对白：    Web Audio（AudioContext 一次性播放，与背景音乐/环境音混音）
 *   三者互不抢占 <audio> 单实例，三声同时播放、对白结束后背景音乐恢复。
 *
 * 文件命名约定（audio/voices/ 目录）：
 *   {theme}_female1.mp3 / {theme}_female2.mp3 ...
 *   {theme}_male1.mp3   / {theme}_male2.mp3 ...
 *   {theme}_both1.mp3   / {theme}_both2.mp3 ...
 * ============================================================ */
(function (global) {
    'use strict';

    var theme = '';
    var audioDir = 'audio/voices';
    var lastPlayAt = 0;

    // 各类型句数（f=女声, m=男声, b=对话），由 init 传入
    var variants = { f: 1, m: 1, b: 1 };
    // 记录上次播放（type, index），用于不重复
    var lastPick = null;

    // 背景音乐被对白压低的引用计数（>0 表示因对白处于低音量）
    var musicDuckCount = 0;
    // 对白播放前背景音乐的原始音量（首个对白播放时记录）
    var musicOriginalVolume = 1.0;
    // 对白播放时背景音乐的压低音量（混合播放：音乐小声但清晰可闻）
    var DUCK_VOLUME = 0.4;
    // 上一个对白的兜底定时器（切换对白时清除，避免叠加）
    var lastSafetyTimer = null;

    // 对白播放冷却：间隔 > 1s 才触发（上一个没播放完时点击不会播放新的）
    var MIN_INTERVAL = 1000;

    // ---- Web Audio 相关 ----
    // 共享 AudioContext（优先复用 EnvPlayer 的，避免创建多个 context）
    var sharedCtx = null;
    // 对白总音量控制节点（连到 ctx.destination）
    var voiceGain = null;
    // 正在播放的对白源（用于清理/调试）
    var activeSources = [];
    // 对白缓冲缓存：{ fname: AudioBuffer }
    var bufferCache = {};
    // 正在加载的缓冲（避免重复请求）：{ fname: Promise }
    var loadingCache = {};
    // 跨浏览器 AudioContext 构造函数
    var AudioContextCtor = global.AudioContext ||
        global.webkitAudioContext ||
        global.mozAudioContext ||
        global.msAudioContext;

    // 获取共享 AudioContext（优先复用 EnvPlayer 的）
    function getSharedContext() {
        if (sharedCtx) return sharedCtx;
        if (global.EnvPlayer && typeof global.EnvPlayer.getContext === 'function') {
            try {
                var ectx = global.EnvPlayer.getContext();
                if (ectx) { sharedCtx = ectx; }
            } catch (e) { /* 忽略 */ }
        }
        if (!sharedCtx && AudioContextCtor) {
            try { sharedCtx = new AudioContextCtor(); } catch (e) { /* 忽略 */ }
        }
        return sharedCtx;
    }

    // 确保对白音量控制节点存在并连接
    function ensureVoiceGain() {
        var ctx = getSharedContext();
        if (!ctx) return null;
        if (!voiceGain) {
            try {
                voiceGain = ctx.createGain();
                voiceGain.gain.value = 1.0;
                voiceGain.connect(ctx.destination);
            } catch (e) {
                voiceGain = null;
            }
        }
        return voiceGain;
    }

    // 预加载一个对白文件并解码为 AudioBuffer（带缓存）
    function loadBuffer(fname) {
        var ctx = getSharedContext();
        if (!ctx) {
            // AudioContext 尚未就绪（如首次进入未交互），返回失败，稍后由 unlock 预载
            return Promise.reject(new Error('no-context'));
        }
        if (bufferCache[fname]) return Promise.resolve(bufferCache[fname]);
        if (loadingCache[fname]) return loadingCache[fname];

        var url = audioDir + '/' + fname;
        var p = fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('fetch-fail ' + res.status);
                return res.arrayBuffer();
            })
            .then(function (buf) {
                return new Promise(function (resolve, reject) {
                    ctx.decodeAudioData(buf, resolve, reject);
                });
            })
            .then(function (audioBuf) {
                bufferCache[fname] = audioBuf;
                loadingCache[fname] = null;
                return audioBuf;
            })
            .catch(function (err) {
                loadingCache[fname] = null;
                throw err;
            });
        loadingCache[fname] = p;
        return p;
    }

    // 用 Web Audio 播放一段对白缓冲
    function playBuffer(audioBuf) {
        var ctx = getSharedContext();
        var gain = ensureVoiceGain();
        if (!ctx || !gain) return null;
        try {
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            var src = ctx.createBufferSource();
            src.buffer = audioBuf;
            src.connect(gain);
            src.onended = function () {
                var i = activeSources.indexOf(src);
                if (i >= 0) activeSources.splice(i, 1);
                // 对白结束 → 恢复背景音乐音量与环境音
                unduckMusic();
                global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: false } }));
                // 清除兜底定时器（已通过 onended 恢复）
                if (lastSafetyTimer) {
                    clearTimeout(lastSafetyTimer);
                    lastSafetyTimer = null;
                }
            };
            activeSources.push(src);
            src.start(0);
            return src;
        } catch (e) {
            return null;
        }
    }

    // 随机选一段，尽量不与上次重复（类型 + 序号都避免连续相同）
    function pickDialogue() {
        var types = ['f', 'm', 'b'];
        // 先随机一个类型，若与上次相同且有其他类型，则换一个
        var type = types[Math.floor(Math.random() * types.length)];
        if (lastPick && variants[type] > 0) {
            // 若类型相同，50% 概率换类型
            var others = types.filter(function (t) { return t !== type && variants[t] > 0; });
            if (Math.random() < 0.5 && others.length) {
                type = others[Math.floor(Math.random() * others.length)];
            }
        }
        var count = variants[type] || 1;
        var idx = Math.floor(Math.random() * count);
        // 序号不重复：若与上次同类型且同序号，换一个序号
        if (lastPick && lastPick.type === type && count > 1) {
            idx = (idx + 1) % count;
        }
        lastPick = { type: type, idx: idx };
        var suffix = { f: 'female', m: 'male', b: 'both' }[type];
        return theme + '_' + suffix + (idx + 1) + '.mp3';
    }

    // 压低背景音乐（引用计数：多条对白叠放只压一次，混合播放不暂停）
    function duckMusic() {
        if (musicDuckCount === 0) {
            // 记录首个对白播放前音乐的原始音量
            musicOriginalVolume = 1.0;
            if (global.MusicPlayer && typeof global.MusicPlayer.getBaseVolume === 'function') {
                try { musicOriginalVolume = global.MusicPlayer.getBaseVolume(); } catch (e) { /* 忽略 */ }
            }
            if (global.MusicPlayer && typeof global.MusicPlayer.setVolume === 'function') {
                try { global.MusicPlayer.setVolume(DUCK_VOLUME); } catch (e) { /* 忽略 */ }
            }
        }
        musicDuckCount++;
    }

    // 恢复背景音乐音量（引用计数归零才真正恢复，避免中途被错误恢复）
    function unduckMusic() {
        if (musicDuckCount > 0) musicDuckCount--;
        if (musicDuckCount === 0 &&
            global.MusicPlayer && typeof global.MusicPlayer.setVolume === 'function') {
            try { global.MusicPlayer.setVolume(musicOriginalVolume); } catch (e) { /* 忽略 */ }
        }
    }

    function handlePointer() {
        var now = Date.now();
        // 上一个对白还没播放完：点击不播放新的
        if (activeSources.length > 0) return;
        // 点击冷却：1s 间隔内不重复触发
        if (now - lastPlayAt < MIN_INTERVAL) return;
        lastPlayAt = now;

        var fname = pickDialogue();

        // 清除上一个对白的兜底定时器（避免叠加多次恢复）
        if (lastSafetyTimer) {
            clearTimeout(lastSafetyTimer);
            lastSafetyTimer = null;
        }

        // 压低背景音乐音量（混合播放：音乐继续但不打扰对白）
        duckMusic();

        // 通知环境音播放器降低音量
        global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: true } }));

        // 用 Web Audio 播放：先加载/取缓冲，再播放
        loadBuffer(fname).then(function (audioBuf) {
            var src = playBuffer(audioBuf);
            if (src) {
                // 兜底：对白最长约 5 秒，6 秒后强制恢复（防止 onended 在手机上不触发）
                lastSafetyTimer = setTimeout(function () {
                    lastSafetyTimer = null;
                    unduckMusic();
                    global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: false } }));
                }, 6000);
            }
        }).catch(function () {
            // 加载/播放失败：立即恢复背景音乐音量与环境音（避免音乐一直压低）
            unduckMusic();
            global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: false } }));
        });
    }

    // 预加载当前主题的所有对白（进入页面后预热，避免首次点击卡顿）
    function preloadAll() {
        var list = [];
        Object.keys(variants).forEach(function (t) {
            var count = variants[t] || 0;
            var suffix = { f: 'female', m: 'male', b: 'both' }[t];
            for (var i = 1; i <= count; i++) {
                list.push(theme + '_' + suffix + i + '.mp3');
            }
        });
        list.forEach(function (fname) {
            loadBuffer(fname).catch(function () { /* 预载失败忽略 */ });
        });
    }

    function init(opts) {
        opts = opts || {};
        theme = opts.theme || '';
        audioDir = opts.audioDir || 'audio/voices';
        if (opts.variants) {
            variants = {
                f: opts.variants.f || 1,
                m: opts.variants.m || 1,
                b: opts.variants.b || 1
            };
        }
        var canvasId = opts.canvasId || '';

        // 预加载当前主题对白（若 AudioContext 未就绪会跳过，解锁后由 unlock 补载）
        preloadAll();

        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // 叠加在原有交互上（不覆盖原 pointerup 逻辑）
        canvas.addEventListener('pointerup', function () {
            handlePointer();
        });
    }

    global.VoicePlayer = {
        init: init,
        play: handlePointer,
        // 供统一音频解锁调用：确保 AudioContext 可用并预载对白
        unlock: function () {
            var ctx = getSharedContext();
            if (ctx && ctx.state === 'suspended') {
                try { ctx.resume(); } catch (e) { /* 忽略 */ }
            }
            ensureVoiceGain();
            preloadAll();
        },
        // 调试：返回内部状态
        debug: function () {
            return {
                theme: theme,
                hasCtx: !!getSharedContext(),
                ctxState: getSharedContext() ? getSharedContext().state : 'none',
                hasGain: !!voiceGain,
                buffered: Object.keys(bufferCache).length,
                active: activeSources.length,
                duckCount: musicDuckCount
            };
        }
    };
})(window);
