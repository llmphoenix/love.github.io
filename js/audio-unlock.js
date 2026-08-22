/* ============================================================
 * 统一音频解锁 audio-unlock.js
 *
 * 用法：
 *   <script src="../../js/audio-unlock.js"></script>
 *   <script>
 *       AudioUnlock.init();
 *   </script>
 *
 * 功能：
 *   - 浏览器自动播放策略要求"用户手势"才能播放音频
 *   - 首次进入页面无手势 → 背景音乐/环境音/对白都被拦截
 *   - 本模块监听页面第一次真实用户手势（pointerdown 最早），
 *     统一解锁：恢复背景音乐(MusicPlayer.play) + 启动环境音(EnvPlayer.unlock)
 *             + 解锁对白播放器(VoicePlayer.unlock)
 *   - 之后任意点击都会再次尝试（幂等，已启动则跳过）
 * ============================================================ */
(function (global) {
    'use strict';

    var unlocked = false;

    function unlockAll() {
        if (unlocked) return;
        unlocked = true;

        // 1. 启动背景音乐（若未播放）
        if (global.MusicPlayer && typeof global.MusicPlayer.isPlaying === 'function') {
            var playing = false;
            try { playing = global.MusicPlayer.isPlaying(); } catch (e) { /* 忽略 */ }
            if (!playing && typeof global.MusicPlayer.play === 'function') {
                try { global.MusicPlayer.play(); } catch (e) { /* 忽略 */ }
            }
        }

        // 2. 启动环境音（若未启动）
        if (global.EnvPlayer && typeof global.EnvPlayer.unlock === 'function') {
            try { global.EnvPlayer.unlock(); } catch (e) { /* 忽略 */ }
        }

        // 3. 解锁对白播放器（确保其 AudioContext 可用并预载对白）
        if (global.VoicePlayer && typeof global.VoicePlayer.unlock === 'function') {
            try { global.VoicePlayer.unlock(); } catch (e) { /* 忽略 */ }
        }
    }

    function init() {
        // pointerdown 是最早的用户手势事件（比 click/touchstart 更可靠、更早）
        var handlers = ['pointerdown', 'touchstart', 'mousedown', 'click', 'keydown'];
        for (var i = 0; i < handlers.length; i++) {
            document.addEventListener(handlers[i], unlockAll, { once: true });
        }
    }

    global.AudioUnlock = {
        init: init,
        unlock: unlockAll
    };
})(window);
