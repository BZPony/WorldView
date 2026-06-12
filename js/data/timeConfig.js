/**
 * 时间系统全局配置
 *
 * 用户可自定义年月日时分秒的换算规则，适应不同世界观。
 * 所有时间运算通过 TimeUtils 工具函数完成，底层统一基于此配置。
 */
const TimeConfig = {
    // ───── 纪元起点 ─────
    // 所有时间戳（toTimestamp）基于此计算
    epoch: { year: 0, month: 1, day: 1, hour: 0, minute: 0, second: 0 },

    // ───── 时间换算规则（用户可自定义） ─────
    yearMonths: 12,      // 一年 12 个月（可改为 18）
    monthDays: 30,       // 一个月 30 天（可改为 40 或 60）
    dayHours: 24,
    hourMinutes: 60,
    minuteSeconds: 60,

    // ───── 最小精度单位 ─────
    // 'minute' 为建议值，秒级精度极少用到
    // 使用 minute 可将一年缩放值控制在 100 万以内，避免数值溢出
    minUnit: 'minute',

    // ───── 时间轴配置 ─────
    timeline: {
        startYear: -1000,
        endYear: 1000,
        tickStep: 1,
        tickWidth: 100
    },

    // ───── 轨迹显示窗口 ─────
    // 只显示当前时间往前 N 个时间单位内的轨迹，防止路径杂乱缠绕
    trackWindow: {
        enabled: false,
        value: 30,
        unit: 'year'
    },

    // ───── 分辨率（缩放）级别定义 ─────
    // 按精度从低到高排列
    zoomLevels: [
        { id: 'era', label: '纪元', minUnit: 'year', step: 100 },
        { id: 'century', label: '世纪', minUnit: 'year', step: 25 },
        { id: 'decade', label: '年代', minUnit: 'year', step: 5 },
        { id: 'year', label: '年', minUnit: 'year', step: 1 },
        { id: 'halfyear', label: '半年', minUnit: 'month', step: 6 },
        { id: 'season', label: '季度', minUnit: 'month', step: 3 },
        { id: 'month', label: '月', minUnit: 'month', step: 1 },
        { id: 'week', label: '周', minUnit: 'day', step: 7 },
        { id: 'day', label: '日', minUnit: 'day', step: 1 },
        { id: 'hour', label: '时', minUnit: 'hour', step: 1 },
        { id: 'minute', label: '分', minUnit: 'minute', step: 1 },
    ],

    /**
     * 获取每级时间单位到 minUnit 的缩放系数
     * @returns {Object} { year: number, month: number, day: number, hour: number, minute: number }
     */
    getScale() {
        const scale = {
            minute: 1,
            hour: this.hourMinutes,
            day: this.dayHours * this.hourMinutes,
            month: this.monthDays * this.dayHours * this.hourMinutes,
            year: this.yearMonths * this.monthDays * this.dayHours * this.hourMinutes
        };

        if (this.minUnit === 'second') {
            scale.second = 1;
            scale.minute = this.minuteSeconds;
            scale.hour = this.hourMinutes * this.minuteSeconds;
            scale.day = this.dayHours * this.hourMinutes * this.minuteSeconds;
            scale.month = this.monthDays * this.dayHours * this.hourMinutes * this.minuteSeconds;
            scale.year = this.yearMonths * this.monthDays * this.dayHours * this.hourMinutes * this.minuteSeconds;
        }

        return scale;
    },

    /**
     * 获取 zoomLevels 中某个级别的索引（值越大精度越高）
     * @param {string} id
     * @returns {number}
     */
    getZoomIndex(id) {
        return this.zoomLevels.findIndex(z => z.id === id);
    }
};

window.TimeConfig = TimeConfig;