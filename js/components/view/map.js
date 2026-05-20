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
    },

    /**
    * 获取所有包含 timeline 组件的实体
    */
    getTimelineEntities() {
        const entities = AppState.get('entities') || [];
        return entities.filter(e => e.components.timeline);
    },

    /**
    * 实体位置插值工具
    * @param {Object} entities - 包含 timeline 的实体对象
    * @param {number} time - 当前时间
    * @returns {{ lat: number, lng: number } | null}
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
     * 渲染所有实体标记和轨迹
     */
    renderTimelineEntities() {
        const entities = this.getTimelineEntities() || [];
        const currentTime = AppState.get('currentTime') || 0;

        entities.forEach(entity => {
            console.log("rendering " + entity.components.core.name);
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
                return;
            }

            // 更新或创建标记
            if (!entity._marker) {
                entity._marker = L.marker([pos.lat, pos.lng], {
                    icon: this._createEntityIcon(entity)
                }).addTo(this.map);
            } else {
                entity._marker.setLatLng([pos.lat, pos.lng]);
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
     * 创建实体图标（始终使用 DivIcon 动态生成 SVG）
     * @param {Object} entity
     * @returns {L.DivIcon}
     */
    _createEntityIcon(entity) {
        const core = entity.components.core;
        // 使用实体自己的图标名，fallback 到 'person'
        const iconName = core.icon || 'tag';
        const color = core.color || '#333';

        const html = `
        <div class="entity-marker-background" style="background:${color}">
            <span class="icon" data-name="${iconName}"></span>
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
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }
};