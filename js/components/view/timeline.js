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
        // 保存配置，tickStep 由 zoomLevel 动态计算，不再从配置读取
        this.config = {
            startYear: options.startYear || t.startYear || -1000,
            endYear: options.endYear || t.endYear || 1000,
            tickWidth: options.tickWidth || t.tickWidth || 100,
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

        // 计算时间戳范围（分钟级精度），用于像素与时间的精确转换
        const { startYear, endYear } = this.config;
        this.config.startTimestamp = TimeUtils.toTimestamp({ year: startYear });
        this.config.endTimestamp = TimeUtils.toTimestamp({ year: endYear });

        // 创建刻度容器（绝对定位，占满整个 track 高度）
        this._ticksLayer = document.createElement('div');
        this._ticksLayer.className = 'timeline-ticks-layer';
        this.track.appendChild(this._ticksLayer);

        // 创建生命条容器
        const layer = document.createElement('div');
        layer.className = 'timeline-lifespan-layer';
        this.track.appendChild(layer);

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
        const zoomLevel = AppState.get('timeZoomLevel') || 'year';
        const level = TimeConfig.zoomLevels.find(z => z.id === zoomLevel);
        if (!level) return;

        const scale = TimeConfig.getScale();
        const minUnitScale = scale[level.minUnit];
        this._tickStepTs = minUnitScale * level.step;

        const { startYear, endYear, tickWidth } = this.config;
        const startTs = TimeUtils.toTimestamp({ year: startYear });
        const endTs = TimeUtils.toTimestamp({ year: endYear });

        const totalTicks = Math.ceil((endTs - startTs) / this._tickStepTs);
        this.config.trackWidth = totalTicks * tickWidth;
        this.config.timestampPerPixel = (endTs - startTs) / this.config.trackWidth;

        this.track.style.width = this.config.trackWidth + 'px';

        this._renderVisibleTicks(zoomLevel);
        this._renderLifespanBars();
    },

    _renderVisibleTicks(zoomLevel) {
        if (!this._ticksLayer) return;
        this._ticksLayer.innerHTML = '';

        const tickWidth = this.config.tickWidth;
        const containerWidth = this.container.clientWidth;
        const visibleCount = Math.ceil(containerWidth / tickWidth) + 6;

        const centerTs = TimeUtils.toTimestamp(AppState.get('currentTime'));
        const startYearTs = TimeUtils.toTimestamp({ year: this.config.startYear });
        const tickIndexCenter = Math.round((centerTs - startYearTs) / this._tickStepTs);
        const tickIndexStart = tickIndexCenter - Math.floor(visibleCount / 2);

        for (let i = 0; i < visibleCount; i++) {
            const globalIndex = tickIndexStart + i;
            const tickTs = startYearTs + globalIndex * this._tickStepTs;
            const tickTime = TimeUtils.timestampToTime(tickTs);
            const label = TimeUtils.format(tickTime, zoomLevel);
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.textContent = label;
            tick.style.left = (globalIndex * tickWidth) + 'px';
            this._ticksLayer.appendChild(tick);
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

        const deltaX = e.clientX - this.startX;
        const tsDelta = -deltaX * this.config.timestampPerPixel;
        const newTimestamp = this.startTimestamp + tsDelta;
        const newTime = TimeUtils.timestampToTime(newTimestamp);

        AppState.set('currentTime', newTime);
    },

    // ---------- 事件监听回调 ----------
    _onStateChange(data) {
        if (data.key === 'currentTime') {
            this.render(data.value);
        }
        if (data.key === 'timeZoomLevel') {
            this._updateZoomButtons();
        }
        if (data.key === 'selectedItem' || data.key === 'pinnedEntities') {
            this._renderLifespanBars();
        }
    },

    /**
     * 渲染时间轴位置
     * @param {Object} time - 当前时间对象 { year, month?, day? }
    */
    render(time) {
        const containerWidth = this.container.clientWidth;
        if (containerWidth === 0) return;

        const offsetX = this.timeToOffset(time) + containerWidth / 2;
        this.track.style.transform = `translateX(${offsetX}px)`;

        this._checkTickShift(time);
    },

    _checkTickShift(time) {
        const currentTs = TimeUtils.toTimestamp(time);
        const startYearTs = TimeUtils.toTimestamp({ year: this.config.startYear });
        const tickIndexCenter = Math.round((currentTs - startYearTs) / this._tickStepTs);
        if (this._lastTickCenter === tickIndexCenter) return;
        this._lastTickCenter = tickIndexCenter;
        const zoomLevel = AppState.get('timeZoomLevel') || 'year';
        this._renderVisibleTicks(zoomLevel);
        this._renderLifespanBars();
    },

    // ───── 生命条 ─────

    _renderLifespanBars() {
        const layer = this.track.querySelector('.timeline-lifespan-layer');
        if (!layer) { console.warn('Lifespan layer not found'); return; }
        layer.innerHTML = '';

        const entities = AppState.get('entities') || [];
        const selectedItem = AppState.get('selectedItem');
        const pinnedIds = AppState.get('pinnedEntities') || [];
        const trackWidth = this.config.trackWidth;
        const startTs = this.config.startTimestamp;
        const totalTs = this.config.endTimestamp - startTs;

        const toPx = (time) => {
            const ts = TimeUtils.toTimestamp(time);
            return ((ts - startTs) / totalTs) * trackWidth;
        };

        const toShow = [];
        if (selectedItem && (selectedItem.data.components.motion || selectedItem.data.components.person)) {
            toShow.push(selectedItem.data);
        }
        for (const eid of pinnedIds) {
            const entity = entities.find(e => e.id === eid);
            if (entity && !toShow.includes(entity)) {
                toShow.push(entity);
            }
        }

        console.log(`Lifespan: toShow=${toShow.length} entities, trackWidth=${trackWidth}`);

        toShow.forEach((entity, rowIndex) => {
            const span = getLifespan(entity);
            if (!span || !span.start || !span.end) { console.log(`Lifespan skip: ${entity.components.core?.name} - no span`); return; }
            const top = 30 - rowIndex * 8;
            const color = entity.components.core.color || '#888';
            const hasPerson = !!span.birthTime && !!span.deathTime && TimeUtils.compare(span.birthTime, span.deathTime) !== 0;

            console.log(`Lifespan: ${entity.components.core?.name} start=${span.start?.year} end=${span.end?.year} birth=${span.birthTime?.year} death=${span.deathTime?.year} left=${toPx(span.start).toFixed(0)}px width=${(toPx(span.end) - toPx(span.start)).toFixed(0)}px`);

            if (hasPerson) {
                if (TimeUtils.compare(span.start, span.birthTime) < 0) {
                    const bar = document.createElement('div');
                    bar.className = 'timeline-lifespan-bar timeline-lifespan-bar--dashed';
                    bar.style.left = toPx(span.start) + 'px';
                    bar.style.width = (toPx(span.birthTime) - toPx(span.start)) + 'px';
                    bar.style.top = top + 'px';
                    bar.style.backgroundColor = color;
                    layer.appendChild(bar);
                }
                const iconBaby = document.createElement('div');
                iconBaby.className = 'timeline-lifespan-icon';
                iconBaby.style.left = (toPx(span.birthTime) - 5) + 'px';
                iconBaby.style.top = (top - 3) + 'px';
                iconBaby.innerHTML = getIcon('baby', 10);
                iconBaby.style.color = color;
                layer.appendChild(iconBaby);

                const barSolid = document.createElement('div');
                barSolid.className = 'timeline-lifespan-bar';
                barSolid.style.left = toPx(span.birthTime) + 'px';
                barSolid.style.width = (toPx(span.deathTime) - toPx(span.birthTime)) + 'px';
                barSolid.style.top = top + 'px';
                barSolid.style.backgroundColor = color;
                layer.appendChild(barSolid);

                const iconSkull = document.createElement('div');
                iconSkull.className = 'timeline-lifespan-icon';
                iconSkull.style.left = (toPx(span.deathTime) - 5) + 'px';
                iconSkull.style.top = (top - 3) + 'px';
                iconSkull.innerHTML = getIcon('skull', 10);
                iconSkull.style.color = color;
                layer.appendChild(iconSkull);

                if (TimeUtils.compare(span.deathTime, span.end) < 0) {
                    const barAfter = document.createElement('div');
                    barAfter.className = 'timeline-lifespan-bar timeline-lifespan-bar--dashed';
                    barAfter.style.left = toPx(span.deathTime) + 'px';
                    barAfter.style.width = (toPx(span.end) - toPx(span.deathTime)) + 'px';
                    barAfter.style.top = top + 'px';
                    barAfter.style.backgroundColor = color;
                    layer.appendChild(barAfter);
                }
            } else {
                const bar = document.createElement('div');
                bar.className = 'timeline-lifespan-bar';
                bar.style.left = toPx(span.start) + 'px';
                bar.style.width = (toPx(span.end) - toPx(span.start)) + 'px';
                bar.style.top = top + 'px';
                bar.style.backgroundColor = color;
                layer.appendChild(bar);
            }
        });
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
            this._regenerateTicks();
        }
    },

    _zoomOut() {
        const levels = TimeConfig.zoomLevels;
        const currentId = AppState.get('timeZoomLevel');
        const idx = levels.findIndex(z => z.id === currentId);
        if (idx > 0) {
            AppState.set('timeZoomLevel', levels[idx - 1].id);
            this._regenerateTicks();
        }
    },

    _regenerateTicks() {
        this._lastTickCenter = undefined; // 强制重新生成可见刻度
        this._generateTicks();
        this._updateZoomButtons();
        const currentTime = AppState.get('currentTime');
        this.render(currentTime);
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