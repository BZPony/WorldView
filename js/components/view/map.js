/**
 * 地图模块（全局单例）
 * 职责：
 * - 初始化 Leaflet 地图
 * - 根据当前时间渲染所有实体标记和轨迹
 * - 监听 currentTime 变化自动重绘
 * - 监听 entities 数据变化
 */
const MapView = {
    map: null,
    /**
     * 实体图层组，统一管理所有实体的标记、轨迹、途径点
     * undo/redo 整体替换 entities 时，清空整个图层组即可移除所有旧 Leaflet 图层
     */
    _entityLayerGroup: null,

    /**
     * 初始化地图
     * @param {string} containerId - 地图容器 ID
     */
    init(containerId = 'map') {
        // 1. 创建 Leaflet 地图实例
        this.map = L.map(containerId, {
            center: [35.8617, 104.1954],
            zoom: 6,
            zoomControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        L.control.zoom({ position: 'topright' }).addTo(this.map);

        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);

        // 2. 创建实体图层组，所有实体标记、轨迹、途径点都加到这里
        this._entityLayerGroup = L.layerGroup().addTo(this.map);

        // 3. 初始化时立即渲染一次
        this.renderTimelineEntities();

        // 3. 订阅时间变化，自动重绘
        EventBus.on('state:change', (data) => {
            if (data.key === 'currentTime') {
                this.renderTimelineEntities();
            }
        });

        // 4. 实体数据变化，清理图层组再重建（应对 undo/redo 整体替换 entities）
        EventBus.on('state:change', (data) => {
            if (data.key === 'entities') {
                // 清除当前 entities 上的 Leaflet 引用
                (data.value || []).forEach(entity => {
                    entity._marker = null;
                    entity._polyline = null;
                    entity._segmentPolylines = [];
                    entity._waypointMarkers = [];
                });
                this._entityLayerGroup.clearLayers();
                this.renderTimelineEntities();
            }
        });

        // 5. 选中项变化，重绘标记以更新高亮状态
        EventBus.on('state:change', (data) => {
            if (data.key === 'selectedItem') {
                this.renderTimelineEntities();
            }
        });
    },

    /**
     * 从 entities 池中筛选带有 timeline 组件的实体
     * @returns {Array<Object>} 包含 timeline 组件的实体数组
     */
    getTimelineEntities() {
        const entities = AppState.get('entities') || [];
        return entities.filter(e => e.components.timeline);
    },

    /**
     * 实体位置线性插值
     * 在相邻途径点之间按时间比例计算当前经纬度
     * @param {Object} entity - 包含 timeline 组件的实体对象
     * @param {number} time - 目标时间值
     * @returns {{ lat: number, lng: number } | null} 插值后的坐标，不在时间范围内则返回 null
     */
    getEntityPosition(entity, time) {
        const waypoints = entity.components.timeline.waypoints;
        if (!waypoints || waypoints.length === 0) return null;

        if (waypoints.length === 1) {
            const wpTime = waypoints[0].time;
            const departure = wpTime.departure || wpTime.arrival || wpTime;
            return TimeUtils.compare(time, departure) === 0
                ? { lat: waypoints[0].lat, lng: waypoints[0].lng } : null;
        }

        // 检查是否在时间范围内
        const firstDeparture = waypoints[0].time.departure || waypoints[0].time.arrival || waypoints[0].time;
        const lastArrival = waypoints[waypoints.length - 1].time.arrival || waypoints[waypoints.length - 1].time;
        if (TimeUtils.compare(time, firstDeparture) < 0 || TimeUtils.compare(time, lastArrival) > 0) return null;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const a = waypoints[i];
            const b = waypoints[i + 1];
            const segStart = a.time.departure || a.time.arrival || a.time;
            const segEnd = b.time.arrival || b.time.departure || b.time;

            if (TimeUtils.compare(time, segStart) >= 0 && TimeUtils.compare(time, segEnd) <= 0) {
                const diff = TimeUtils.diff(segStart, segEnd);
                const offset = TimeUtils.diff(segStart, time);
                const ratio = diff !== 0 ? offset / diff : 0;
                return {
                    lat: a.lat + (b.lat - a.lat) * ratio,
                    lng: a.lng + (b.lng - a.lng) * ratio
                };
            }
        }

        return null;
    },

    /**
     * 主渲染入口：渲染所有 timeline 实体的标记、轨迹和途径点
     * - 为当前时间位置的实体创建/更新地图标记
     * - 沿实体途径点绘制已走完的轨迹线
     * - 渲染所有 ≤ 当前时间的途径点小标记
     * - 实体不在时间范围内时自动清理所有图层
     */
    renderTimelineEntities() {
        //获取具有时间轴组件的实体
        const entities = this.getTimelineEntities() || [];
        const currentTime = AppState.get('currentTime') || 0;

        entities.forEach(entity => {
            const pos = this.getEntityPosition(entity, currentTime);

            if (pos === null) {
                // 实体不存在，移除标记和轨迹
                if (entity._marker) {
                    this.map.removeLayer(entity._marker);
                    entity._marker = null;
                }
                // 移除分段折线
                if (entity._segmentPolylines) {
                    entity._segmentPolylines.forEach(pl => this._entityLayerGroup.removeLayer(pl));
                    entity._segmentPolylines = [];
                }
                // 移除途径点标记
                this._clearWaypointMarkers(entity);
                return;
            }

            // 渲染途径点标记
            this._renderWaypointMarkers(entity, currentTime);

            // 更新或创建标记
            if (!entity._marker) {
                entity._marker = L.marker([pos.lat, pos.lng], {
                    icon: this._createEntityIcon(entity)
                }).addTo(this._entityLayerGroup);

                // 只在首次创建标记时添加点击事件，避免重复监听
                entity._marker.addEventListener('click', () => {
                    EventBus.emit('ui:select', {
                        type: 'entity',
                        id: entity.id
                    });
                });
            } else {
                entity._marker.setLatLng([pos.lat, pos.lng]);
                entity._marker.setIcon(this._createEntityIcon(entity));
            }

            // 分段渲染轨迹线段（正常实线、超出寿命虚线）
            this._renderSegments(entity, currentTime);
        });
    },

    /**
     * 渲染单个实体的途径点标记
     * 遍历 waypoints，为 time ≤ currentTime 的每个点创建小号圆点标记（12px 外环 + 6px 内圆）
     * 先清除旧标记再重建，以支持时间轴拖动时的动态更新
     * @param {Object} entity - 实体对象
     * @param {number} currentTime - 当前时间
     */
    _renderWaypointMarkers(entity, currentTime) {
        const color = entity.components.core.color || '#333';
        const waypoints = entity.components.timeline.waypoints || [];

        // 初始化 _waypointMarkers 数组
        if (!entity._waypointMarkers) {
            entity._waypointMarkers = [];
        }

        // 清除旧的途径点标记
        this._clearWaypointMarkers(entity);

        // 计算轨迹显示窗口起始时间
        const tw = TimeConfig.trackWindow;
        const windowStart = tw && tw.enabled
            ? TimeUtils.subtract(currentTime, tw.value, tw.unit)
            : null;
        const wd = windowStart ? TimeUtils.diff(windowStart, currentTime) : 0;

        const getOpacity = (t) => {
            if (!windowStart) return 1;
            const ft = 1 / 3;
            if (t >= ft) return 1;
            if (t <= 0) return 0;
            return t / ft;
        };

        // 为每个已达到当前时间的途径点创建标记（不做硬过滤，由 opacity 控制显示）
        waypoints.forEach((wp, index) => {
            // 使用 arrival 时间判断是否已到达
            const wpTime = wp.time.arrival || wp.time.departure || wp.time;
            if (TimeUtils.compare(currentTime, wpTime) < 0) return;

            // 计算透明度
            let alpha = 1;
            if (windowStart && wd > 0) {
                const t = TimeUtils.diff(windowStart, wpTime) / wd;
                alpha = getOpacity(t);
            }
            if (alpha < 0.01) return;

            const icon = this._createWaypointIcon(color, alpha);
            const marker = L.marker([wp.lat, wp.lng], {
                icon: icon,
                interactive: false,
                zIndexOffset: -100,
                opacity: alpha
            }).addTo(this._entityLayerGroup);

            entity._waypointMarkers.push(marker);
        });
    },

    /**
     * 从地图移除实体的全部途径点标记并重置数组
     * @param {Object} entity - 实体对象
     */
    _clearWaypointMarkers(entity) {
        if (entity._waypointMarkers) {
            entity._waypointMarkers.forEach(marker => {
                this.map.removeLayer(marker);
            });
            entity._waypointMarkers = [];
        }
    },

    /**
     * 分段渲染实体的轨迹线
     * 对于有人物组件的实体，逐段检查是否超出寿命区间：
     *   - 两个途径点都存活 → 实线
     *   - 任意一点在寿命外 → 虚线
     * 对于无人物组件的实体，直接渲染普通实线
     * @param {Object} entity - 实体对象
     * @param {number} currentTime - 当前时间
     */
    _renderSegments(entity, currentTime) {
        const waypoints = entity.components.timeline.waypoints || [];

        // 计算轨迹显示窗口起始时间
        const tw = TimeConfig.trackWindow;
        const windowStart = tw && tw.enabled
            ? TimeUtils.subtract(currentTime, tw.value, tw.unit)
            : null;

        // 构建截至当前时间的经纬度路径（不做窗口过滤，由逐段渲染的 opacity 控制显示）
        const path = [];
        for (let i = 0; i < waypoints.length; i++) {
            const wpTime = waypoints[i].time.arrival || waypoints[i].time.departure || waypoints[i].time;
            if (TimeUtils.compare(wpTime, currentTime) <= 0) {
                path.push({ lat: waypoints[i].lat, lng: waypoints[i].lng, time: wpTime });
            } else {
                const interpolated = this.getEntityPosition(entity, currentTime);
                if (interpolated) {
                    path.push({ lat: interpolated.lat, lng: interpolated.lng, time: currentTime });
                }
                break;
            }
        }

        if (path.length < 2) {
            // 不足两个点，不画线
            if (entity._segmentPolylines) {
                entity._segmentPolylines.forEach(pl => this._entityLayerGroup.removeLayer(pl));
                entity._segmentPolylines = [];
            }
            return;
        }

        // 检查实体是否有人物组件（寿命限制）
        const personComp = entity.components.person;
        const color = entity.components.core.color;

        // 判断一段是否超出寿命
        const isOutside = (timeA, timeB) => {
            if (!personComp) return false;
            const { birthTime, deathTime } = personComp;
            if (birthTime == null && deathTime == null) return false;
            if (birthTime != null && (TimeUtils.compare(timeA, birthTime) < 0 || TimeUtils.compare(timeB, birthTime) < 0)) return true;
            if (deathTime != null && (TimeUtils.compare(timeA, deathTime) > 0 || TimeUtils.compare(timeB, deathTime) > 0)) return true;
            return false;
        };

        // ───── 渐变参数 ─────
        // t = (time - windowStart) / (currentTime - windowStart)，范围 0~1
        // 后 1/3 渐变区：t ∈ [0, 1/3) → opacity = t * 3（0 线性渐变到 1）
        // 渐变区外: t ∈ [1/3, 1] → opacity = 1
        const getOpacity = (t) => {
            if (!windowStart) return 1;
            const ft = 1 / 3;
            if (t >= ft) return 1;
            if (t <= 0) return 0;
            return t / ft;
        };
        const wd = windowStart ? TimeUtils.diff(windowStart, currentTime) : 0;
        const SUBDIVISIONS = 30;

        // 清除旧的分段折线
        if (entity._segmentPolylines) {
            entity._segmentPolylines.forEach(pl => this._entityLayerGroup.removeLayer(pl));
        }
        entity._segmentPolylines = [];

        // 逐段创建折线
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i];
            const b = path[i + 1];
            const dashed = isOutside(a.time, b.time);
            const baseOp = dashed ? 0.5 : 1;

            // 判断该段是否部分进入渐变区
            let needsSub = false;
            if (windowStart && wd > 0) {
                const aT = TimeUtils.diff(windowStart, a.time) / wd;
                const bT = TimeUtils.diff(windowStart, b.time) / wd;
                needsSub = Math.min(aT, bT) < 1 / 3;
            }

            if (needsSub && baseOp > 0) {
                // ── 渐变区：拆为微段 ──
                const aT = TimeUtils.diff(windowStart, a.time) / wd;
                const bT = TimeUtils.diff(windowStart, b.time) / wd;
                // 段内渐变边界位置（比例）
                const fadeRatio = Math.max(0, (1 / 3 - aT) / (bT - aT));
                const subEnd = Math.min(fadeRatio, 1);
                const n = Math.max(2, Math.round(SUBDIVISIONS * subEnd * 2));

                for (let s = 0; s < n; s++) {
                    const rA = (s / n) * subEnd;
                    const rB = ((s + 1) / n) * subEnd;
                    const midT = aT + ((rA + rB) / 2) * (bT - aT);
                    const alpha = getOpacity(midT);
                    const finalOp = baseOp * alpha;
                    if (finalOp < 0.01) continue;
                    const pl = L.polyline([
                        [a.lat + (b.lat - a.lat) * rA, a.lng + (b.lng - a.lng) * rA],
                        [a.lat + (b.lat - a.lat) * rB, a.lng + (b.lng - a.lng) * rB]
                    ], { color, weight: 3, opacity: finalOp, dashArray: dashed ? '6,6' : null }).addTo(this._entityLayerGroup);
                    entity._segmentPolylines.push(pl);
                }
                // 渐变区外的部分整段
                if (fadeRatio < 1) {
                    const rA = fadeRatio, rB = 1;
                    const midT = aT + ((rA + rB) / 2) * (bT - aT);
                    const alpha = getOpacity(midT);
                    const finalOp = baseOp * alpha;
                    if (finalOp >= 0.01) {
                        const pl = L.polyline([
                            [a.lat + (b.lat - a.lat) * rA, a.lng + (b.lng - a.lng) * rA],
                            [b.lat, b.lng]
                        ], { color, weight: 3, opacity: finalOp, dashArray: dashed ? '6,6' : null }).addTo(this._entityLayerGroup);
                        entity._segmentPolylines.push(pl);
                    }
                }
            } else {
                // ── 渐变区外：整段 ──
                const midT = wd > 0 ? TimeUtils.diff(windowStart, TimeUtils.lerp(a.time, b.time, 0.5)) / wd : 1;
                const alpha = getOpacity(midT);
                const finalOp = baseOp * alpha;
                if (finalOp < 0.01) continue;
                const pl = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
                    color, weight: 3, opacity: finalOp, dashArray: dashed ? '6,6' : null
                }).addTo(this._entityLayerGroup);
                entity._segmentPolylines.push(pl);
            }
        }
    },

    /**
     * 创建途径点图标（小号灰色圆环 + 实体颜色内圆）
     * @param {string} color
     * @returns {L.DivIcon}
     */
    _createWaypointIcon(color, opacity = 1) {
        const html = `
            <div class="waypoint-marker-outer" style="opacity:${opacity}">
                <div class="waypoint-marker-inner" style="background:${color}"></div>
            </div>
        `;

        return L.divIcon({
            className: 'waypoint-marker',
            html: html,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });
    },

    /**
     * 创建实体图标（DivIcon）
     * 结构：28px 灰色圆环 > 20px 实体颜色圆 > 16px SVG 图标
     * @param {Object} entity - 实体对象
     * @returns {L.DivIcon}
     */
    _createEntityIcon(entity) {
        const core = entity.components.core;
        // 使用实体自己的图标名，fallback 到 'person'
        const iconName = core.icon || 'tag';
        const color = core.color || '#333';
        const labelColor = adjustColor(color, 0.15, 0.15); // 变亮一点作为标签颜色
        const name = core.name || '';

        // 检查当前实体是否为选中项
        const selectedItem = AppState.get('selectedItem');
        const isSelected = selectedItem && selectedItem.type === 'entity' && selectedItem.data.id === entity.id;
        const outerClass = isSelected ? 'entity-marker-outer selected' : 'entity-marker-outer';

        const html = `
        <div class="entity-marker-wrapper">
            <div class="${outerClass}">
                <div class="entity-marker-background" style="background:${color}">
                    <span class="icon" data-name="${iconName}"></span>
                </div>
            </div>
            <span class="entity-marker-label" style="color:${labelColor}">${name}</span>
        </div>
    `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        // 初始化内部的 SVG 图标
        wrapper.querySelectorAll('.icon').forEach(el => {
            el.innerHTML = getIcon(el.dataset.name, 16);
        });

        return L.divIcon({
            className: 'entity-marker',
            html: wrapper.innerHTML,
            iconSize: [200, 28],
            iconAnchor: [14, 14]
        });
    }
};