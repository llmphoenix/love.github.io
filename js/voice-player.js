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
 *   - 播放对白时暂停背景音乐（MusicPlayer.pause），播完自动恢复（MusicPlayer.resume）
 *   - 2.5s 节流防连点重叠
 *
 * 文件命名约定（audio/voices/ 目录）：
 *   {theme}_female1.mp3 / {theme}_female2.mp3 ...
 *   {theme}_male1.mp3   / {theme}_male2.mp3 ...
 *   {theme}_both1.mp3   / {theme}_both2.mp3 ...
 * ============================================================ */
(function (global) {
    'use strict';

    var audio = null;
    var theme = '';
    var audioDir = 'audio/voices';
    var musicWasPlaying = false;
    var lastPlayAt = 0;

    // 各类型句数（f=女声, m=男声, b=对话），由 init 传入
    var variants = { f: 1, m: 1, b: 1 };
    // 记录上次播放（type, index），用于不重复
    var lastPick = null;

    // 对白播放节流：间隔 > 2.5s 才触发
    var MIN_INTERVAL = 2500;

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

    function handlePointer() {
        var now = Date.now();
        if (now - lastPlayAt < MIN_INTERVAL) return;
        lastPlayAt = now;

        var fname = pickDialogue();

        // 对白开始时暂停背景音乐（如果它在播）
        musicWasPlaying = false;
        if (global.MusicPlayer && typeof global.MusicPlayer.isPlaying === 'function') {
            try { musicWasPlaying = global.MusicPlayer.isPlaying(); } catch (e) { /* 忽略 */ }
        }
        if (musicWasPlaying && global.MusicPlayer && typeof global.MusicPlayer.pause === 'function') {
            try { global.MusicPlayer.pause(); } catch (e) { /* 忽略 */ }
        }

        // 通知环境音播放器降低音量
        global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: true } }));

        if (!audio) {
            audio = new Audio();
            audio.preload = 'auto';
        }
        // 停止当前对白并切换
        audio.pause();
        audio.src = '';
        audio.onended = null;
        audio.src = audioDir + '/' + fname;
        var p = audio.play();
        if (p && p.catch) {
            p.catch(function () { /* 自动播放被拦截则忽略 */ });
        }

        // 对白结束后恢复背景音乐与环境音
        audio.onended = function () {
            if (musicWasPlaying && global.MusicPlayer && typeof global.MusicPlayer.resume === 'function') {
                try { global.MusicPlayer.resume(); } catch (e) { /* 忽略 */ }
            }
            global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: false } }));
        };
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

        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // 叠加在原有交互上（不覆盖原 pointerup 逻辑）
        canvas.addEventListener('pointerup', function () {
            handlePointer();
        });
    }

    global.VoicePlayer = {
        init: init,
        play: handlePointer
    };
})(window);
