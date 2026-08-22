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

    // 对白播放节流：间隔 > 0.6s 才触发（每次点击都播放，仅防极速连点重叠）
    var MIN_INTERVAL = 600;

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

        if (!audio) {
            audio = new Audio();
            audio.preload = 'auto';
        }
        // 停止当前对白并切换
        audio.pause();
        audio.src = '';
        audio.onended = null;
        audio.ontimeupdate = null;
        audio.src = audioDir + '/' + fname;
        var p = audio.play();
        if (p && p.catch) {
            p.catch(function () {
                // 对白播放失败：立即恢复背景音乐音量与环境音（避免音乐一直压低）
                unduckMusic();
                global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: false } }));
            });
        }

        // 对白结束 → 恢复背景音乐音量与环境音
        audio.onended = function () {
            unduckMusic();
            global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: false } }));
        };

        // 兜底：对白最长约 5 秒，6 秒后强制恢复（防止 onended 在手机上不触发）
        lastSafetyTimer = setTimeout(function () {
            lastSafetyTimer = null;
            unduckMusic();
            global.dispatchEvent(new CustomEvent('voice-overlay', { detail: { paused: false } }));
        }, 6000);
        audio.ontimeupdate = function () {
            // 对白播完后清除兜底定时器（已通过 onended 恢复）
            if (audio.ended && lastSafetyTimer) {
                clearTimeout(lastSafetyTimer);
                lastSafetyTimer = null;
            }
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
