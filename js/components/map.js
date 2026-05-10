/**
 * 地图模块（全局单例）
 * 职责：
 * - 初始化 Leaflet 地图
 * - 根据当前时间渲染所有人物标记和轨迹
 * - 监听 currentTime 变化自动重绘
 * - 监听 persons 数据变化
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
        this.renderPersons();

        // 3. 订阅时间变化，自动重绘
        EventBus.on('state:change', (data) => {
            if (data.key === 'currentTime') {
                this.renderPersons();
            }
        });

        // 4. 如果将来人物数据变化，也重绘
        EventBus.on('state:change', (data) => {
            if (data.key === 'persons') {
                this.renderPersons();
            }
        });
    },

    /**
    * 人物位置插值工具
    * @param {Object} person - 包含 timeline 的人物对象
    * @param {number} time - 当前时间
    * @returns {{ lat: number, lng: number } | null}
    */
    getPersonPosition(person, time) {
        const t = person.timeline;
        if (!t || t.length === 0) return null;
        if (time < t[0].time || time > t[t.length - 1].time) return null;

        for (let i = 0; i < t.length - 1; i++) {
            const a = t[i];
            const b = t[i + 1];
            if (time >= a.time && time <= b.time) {
                const ratio = (time - a.time) / (b.time - a.time);
                return {
                    lat: a.lat + (b.lat - a.lat) * ratio,
                    lng: a.lng + (b.lng - a.lng) * ratio
                };
            }
        }
    },

    /**
     * 渲染所有人物标记和轨迹
     */
    renderPersons() {
        const persons = AppState.get('persons') || [];
        const currentTime = AppState.get('currentTime') || 0;

        persons.forEach(person => {
            const pos = this.getPersonPosition(person, currentTime);

            if (pos === null) {
                // 人物不存在，移除标记和轨迹
                if (person._marker) {
                    this.map.removeLayer(person._marker);
                    person._marker = null;
                }
                if (person._polyline) {
                    this.map.removeLayer(person._polyline);
                    person._polyline = null;
                }
                return;
            }

            // 更新或创建标记
            if (!person._marker) {
                person._marker = L.marker([pos.lat, pos.lng], {
                    icon: this._createPersonIcon(person)
                }).addTo(this.map);
            } else {
                person._marker.setLatLng([pos.lat, pos.lng]);
            }

            // 构建轨迹坐标数组（截至当前时间的路径）
            const path = [];
            for (let i = 0; i < person.timeline.length; i++) {
                const node = person.timeline[i];
                if (node.time <= currentTime) {
                    path.push([node.lat, node.lng]);
                } else {
                    // 添加当前插值点
                    const interpolated = this.getPersonPosition(person, currentTime);
                    if (interpolated) {
                        path.push([interpolated.lat, interpolated.lng]);
                    }
                    break;
                }
            }

            if (!person._polyline) {
                person._polyline = L.polyline(path, {
                    color: person.color,
                    weight: 3,
                    opacity: 0.9
                }).addTo(this.map);
            } else {
                person._polyline.setLatLngs(path);
            }
        });
    },

    /**
     * 创建人物图标（自动生成或使用自定义图片）
     * @param {Object} person
     * @returns {L.Icon|L.DivIcon}
     */
    _createPersonIcon(person) {
        if (person.iconUrl) {
            return L.icon({
                iconUrl: person.iconUrl,
                iconSize: person.iconSize || [32, 32]
            });
        }

        const html = `
            <div class="person-marker-background" style="background:${person.color}">
                <span class="icon" data-name="man"></span>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        // 初始化 SVG 图标
        wrapper.querySelectorAll('.icon').forEach(el => {
            const name = el.dataset.name;
            el.innerHTML = getIcon(name, 16);
        });

        return L.divIcon({
            className: 'person-marker',
            html: wrapper.innerHTML,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }
};