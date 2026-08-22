/* ============================================================
 * 环境音播放器 env-player.js
 *
 * 用法：
 *   <script src="../../js/env-player.js"></script>
 *   <script>
 *       EnvPlayer.init({ file: 'forest_summer.mp3', audioDir: '../../audio/env' });
 *   </script>
 *
 * 功能：
 *   - 页面加载后循环播放主题环境音（音量低，营造氛围）
 *   - 浏览器自动播放被拦截时，首次用户交互后自动启动
 *   - 与背景音乐、对白共存（环境音较安静）
 * ============================================================ */
(function (global) {
    'use strict';

    var audio = null;
    var started = false;

    function start() {
        if (started || !audio) return;
        started = true;
        var p = audio.play();
        if (p && p.catch) p.catch(function () { /* 忽略 */ });
    }

    function init(opts) {
        opts = opts || {};
        var file = opts.file || '';
        var audioDir = opts.audioDir || 'audio/env';
        if (!file) return;

        audio = new Audio();
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = opts.volume || 0.2;
        audio.setAttribute('data-env', '1');
        audio.src = audioDir + '/' + file;
        // 挂到 DOM，确保被 GC 前可靠播放
        if (document.body) {
            document.body.appendChild(audio);
        }

        // 尝试自动播放
        start();

        // 首次用户交互兜底（覆盖浏览器自动播放限制）
        var tryStart = function () {
            start();
        };
        document.addEventListener('click', tryStart, { once: true });
        document.addEventListener('touchstart', tryStart, { once: true });
        document.addEventListener('keydown', tryStart, { once: true });

        // 对白播放时略微降低环境音（避免干扰），播完恢复
        global.addEventListener('voice-overlay', function (e) {
            if (!audio) return;
            if (e.detail && e.detail.paused) {
                audio.volume = (opts.volume || 0.2) * 0.4;
            } else {
                audio.volume = opts.volume || 0.2;
            }
        });
    }

    global.EnvPlayer = {
        init: init
    };
})(window);
