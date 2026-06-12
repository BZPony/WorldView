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
    startTime: { year: 0 },

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
        const t = TimeConfig.timeline || {};
        // 保存配置，时间参数优先从 TimeConfig.timeline 读取
        this.config = {
            startYear: options.startYear || t.startYear,
            endYear: options.endYear || t.endYear,
            tickStep: options.tickStep || t.tickStep,
            tickWidth: options.tickWidth || t.tickWidth,
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

        // 计算时间戳范围（分钟级精度），用于像素与时间的精确转换
        this.config.startTimestamp = TimeUtils.toTimestamp({ year: startYear });
        this.config.endTimestamp = TimeUtils.toTimestamp({ year: endYear });

        // 设置轨道宽度
        this.track.style.width = this.config.trackWidth + 'px';

        // 生成刻度
        this._generateTicks();

        // 绑定拖动事件
        this._bindDragEvents();

        // 初始化缩放按钮
        this._initZoomButtons();

        // 监听布局变化事件（如侧边栏开关）
        EventBus.on('layout:change', this._onLayoutChange.bind(this));

        // 监听 AppState 中 currentTime / timeZoomLevel 的变化
        EventBus.on('state:change', this._onStateChange.bind(this));

        // 初始渲染（使用 AppState 中的当前时间）
        const initialTime = AppState.get('currentTime');
        this.render(initialTime != null ? initialTime : { year: 0 });

        // 初始缩放按钮状态
        this._updateZoomButtons();
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
     * 将时间对象转换为轨道偏移量（像素）
     * @param {Object} time - 时间对象 { year, month?, day? }
     * @returns {number} 偏移量
     */
    timeToOffset(time) {
        const { startTimestamp, endTimestamp, trackWidth } = this.config;
        const ts = time ? TimeUtils.toTimestamp(time) : 0;
        const ratio = (ts - startTimestamp) / (endTimestamp - startTimestamp);
        return -ratio * trackWidth;
    },

    /**
     * 将轨道偏移量转换为时间对象
     * @param {number} offsetX - 像素偏移
     * @returns {Object} 时间对象
     */
    offsetToTime(offsetX) {
        const { startTimestamp, endTimestamp, trackWidth } = this.config;
        const ratio = -offsetX / trackWidth;
        const ts = startTimestamp + ratio * (endTimestamp - startTimestamp);
        return TimeUtils.timestampToTime(Math.round(ts));
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
        this.startTimestamp = TimeUtils.toTimestamp(AppState.get('currentTime')); // 精确时间戳
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
        const { startTimestamp, endTimestamp, trackWidth } = this.config;

        const tsDelta = (endTimestamp - startTimestamp) * (-deltaX / trackWidth);
        const newTimestamp = this.startTimestamp + tsDelta;
        const newTime = TimeUtils.timestampToTime(newTimestamp);

        AppState.set('currentTime', newTime);
        console.log('Timeline: 拖动更新当前时间', newTime);
        console.log('Timeline: 拖动时间差', tsDelta);
        console.log('Timeline: 拖动时间戳', newTimestamp);
    },

    // ---------- 事件监听回调 ----------
    _onStateChange(data) {
        if (data.key === 'currentTime') {
            this.render(data.value);
        }
        if (data.key === 'timeZoomLevel') {
            this._updateZoomButtons();
        }
    },

    /**
     * 渲染时间轴位置
     * @param {Object} time - 当前时间对象 { year, month?, day? }
    */
    render(time) {
        console.log('Timeline: 渲染时间轴，当前时间', time);
        const containerWidth = this.container.clientWidth;
        if (containerWidth === 0) return; // 防止未显示时计算错误

        const offsetX = this.timeToOffset(time) + containerWidth / 2;
        this.track.style.transform = `translateX(${offsetX}px)`;
    },

    _onLayoutChange() {
        // 布局变化时重新渲染，保持时间轴位置正确
        // 动画结束后重新渲染，避免过渡期间尺寸错误
        const durationStr = getComputedStyle(document.documentElement).getPropertyValue('--animation-duration');
        const duration = parseFloat(durationStr) * 1000 || 0;
        setTimeout(() => {
            const currentTime = AppState.get('currentTime');
            this.render(currentTime);
            this._updateZoomButtons();
        }, duration);
    },

    // ───── 缩放按钮 ─────

    _initZoomButtons() {
        this._btnZoomIn = document.getElementById('timeline-zoom-in');
        this._btnZoomOut = document.getElementById('timeline-zoom-out');
        if (!this._btnZoomIn || !this._btnZoomOut) return;

        this._btnZoomIn.addEventListener('click', () => this._zoomIn());
        this._btnZoomOut.addEventListener('click', () => this._zoomOut());
    },

    _zoomIn() {
        const levels = TimeConfig.zoomLevels;
        const currentId = AppState.get('timeZoomLevel');
        const idx = levels.findIndex(z => z.id === currentId);
        if (idx < levels.length - 1) {
            AppState.set('timeZoomLevel', levels[idx + 1].id);
        }
    },

    _zoomOut() {
        const levels = TimeConfig.zoomLevels;
        const currentId = AppState.get('timeZoomLevel');
        const idx = levels.findIndex(z => z.id === currentId);
        if (idx > 0) {
            AppState.set('timeZoomLevel', levels[idx - 1].id);
        }
    },

    /**
     * 根据当前 timeZoomLevel 更新按钮 disabled 状态
     * 并更新按钮位置
     */
    _updateZoomButtons() {
        if (!this._btnZoomIn || !this._btnZoomOut) return;

        const levels = TimeConfig.zoomLevels;
        const currentId = AppState.get('timeZoomLevel');
        const idx = levels.findIndex(z => z.id === currentId);

        this._btnZoomIn.disabled = idx >= levels.length - 1;
        this._btnZoomOut.disabled = idx <= 0;

        // 位置：时间轴右侧 + 8px 间距
        const containerRect = this.container.getBoundingClientRect();
        const btns = this._btnZoomIn.parentElement;
        btns.style.left = (containerRect.right + 8) + 'px';
    }
};