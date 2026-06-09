/**
 * 地图模块（全局单例）
 */
const MapView = {
    map: null,
    _entityLayerGroup: null,

    init(containerId = 'map') {
        this.map = L.map(containerId, {
            center: [35.8617, 104.1954], zoom: 6, zoomControl: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);
        L.control.zoom({ position: 'topright' }).addTo(this.map);
        setTimeout(() => this.map.invalidateSize(), 100);

        this._entityLayerGroup = L.layerGroup().addTo(this.map);
        this.renderTimelineEntities();

        EventBus.on('state:change', (data) => {
            if (data.key === 'currentTime') this.renderTimelineEntities();
        });
        EventBus.on('state:change', (data) => {
            if (data.key === 'entities') {
                (data.value || []).forEach(e => {
                    e._marker = null;
                    e._polyline = null;
                    e._segmentPolylines = [];
                    e._waypointMarkers = [];
                });
                this._entityLayerGroup.clearLayers();
                this.renderTimelineEntities();
            }
        });
        EventBus.on('state:change', (data) => {
            if (data.key === 'selectedItem') this.renderTimelineEntities();
        });
    },

    /**
     * 筛选出在地图上有位置的实体
     */
    getPositionedEntities() {
        return (AppState.get('entities') || []).filter(e =>
            e.components.motion || e.components.place
        );
    },

    /**
     * 获取实体的途径点数组
     */
    _getWaypoints(entity) {
        if (entity.components.motion) return entity.components.motion.waypoints || [];
        return [];
    },

    /**
     * 实体位置计算
     *   place：返回固定位置
     *   motion：线性插值
     */
    getEntityPosition(entity, time) {
        // 固定位置（place 组件）
        if (entity.components.place) {
            const pos = entity.components.place.position;
            if (pos) return { lat: pos.lat, lng: pos.lng };
        }

        // 以下为 motion 插值逻辑
        const waypoints = this._getWaypoints(entity);
        if (!waypoints || waypoints.length === 0) return null;

        if (waypoints.length === 1) {
            const d = waypoints[0].time.departure || waypoints[0].time.arrival || waypoints[0].time;
            return TimeUtils.compare(time, d) === 0
                ? { lat: waypoints[0].lat, lng: waypoints[0].lng } : null;
        }

        const first = waypoints[0].time.departure || waypoints[0].time.arrival || waypoints[0].time;
        const last = waypoints[waypoints.length - 1].time.arrival || waypoints[waypoints.length - 1].time;
        if (TimeUtils.compare(time, first) < 0 || TimeUtils.compare(time, last) > 0) return null;

        for (let i = 0; i < waypoints.length - 1; i++) {
            const a = waypoints[i], b = waypoints[i + 1];
            const ss = a.time.departure || a.time.arrival || a.time;
            const se = b.time.arrival || b.time.departure || b.time;
            if (TimeUtils.compare(time, ss) >= 0 && TimeUtils.compare(time, se) <= 0) {
                const r = TimeUtils.diff(ss, se);
                const o = TimeUtils.diff(ss, time);
                const ratio = r !== 0 ? o / r : 0;
                return { lat: a.lat + (b.lat - a.lat) * ratio, lng: a.lng + (b.lng - a.lng) * ratio };
            }
        }
        return null;
    },

    /**
     * 主渲染入口
     */
    renderTimelineEntities() {
        const entities = this.getPositionedEntities() || [];
        const ct = AppState.get('currentTime') || 0;

        entities.forEach(entity => {
            const pos = this.getEntityPosition(entity, ct);
            const hasMotion = !!entity.components.motion;

            if (pos === null) {
                if (entity._marker) { this.map.removeLayer(entity._marker); entity._marker = null; }
                if (entity._segmentPolylines) {
                    entity._segmentPolylines.forEach(pl => this._entityLayerGroup.removeLayer(pl));
                    entity._segmentPolylines = [];
                }
                this._clearWaypointMarkers(entity);
                return;
            }

            if (!entity._marker) {
                entity._marker = L.marker([pos.lat, pos.lng], {
                    icon: this._createEntityIcon(entity)
                }).addTo(this._entityLayerGroup);
                entity._marker.addEventListener('click', () => {
                    EventBus.emit('ui:select', { type: 'entity', id: entity.id });
                });
            } else {
                entity._marker.setLatLng([pos.lat, pos.lng]);
                entity._marker.setIcon(this._createEntityIcon(entity));
            }

            if (hasMotion && !entity.components.place) {
                // 有轨迹且非固定位置 → 渲染途径点和轨迹线
                this._renderWaypointMarkers(entity, ct);
                this._renderSegments(entity, ct);
            } else {
                if (entity._segmentPolylines) {
                    entity._segmentPolylines.forEach(pl => this._entityLayerGroup.removeLayer(pl));
                    entity._segmentPolylines = [];
                }
                this._clearWaypointMarkers(entity);
            }
        });
    },

    // ───── 私有方法 ─────

    _renderWaypointMarkers(entity, currentTime) {
        const color = entity.components.core.color || '#333';
        const waypoints = this._getWaypoints(entity);
        if (!entity._waypointMarkers) entity._waypointMarkers = [];
        this._clearWaypointMarkers(entity);

        const tw = TimeConfig.trackWindow;
        const ws = tw && tw.enabled ? TimeUtils.subtract(currentTime, tw.value, tw.unit) : null;
        const wd = ws ? TimeUtils.diff(ws, currentTime) : 0;
        const getOpacity = (t) => { if (!ws) return 1; const ft = 1 / 3; if (t >= ft) return 1; if (t <= 0) return 0; return t / ft; };

        waypoints.forEach(wp => {
            const wt = wp.time.arrival || wp.time.departure || wp.time;
            if (TimeUtils.compare(currentTime, wt) < 0) return;
            let alpha = 1;
            if (ws && wd > 0) { const t = TimeUtils.diff(ws, wt) / wd; alpha = getOpacity(t); }
            if (alpha < 0.01) return;
            const name = wp.name || `(${wp.lat.toFixed(2)}, ${wp.lng.toFixed(2)})`;
            const icon = this._createWaypointIcon(color, alpha, name);
            const marker = L.marker([wp.lat, wp.lng], { icon, interactive: false, zIndexOffset: -100, opacity: alpha }).addTo(this._entityLayerGroup);
            entity._waypointMarkers.push(marker);
        });
    },

    _clearWaypointMarkers(entity) {
        if (entity._waypointMarkers) {
            entity._waypointMarkers.forEach(m => this.map.removeLayer(m));
            entity._waypointMarkers = [];
        }
    },

    _renderSegments(entity, currentTime) {
        const waypoints = this._getWaypoints(entity);
        const tw = TimeConfig.trackWindow;
        const ws = tw && tw.enabled ? TimeUtils.subtract(currentTime, tw.value, tw.unit) : null;
        const wd = ws ? TimeUtils.diff(ws, currentTime) : 0;

        const path = [];
        for (let i = 0; i < waypoints.length; i++) {
            const wt = waypoints[i].time.arrival || waypoints[i].time.departure || waypoints[i].time;
            if (TimeUtils.compare(wt, currentTime) <= 0) {
                path.push({ lat: waypoints[i].lat, lng: waypoints[i].lng, time: wt });
            } else {
                const ip = this.getEntityPosition(entity, currentTime);
                if (ip) path.push({ lat: ip.lat, lng: ip.lng, time: currentTime });
                break;
            }
        }
        if (path.length < 2) {
            if (entity._segmentPolylines) {
                entity._segmentPolylines.forEach(pl => this._entityLayerGroup.removeLayer(pl));
                entity._segmentPolylines = [];
            }
            return;
        }

        const personComp = entity.components.person;
        const color = entity.components.core.color;
        const isOutside = (tA, tB) => {
            if (!personComp) return false;
            const { birthTime, deathTime } = personComp;
            if (birthTime == null && deathTime == null) return false;
            if (birthTime != null && (TimeUtils.compare(tA, birthTime) < 0 || TimeUtils.compare(tB, birthTime) < 0)) return true;
            if (deathTime != null && (TimeUtils.compare(tA, deathTime) > 0 || TimeUtils.compare(tB, deathTime) > 0)) return true;
            return false;
        };
        const getOpacity = (t) => { if (!ws) return 1; const ft = 1 / 3; if (t >= ft) return 1; if (t <= 0) return 0; return t / ft; };
        const SUBDIVISIONS = 30;

        if (entity._segmentPolylines) {
            entity._segmentPolylines.forEach(pl => this._entityLayerGroup.removeLayer(pl));
        }
        entity._segmentPolylines = [];

        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            const dashed = isOutside(a.time, b.time);
            const baseOp = dashed ? 0.5 : 1;
            let needsSub = false;
            if (ws && wd > 0) {
                const aT = TimeUtils.diff(ws, a.time) / wd;
                const bT = TimeUtils.diff(ws, b.time) / wd;
                needsSub = Math.min(aT, bT) < 1 / 3;
            }
            if (needsSub && baseOp > 0) {
                const aT = TimeUtils.diff(ws, a.time) / wd;
                const bT = TimeUtils.diff(ws, b.time) / wd;
                const fadeRatio = Math.max(0, (1 / 3 - aT) / (bT - aT));
                const subEnd = Math.min(fadeRatio, 1);
                const n = Math.max(2, Math.round(SUBDIVISIONS * subEnd * 2));
                for (let s = 0; s < n; s++) {
                    const rA = (s / n) * subEnd;
                    const rB = (s < n - 1) ? ((s + 1) / n) * subEnd * (1 - 1e-8) : ((s + 1) / n) * subEnd;
                    const midT = aT + ((rA + rB) / 2) * (bT - aT);
                    const alpha = getOpacity(midT); const finalOp = baseOp * alpha;
                    if (finalOp < 0.01) continue;
                    const pl = L.polyline([
                        [a.lat + (b.lat - a.lat) * rA, a.lng + (b.lng - a.lng) * rA],
                        [a.lat + (b.lat - a.lat) * rB, a.lng + (b.lng - a.lng) * rB]
                    ], { color, weight: 3, opacity: finalOp, dashArray: dashed ? '6,6' : null }).addTo(this._entityLayerGroup);
                    entity._segmentPolylines.push(pl);
                }
                if (fadeRatio < 1) {
                    const rA = fadeRatio, rB = 1;
                    const midT = aT + ((rA + rB) / 2) * (bT - aT);
                    const alpha = getOpacity(midT); const finalOp = baseOp * alpha;
                    if (finalOp >= 0.01) {
                        const pl = L.polyline([
                            [a.lat + (b.lat - a.lat) * rA, a.lng + (b.lng - a.lng) * rA],
                            [b.lat, b.lng]
                        ], { color, weight: 3, opacity: finalOp, dashArray: dashed ? '6,6' : null }).addTo(this._entityLayerGroup);
                        entity._segmentPolylines.push(pl);
                    }
                }
            } else {
                const midT = wd > 0 ? TimeUtils.diff(ws, TimeUtils.lerp(a.time, b.time, 0.5)) / wd : 1;
                const alpha = getOpacity(midT); const finalOp = baseOp * alpha;
                if (finalOp < 0.01) continue;
                const pl = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
                    color, weight: 3, opacity: finalOp, dashArray: dashed ? '6,6' : null
                }).addTo(this._entityLayerGroup);
                entity._segmentPolylines.push(pl);
            }
        }
    },

    _createWaypointIcon(color, opacity = 1, name = '') {
        const html = `<div class="waypoint-marker-wrapper" style="opacity:${opacity}"><div class="waypoint-marker-outer"><div class="waypoint-marker-inner" style="background:${color}"></div></div><span class="waypoint-marker-label">${name}</span></div>`;
        return L.divIcon({ className: 'waypoint-marker', html, iconSize: [200, 12], iconAnchor: [6, 6] });
    },

    /**
     * 获取实体在当前时间下的显示名称
     * 优先级：nameHistory → core.name
     */
    _getDisplayName(entity, currentTime) {
        if (entity.components.nameHistory) {
            const entries = entity.components.nameHistory.entries || [];
            let bestName = null;
            for (const e of entries) {
                if (TimeUtils.compare(e.time, currentTime) <= 0) bestName = e.name;
            }
            if (bestName) return bestName;
        }
        return entity.components.core.name || '';
    },

    _createEntityIcon(entity) {
        const core = entity.components.core;
        const iconName = core.icon || 'tag';
        const color = core.color || '#333';
        const labelColor = adjustColor(color, 0.15, 0.15);
        const ct = AppState.get('currentTime') || { year: 0 };
        const name = this._getDisplayName(entity, ct);
        const sel = AppState.get('selectedItem');
        const isSelected = sel && sel.type === 'entity' && sel.data.id === entity.id;
        const outerClass = isSelected ? 'entity-marker-outer selected' : 'entity-marker-outer';
        const html = `<div class="entity-marker-wrapper"><div class="${outerClass}"><div class="entity-marker-background" style="background:${color}"><span class="icon" data-name="${iconName}"></span></div></div><span class="entity-marker-label" style="color:${labelColor}">${name}</span></div>`;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        wrapper.querySelectorAll('.icon').forEach(el => el.innerHTML = getIcon(el.dataset.name, 16));
        return L.divIcon({ className: 'entity-marker', html: wrapper.innerHTML, iconSize: [200, 28], iconAnchor: [14, 14] });
    }
};