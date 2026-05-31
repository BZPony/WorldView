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

        // 2. 初始化时立即渲染一次
        this.renderTimelineEntities();

        // 3. 订阅时间变化，自动重绘
        EventBus.on('state:change', (data) => {
            if (data.key === 'currentTime') {
                this.renderTimelineEntities();
            }
        });

        // 4. 如果将来实体数据变化，也重绘
        EventBus.on('state:change', (data) => {
            if (data.key === 'entities') {
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
            return time === waypoints[0].time ? { lat: waypoints[0].lat, lng: waypoints[0].lng } : null;
        }

        if (time < waypoints[0].time || time > waypoints[waypoints.length - 1].time) return null;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const a = waypoints[i];
            const b = waypoints[i + 1];
            if (time >= a.time && time <= b.time) {
                const ratio = (time - a.time) / (b.time - a.time);
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
                if (entity._polyline) {
                    this.map.removeLayer(entity._polyline);
                    entity._polyline = null;
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
                }).addTo(this.map);

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

            // 构建轨迹坐标数组（截至当前时间的路径）
            const path = [];
            for (let i = 0; i < entity.components.timeline.waypoints.length; i++) {
                const node = entity.components.timeline.waypoints[i];
                if (node.time <= currentTime) {
                    path.push([node.lat, node.lng]);
                } else {
                    // 添加当前插值点
                    const interpolated = this.getEntityPosition(entity, currentTime);
                    if (interpolated) {
                        path.push([interpolated.lat, interpolated.lng]);
                    }
                    break;
                }
            }

            if (!entity._polyline) {
                entity._polyline = L.polyline(path, {
                    color: entity.components.core.color,
                    weight: 3,
                    opacity: 0.9
                }).addTo(this.map);
            } else {
                entity._polyline.setLatLngs(path);
            }
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

        // 为每个已达到当前时间的途径点创建标记
        waypoints.forEach((wp, index) => {
            if (wp.time > currentTime) return;

            const icon = this._createWaypointIcon(color);
            const marker = L.marker([wp.lat, wp.lng], {
                icon: icon,
                interactive: false,
                zIndexOffset: -100
            }).addTo(this.map);

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
     * 创建途径点图标（小号灰色圆环 + 实体颜色内圆）
     * @param {string} color
     * @returns {L.DivIcon}
     */
    _createWaypointIcon(color) {
        const html = `
            <div class="waypoint-marker-outer">
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