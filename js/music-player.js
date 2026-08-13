/* ============================================================
 * 统一背景音乐播放器 music-player.js
 *
 * 用法：
 *   <script src="js/music-player.js"></script>
 *   <script>
 *       MusicPlayer.init({ audioDir: 'audio', buttonId: 'musicBtn' });
 *   </script>
 *
 * 功能：
 *   - 多首爱情纯音乐，进入页面随机选一首播放
 *   - 一首播放完自动随机切换到下一首（尽量不重复上一首）
 *   - 默认自动播放；被浏览器拦截时，首次点击/触摸页面任意处即开始播放
 *   - 跨页面延续：同一标签页内跳转时，恢复上一页正在播放的曲目与进度（sessionStorage）
 *   - 按钮：点击切换 播放/暂停，播放时图标旋转
 *
 * 注意：本脚本为共享模块，各页面通过 <script> 引入后调用 init 即可。
 * ============================================================ */
(function (global) {
    'use strict';

    // 播放列表：爱情纯音乐（文件名，需放在 audioDir 目录下）
    var PLAYLIST = [
        'Broken Elegance.mp3',
        'Tender Confession.mp3',
        'Starlit Promise.mp3',
        'Eternal Vow.mp3'
    ];

    var settings = {
        audioDir: 'audio',
        buttonId: 'musicBtn'
    };

    var audio = null;
    var btn = null;
    var isPlaying = false;
    var currentIndex = -1;

    // 跨页面延续使用的存储键
    var STORAGE_KEY = 'love_bg_music_state';

    function storageKey() {
        return STORAGE_KEY;
    }

    function getStorage() {
        try {
            return JSON.parse(sessionStorage.getItem(storageKey())) || {};
        } catch (e) {
            return {};
        }
    }

    function setStorage(state) {
        try {
            sessionStorage.setItem(storageKey(), JSON.stringify(state));
        } catch (e) { /* 忽略隐私模式等异常 */ }
    }

    function clearStorage() {
        try {
            sessionStorage.removeItem(storageKey());
        } catch (e) { /* 忽略 */ }
    }

    function pickIndex(avoid) {
        if (PLAYLIST.length === 0) return -1;
        if (PLAYLIST.length === 1) return 0;
        var idx = Math.floor(Math.random() * PLAYLIST.length);
        // 尽量不重复上一首（避免连续听同一首）
        if (idx === avoid) {
            idx = (idx + 1) % PLAYLIST.length;
        }
        return idx;
    }

    function fileUrl(index) {
        return settings.audioDir + '/' + PLAYLIST[index];
    }

    function loadTrack(index, startTime) {
        if (index < 0 || index >= PLAYLIST.length) return;
        currentIndex = index;
        audio.src = fileUrl(index);
        audio.load();
        if (startTime && startTime > 0 && startTime < audio.duration) {
            audio.currentTime = startTime;
        }
        setStorage({ index: index, time: startTime || 0 });
    }

    function play() {
        if (!audio || currentIndex < 0) return;
        audio.play().then(function () {
            isPlaying = true;
            updateBtn();
        }).catch(function () {
            // 自动播放被拦截，等待用户交互
        });
    }

    function playTrack(index, startTime) {
        loadTrack(index, startTime);
        play();
    }

    function pause() {
        if (!audio) return;
        audio.pause();
        isPlaying = false;
        updateBtn();
        saveProgress();
    }

    function toggle() {
        if (!audio) return;
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }

    function saveProgress() {
        if (currentIndex >= 0 && audio) {
            setStorage({ index: currentIndex, time: audio.currentTime || 0 });
        }
    }

    function updateBtn() {
        if (!btn) return;
        var icon = btn.querySelector('.music-icon');
        var text = btn.querySelector('.music-text');
        if (icon) icon.textContent = isPlaying ? '🎶' : '🎵';
        if (text) text.textContent = isPlaying ? '暂停音乐' : '播放音乐';
        btn.classList.toggle('playing', isPlaying);
    }

    // 首次用户交互兜底：若还没播放，立即尝试（覆盖浏览器自动播放限制）
    function bindInteractFallback() {
        var tryPlayOnInteract = function () {
            if (!isPlaying) {
                play();
            }
        };
        document.addEventListener('click', tryPlayOnInteract, { once: true });
        document.addEventListener('touchstart', tryPlayOnInteract, { once: true });
        document.addEventListener('keydown', tryPlayOnInteract, { once: true });
    }

    function init(options) {
        if (options) {
            if (options.audioDir) settings.audioDir = options.audioDir;
            if (options.buttonId) settings.buttonId = options.buttonId;
            if (options.playlist && options.playlist.length) PLAYLIST = options.playlist;
        }

        audio = new Audio();
        audio.loop = false;      // 由 ended 事件驱动随机切歌
        audio.preload = 'auto';

        btn = document.getElementById(settings.buttonId);

        // 播放结束 → 自动随机下一首
        audio.addEventListener('ended', function () {
            playTrack(pickIndex(currentIndex), 0);
        });

        // 保存播放进度（页面隐藏/关闭时）
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) saveProgress();
        });
        global.addEventListener('pagehide', saveProgress);

        // 跨页面延续：若本次会话已在播放某曲，则恢复
        var saved = getStorage();
        var startIndex = -1;
        if (saved && saved.index !== undefined &&
            saved.index >= 0 && saved.index < PLAYLIST.length) {
            startIndex = saved.index;
        }
        if (startIndex < 0) {
            startIndex = pickIndex(-1);
        }

        var resumeTime = (saved && saved.time) || 0;
        loadTrack(startIndex, resumeTime);

        // 按钮事件
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                toggle();
            });
        }

        // 尝试自动播放
        play();

        // 被拦截则等待首次交互
        bindInteractFallback();
    }

    // 对外暴露
    global.MusicPlayer = {
        init: init,
        play: play,
        pause: pause,
        toggle: toggle,
        next: function () {
            playTrack(pickIndex(currentIndex), 0);
        },
        getPlaylist: function () {
            return PLAYLIST.slice();
        },
        getCurrent: function () {
            return currentIndex >= 0 ? PLAYLIST[currentIndex] : null;
        }
    };
})(window);
