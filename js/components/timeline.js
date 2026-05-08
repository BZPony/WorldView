/**
 * 时间轴模块（全局单例）
 * 职责：
 * - 生成时间刻度
 * - 处理拖动交互，更新 AppState.currentTime
 * - 监听 AppState.currentTime 变化，渲染时间轴位置
 * - 处理窗口 resize 自适应
 * - 提供时间与像素坐标的转换函数（供其他模块调用）
 */
const Timeline = {
    // 配置参数
    config: {},

    // DOM 元素
    track: null,
    container: null,

    // 内部状态
    isDragging: false,
    startX: 0,
    startTime: 0,

    /**
     * 初始化时间轴
     * @param {Object} options
     * @param {number} options.startYear - 起始年份
     * @param {number} options.endYear - 结束年份
     * @param {number} [options.tickStep=50] - 刻度间隔（年）
     * @param {number} [options.tickWidth=100] - 每个刻度的像素宽度
     * @param {string} options.containerId - 时间轴容器 ID
     * @param {string} [options.trackId='timeline-track'] - 轨道元素 ID
     */
    init(options) {
        // 保存配置
        this.config = {
            startYear: options.startYear,
            endYear: options.endYear,
            tickStep: options.tickStep || 50,
            tickWidth: options.tickWidth || 100,
            containerId: options.containerId,
            trackId: options.trackId || 'timeline-track',
        };

        // 获取 DOM 元素
        this.container = document.getElementById(this.config.containerId);
        this.track = document.getElementById(this.config.trackId);

        if (!this.container || !this.track) {
            console.error('Timeline: 找不到容器或轨道元素');
            return;
        }

        // 计算总刻度数和轨道总宽度
        const { startYear, endYear, tickStep, tickWidth } = this.config;
        this.config.totalTicks = (endYear - startYear) / tickStep;
        this.config.trackWidth = this.config.totalTicks * tickWidth;

        // 设置轨道宽度
        this.track.style.width = this.config.trackWidth + 'px';

        // 生成刻度
        this._generateTicks();

        // 绑定拖动事件
        this._bindDragEvents();

        // 监听布局变化事件（如侧边栏开关）
        EventBus.on('layoutChange', this._onLayoutChange.bind(this));
        
        // 监听 AppState 中 currentTime 的变化
        EventBus.on('stateChange', this._onStateChange.bind(this));

        // 初始渲染（使用 AppState 中的当前时间）
        const initialTime = AppState.get('currentTime');
        this.render(initialTime != null ? initialTime : 0);
    },

    /**
     * 生成时间刻度并添加到轨道
     */
    _generateTicks() {
        const { startYear, endYear, tickStep } = this.config;
        this.track.innerHTML = ''; // 清空已有刻度
        for (let year = startYear; year <= endYear; year += tickStep) {
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.textContent = year;
            this.track.appendChild(tick);
        }
    },

    /**
     * 将时间转换为轨道偏移量（像素）
     * @param {number} time - 年份
     * @returns {number} 偏移量
     */
    timeToOffset(time) {
        const { startYear, endYear, trackWidth } = this.config;
        const ratio = (time - startYear) / (endYear - startYear);
        return -ratio * trackWidth;
    },

    /**
     * 将轨道偏移量转换为时间（年份）
     * @param {number} offsetX - 像素偏移
     * @returns {number} 年份
     */
    offsetToTime(offsetX) {
        const { startYear, endYear, trackWidth } = this.config;
        const ratio = -offsetX / trackWidth;
        return startYear + ratio * (endYear - startYear);
    },

    // ---------- 拖动事件处理 ----------
    _bindDragEvents() {
        this.track.addEventListener('mousedown', this._onMouseDown.bind(this));
        document.addEventListener('mouseup', this._onMouseUp.bind(this));
        document.addEventListener('mousemove', this._onMouseMove.bind(this));
    },

    _onMouseDown(e) {
        this.isDragging = true;
        this.startX = e.clientX;
        this.startTime = AppState.get('currentTime'); // 注意：拖动起始基于当前状态
        this.track.style.cursor = 'grabbing';
    },

    _onMouseUp() {
        this.isDragging = false;
        this.track.style.cursor = 'grab';
    },

    _onMouseMove(e) {
        if (!this.isDragging) return;

        const containerWidth = this.container.clientWidth;
        if (containerWidth === 0) return;

        const deltaX = e.clientX - this.startX;
        const { startYear, endYear, trackWidth } = this.config;

        let newTime = this.startTime + (endYear - startYear) * (-deltaX / trackWidth);
        newTime = Math.max(startYear, Math.min(endYear, newTime));

        // 通过 AppState 更新时间，这会触发 stateChange 事件，其他模块自动响应
        AppState.set('currentTime', newTime);
    },

    // ---------- 事件监听回调 ----------
    _onStateChange(data) {
        if (data.key === 'currentTime') {
            this.render(data.value);
        }
    },

    /**
    * 渲染时间轴位置
    * @param {number} time - 当前时间
    */
    render(time) {
        const containerWidth = this.container.clientWidth;
        if (containerWidth === 0) return; // 防止未显示时计算错误

        const offsetX = this.timeToOffset(time) + containerWidth / 2;
        this.track.style.transform = `translateX(${offsetX}px)`;
        // 保留调试日志，可注释掉
        // console.log(`Timeline render - time: ${time.toFixed(2)}, offset: ${offsetX.toFixed(2)}px`);
    },

    _onLayoutChange() {
        // 布局变化时重新渲染，保持时间轴位置正确
        // 动画结束后重新渲染，避免过渡期间尺寸错误
        const durationStr = getComputedStyle(document.documentElement).getPropertyValue('--animation-duration');
        const duration = parseFloat(durationStr) * 1000 || 0;
        setTimeout(() => {
            const currentTime = AppState.get('currentTime');
            this.render(currentTime);
        }, duration);
    }
};