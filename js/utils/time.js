/**
 * 时间系统工具函数
 *
 * 所有时间运算基于 TimeConfig 全局配置，支持用户自定义的年月日换算规则。
 * 底层统一将时间对象转为距纪元起点（epoch）的时间戳（分钟级整数），用于排序、比较和插值。
 *
 * 时间对象格式：
 *   { year: number, month?: number, day?: number, hour?: number, minute?: number, second?: number }
 *
 * 所有 time 字段（currentTime, birthTime, deathTime, waypoint.time.arrival/departure）
 * 统一使用此对象格式。
 */
const TimeUtils = {

    /**
     * 将时间对象转为整数时间戳（距 TimeConfig.epoch 的 minUnit 数）
     *
     * 正负年处理：负年直接乘以年缩放系数，产生负时间戳，比较时天然正确。
     *
     * @param {Object} t - 时间对象 { year, month?, day?, hour?, minute? }
     * @returns {number} 时间戳（带符号）
     */
    toTimestamp(t) {
        if (t == null) return 0;
        const scale = TimeConfig.getScale();
        const year = t.year || 0;
        const month = (t.month || 1) - 1;   // 0-based
        const day = (t.day || 1) - 1;     // 0-based
        const hour = t.hour || 0;
        const min = t.minute || 0;

        return year * scale.year
            + month * scale.month
            + day * scale.day
            + hour * scale.hour
            + min * scale.minute;
    },

    /**
     * 将时间戳反向计算为时间对象
     * @param {number} timestamp - 时间戳
     * @returns {Object} { year, month, day, hour, minute }
     */
    timestampToTime(timestamp) {
        const scale = TimeConfig.getScale();
        let remaining = timestamp;

        // 处理负偏移：正向取模
        const year = Math.floor(remaining / scale.year);
        remaining = remaining - year * scale.year;
        // remaining 现在可能在 [0, scale.year) 范围内
        // 但如果 year 为负，remaining 会变成正偏
        // 这种情况下需要重新调整
        if (remaining < 0) {
            // 借位
            return this.timestampToTime(timestamp - scale.month); // 简化处理
        }

        const month = Math.floor(remaining / scale.month) + 1;
        remaining = remaining - (month - 1) * scale.month;

        const day = Math.floor(remaining / scale.day) + 1;
        remaining = remaining - (day - 1) * scale.day;

        const hour = Math.floor(remaining / scale.hour);
        remaining = remaining - hour * scale.hour;

        const minute = remaining; // 剩余的就是分钟

        return {
            year,
            month: Math.max(1, Math.min(month, TimeConfig.yearMonths)),
            day: Math.max(1, Math.min(day, TimeConfig.monthDays)),
            hour: Math.max(0, hour),
            minute: Math.max(0, minute)
        };
    },

    /**
     * 计算两个时间对象的差值（b - a），单位为 minUnit
     * @param {Object} a
     * @param {Object} b
     * @returns {number}
     */
    diff(a, b) {
        return this.toTimestamp(b) - this.toTimestamp(a);
    },

    /**
     * 在 start 和 end 之间按比例插值，返回新的时间对象
     * @param {Object} start
     * @param {Object} end
     * @param {number} ratio - 0~1
     * @returns {Object} 新的时间对象
     */
    lerp(start, end, ratio) {
        const startTs = this.toTimestamp(start);
        const endTs = this.toTimestamp(end);
        const midTs = startTs + (endTs - startTs) * ratio;
        return this.timestampToTime(midTs);
    },

    /**
     * 比较两个时间对象
     * @param {Object} a
     * @param {Object} b
     * @returns {number} -1 (a < b) / 0 (a === b) / 1 (a > b)
     */
    compare(a, b) {
        if (a == null && b == null) return 0;
        if (a == null) return -1;
        if (b == null) return 1;
        const diff = this.toTimestamp(a) - this.toTimestamp(b);
        if (diff < 0) return -1;
        if (diff > 0) return 1;
        return 0;
    },

    /**
     * 判断一个途径点的精度是否匹配当前缩放级别
     * 规则：waypoint.resolution 的精度 ≥ 当前缩放级别精度时 → 显示
     *
     * @param {string} resolution - 途径点的分辨率 ID（如 'day', 'year', 'month'）
     * @param {string} currentZoomLevel - 当前缩放级别 ID
     * @returns {boolean}
     */
    isVisible(resolution, currentZoomLevel) {
        const resIdx = TimeConfig.getZoomIndex(resolution);
        const zoomIdx = TimeConfig.getZoomIndex(currentZoomLevel);
        if (resIdx === -1 || zoomIdx === -1) return true; // 未知级别默认显示
        return resIdx >= zoomIdx; // 索引越大精度越高
    },

    /**
     * 按当前缩放级别格式化时间显示
     * @param {Object} t - 时间对象
     * @param {string} zoomLevel - 缩放级别 ID
     * @returns {string}
     */
    format(t, zoomLevel) {
        if (!t) return '未知';
        const y = t.year ?? 0;
        const m = t.month;
        const d = t.day;
        const h = t.hour;
        const min = t.minute;

        switch (zoomLevel) {
            case 'era':
            case 'century':
            case 'decade':
            case 'year':
                return `${y}年`;
            case 'halfyear':
                return `${y}年${m ? (m <= 6 ? '上半年' : '下半年') : ''}`;
            case 'season':
                if (!m) return `${y}年`;
                const q = Math.ceil(m / (TimeConfig.yearMonths / 4));
                return `${y}年第${q}季度`;
            case 'month':
                return `${y}年${m ?? 1}月`;
            case 'week':
                return `${y}年${m ?? 1}月${d ?? 1}日`;
            case 'day':
                return `${y}年${m ?? 1}月${d ?? 1}日`;
            case 'hour':
                return `${y}年${m ?? 1}月${d ?? 1}日 ${h ?? 0}时`;
            case 'minute':
                return `${y}年${m ?? 1}月${d ?? 1}日 ${h ?? 0}:${String(min ?? 0).padStart(2, '0')}`;
            default:
                return `${y}年${m ?? 1}月${d ?? 1}日`;
        }
    },

    /**
     * 从时间对象减去一定量，返回新时间对象
     * 用于计算 trackWindow 的起始时间
     *
     * @param {Object} t - 时间对象
     * @param {number} value - 减去多少
     * @param {string} unit - 单位（year/month/day/hour/minute）
     * @returns {Object} 新的时间对象
     */
    subtract(t, value, unit) {
        if (!t) return { year: 0 };
        const scale = TimeConfig.getScale();
        const unitScale = scale[unit] || scale.year;
        const ts = this.toTimestamp(t);
        return this.timestampToTime(ts - value * unitScale);
    },

    /**
     * 获取当前时间分辨率对应的 minUnit 步进值
     *
     * @param {string} [zoomLevel] - 缩放级别 ID，默认从 AppState 读取
     * @returns {number} 步进值（minUnit）
     */
    getResolutionStep(zoomLevel) {
        const zl = zoomLevel || (window.AppState ? AppState.get('timeZoomLevel') : 'year') || 'year';
        const scale = TimeConfig.getScale();
        const level = TimeConfig.zoomLevels.find(z => z.id === zl);
        if (!level) return scale.year;
        const unitScale = scale[level.minUnit] || scale.year;
        return unitScale * (level.step || 1);
    }
};

window.TimeUtils = TimeUtils;