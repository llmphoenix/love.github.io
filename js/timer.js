/**
 * timer.js —— 恋爱计时器公共模块
 *
 * 统一封装“时间字符串解析 + 计时常量 + 渲染”逻辑，
 * 供各页面（index.html / loveweb / loveweb2 / loveweb3 等）复用，
 * 避免各页面各自 `new Date()` 解析时区不一致导致显示差异。
 *
 * 用法：
 *   LoveTimer.init({
 *       startDate: '2022-11-20T19:00:00',   // 起始时间（可配置）
 *       mode: 'digital',                    // 'digital' | 'clock' | 'manual'
 *       interval: 1000                      // 刷新间隔（毫秒）
 *   });
 *
 * 渲染模式：
 *   - 'digital'：写入独立元素 #days / #hours / #minutes / #seconds（textContent）
 *   - 'clock'  ：写入 #elapseClock，整段 HTML（<span class="digit">…</span> 天 …）
 *   - 'manual' ：不自动渲染，只提供 LoveTimer.getTimeParts() 供自行调用
 *
 * 说明：
 *   - 起始时间字符串统一用 new Date(startDate) 解析，带时间部分（T19:00:00）
 *     按本地时区解析，避免“仅日期”字符串被按 UTC 解析导致差 8 小时的问题。
 */
(function (global) {
    'use strict';

    var DEFAULT_START = '2022-11-20T20:00:00';

    var config = {
        startDate: DEFAULT_START,
        mode: 'digital',
        interval: 1000
    };

    var startDate = null;   // 解析后的 Date 对象
    var timerId = null;     // setInterval 句柄

    /**
     * 解析起始时间字符串。支持：
     *   - Date 对象
     *   - 带时间的字符串 '2022-11-20T19:00:00'（本地时区）
     *   - 仅日期的字符串 '2022-11-20'（按 UTC 解析，与浏览器 new Date 行为一致）
     * 解析失败时抛错，便于尽早发现配置问题。
     */
    function parseStartDate(value) {
        if (value instanceof Date) {
            if (isNaN(value.getTime())) {
                throw new Error('[LoveTimer] 无效的起始时间: ' + value);
            }
            return value;
        }
        var d = new Date(value);
        if (isNaN(d.getTime())) {
            throw new Error('[LoveTimer] 无法解析的起始时间: ' + value);
        }
        return d;
    }

    /**
     * 计算从现在到起始时间的差值，拆分为 天/时/分/秒。
     * 若当前时间早于起始时间（diff < 0），各值取 0。
     * 返回 { days, hours, minutes, seconds }（均为补零后的两位字符串）。
     */
    function getTimeParts(now) {
        now = now || new Date();
        var diffMs = now.getTime() - startDate.getTime();
        if (diffMs < 0) diffMs = 0;

        var totalSec = Math.floor(diffMs / 1000);
        var days = Math.floor(totalSec / 86400);
        var hours = Math.floor((totalSec % 86400) / 3600);
        var minutes = Math.floor((totalSec % 3600) / 60);
        var seconds = totalSec % 60;

        return {
            days: pad(days),
            hours: pad(hours),
            minutes: pad(minutes),
            seconds: pad(seconds)
        };
    }

    /** 补零到两位 */
    function pad(n) {
        return String(n).padStart(2, '0');
    }

    /**
     * 渲染一帧。
     * - digital：写 #days / #hours / #minutes / #seconds
     * - clock  ：写 #elapseClock（<span class="digit">…</span> 天 …）
     * - manual ：不渲染
     */
    function render() {
        var parts = getTimeParts();
        if (config.mode === 'digital') {
            setText('days', parts.days);
            setText('hours', parts.hours);
            setText('minutes', parts.minutes);
            setText('seconds', parts.seconds);
        } else if (config.mode === 'clock') {
            var el = document.getElementById('elapseClock');
            if (el) {
                el.innerHTML = clockHtml(parts);
            }
        }
    }

    /** 安全地设置 textContent */
    function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    /** 生成 clock 模式的整段 HTML */
    function clockHtml(p) {
        return '<span class="digit">' + p.days + '</span> 天 ' +
               '<span class="digit">' + p.hours + '</span> 时 ' +
               '<span class="digit">' + p.minutes + '</span> 分 ' +
               '<span class="digit">' + p.seconds + '</span> 秒';
    }

    /**
     * 初始化计时器。
     * @param {Object} opts
     *   - startDate: 起始时间（字符串或 Date），默认 '2022-11-20T19:00:00'
     *   - mode     : 'digital' | 'clock' | 'manual'，默认 'digital'
     *   - interval : 刷新间隔毫秒，默认 1000
     * @returns {Object} LoveTimer 自身（可链式调用）
     */
    function init(opts) {
        opts = opts || {};
        if (opts.startDate !== undefined) config.startDate = opts.startDate;
        if (opts.mode !== undefined) config.mode = opts.mode;
        if (opts.interval !== undefined) config.interval = opts.interval;

        startDate = parseStartDate(config.startDate);

        stop();
        render();
        if (config.mode !== 'manual') {
            timerId = setInterval(render, config.interval);
        }
        return api;
    }

    /** 停止刷新（保留已渲染内容） */
    function stop() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    var api = {
        init: init,
        stop: stop,
        getTimeParts: getTimeParts,
        getStartDate: function () { return startDate; }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api; // 便于 Node 测试
    }
    global.LoveTimer = api;
})(typeof window !== 'undefined' ? window : globalThis);
