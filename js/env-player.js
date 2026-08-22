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
 *   - 使用 Web Audio API（AudioContext），手机上比 <audio> 更可靠：
 *     浏览器自动播放限制下，首次用户交互 resume() 后即可播放，
 *     且可与背景音乐/对白同时共存
 *   - 对白播放时略微降低环境音（避免干扰），播完恢复
 * ============================================================ */
(function (global) {
    'use strict';

    var ctx = null;
    var source = null;
    var gain = null;
    var buffer = null;
    var started = false;
    var baseVolume = 0.5;
    var audioFallback = null;  // <audio> 兜底元素
    var audioDir = 'audio/env';
    var file = '';

    function createContext() {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        try {
            return new AC();
        } catch (e) {
            return null;
        }
    }

    // 真正创建并启动循环音源（必须在 context 处于 running 状态）
    function startSource() {
        if (!ctx || !buffer || started) return;
        if (ctx.state !== 'running') return; // 尚未解锁，等待 resume 完成后再调
        source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        gain.gain.value = baseVolume;
        try {
            source.start(0);
            started = true;
        } catch (e) {
            // 状态异常：回退到 <audio> 兜底
            startFallback();
        }
    }

    function startFallback() {
        if (started || !file) return;
        if (!audioFallback) {
            audioFallback = new Audio();
            audioFallback.loop = true;
            audioFallback.preload = 'auto';
            audioFallback.src = audioDir + '/' + file;
            if (document.body) document.body.appendChild(audioFallback);
        }
        var p = audioFallback.play();
        if (p && p.then) {
            p.then(function () { started = true; })
             .catch(function () { /* 被拦截，等下次交互重试 */ });
        } else {
            started = true;
        }
    }

    function start() {
        if (started) return;
        if (ctx && buffer) {
            if (ctx.state === 'suspended') {
                // 先解锁音频上下文，完成后才真正启动（手机上关键）
                ctx.resume().then(function () {
                    startSource();
                }).catch(function () {
                    // resume 失败：回退到 <audio>
                    startFallback();
                });
            } else if (ctx.state === 'running') {
                startSource();
            } else {
                startFallback();
            }
        } else if (!ctx) {
            // 无 AudioContext 支持：直接 <audio> 兜底
            startFallback();
        }
        // buffer 尚未解码完成：等 onload 解码后自动 start，这里先不动作
    }

    function init(opts) {
        opts = opts || {};
        file = opts.file || '';
        audioDir = opts.audioDir || 'audio/env';
        if (!file) return;

        baseVolume = opts.volume || 0.5;
        ctx = createContext();

        if (ctx) {
            gain = ctx.createGain();
            gain.gain.value = baseVolume;
            gain.connect(ctx.destination);

            // 预加载并解码环境音
            var url = audioDir + '/' + file;
            var req = new XMLHttpRequest();
            req.open('GET', url, true);
            req.responseType = 'arraybuffer';
            req.onload = function () {
                if (ctx && typeof ctx.decodeAudioData === 'function') {
                    ctx.decodeAudioData(req.response, function (decoded) {
                        buffer = decoded;
                        // 尝试自动播放（桌面通常可以）
                        start();
                    }, function () {
                        // 解码失败：回退到 <audio>
                        startFallback();
                    });
                } else {
                    startFallback();
                }
            };
            req.onerror = function () {
                // 加载失败：回退到 <audio>
                startFallback();
            };
            req.send();
        } else {
            // 无 AudioContext：直接用 <audio> 兜底
            startFallback();
        }

        // 首次用户交互兜底（覆盖浏览器自动播放限制）
        // 注意：不能 once，若首次交互仍未解锁，需多次交互重试
        var tryStart = function () {
            start();
        };
        document.addEventListener('click', tryStart);
        document.addEventListener('pointerup', tryStart);
        document.addEventListener('touchstart', tryStart);
        document.addEventListener('touchend', tryStart);
        document.addEventListener('keydown', tryStart);

        // 对白播放时略微降低环境音（避免干扰），播完恢复
        var setVolume = function (v) {
            baseVolume = v;
            if (gain) {
                gain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.3);
            }
            if (audioFallback) {
                audioFallback.volume = v;
            }
        };
        global.addEventListener('voice-overlay', function (e) {
            var target = baseVolume;
            if (e.detail && e.detail.paused) {
                target = baseVolume * 0.4;
            } else {
                target = baseVolume;
            }
            if (gain) {
                gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.3);
            }
            if (audioFallback) {
                audioFallback.volume = target;
            }
        });
    }

    global.EnvPlayer = {
        init: init,
        // 强制解锁并启动环境音（供统一音频解锁调用）
        unlock: function () {
            start();
        },
        // 调试：返回内部状态
        debug: function () {
            return {
                hasCtx: !!ctx,
                ctxState: ctx ? ctx.state : 'none',
                hasBuffer: !!buffer,
                started: started,
                gain: gain ? gain.gain.value : 0,
                baseVolume: baseVolume,
                usingFallback: !!audioFallback
            };
        }
    };
})(window);
