/**
 * 筛选引擎（纯数据模块，不依赖 DOM）
 * 根据 filterCriteria 对实体列表进行多层过滤
 */
const FilterEngine = {
    /**
     * 应用所有筛选条件
     * @param {Array} entities - 全部实体列表
     * @param {Object} criteria - AppState.filterCriteria
     * @param {Object} context - { currentTime, mapBounds }
     * @returns {Array} 筛选后的实体列表
     */
    apply(entities, criteria, context = {}) {
        if (!entities || !entities.length) return [];
        if (!criteria) return [...entities];

        let filtered = [...entities];

        // 1. 实体类型筛选
        filtered = this._filterByType(filtered, criteria.entityTypes);

        // 2. 时间范围筛选
        if (criteria.timeFilter && criteria.timeFilter.enabled) {
            filtered = this._filterByTime(filtered, criteria.timeFilter, context.currentTime);
        }

        // 3. 地图范围筛选
        if (criteria.mapBounds && criteria.mapBounds.enabled && context.mapBounds) {
            filtered = this._filterByBounds(filtered, context.mapBounds);
        }

        // 4. 关键词搜索
        if (criteria.keyword) {
            filtered = this._filterByKeyword(filtered, criteria.keyword);
        }

        // 5. 自定义标签筛选
        if (criteria.tags && criteria.tags.length > 0) {
            filtered = this._filterByTags(filtered, criteria.tags);
        }

        return filtered;
    },

    /**
     * 按实体类型筛选
     * @param {Array} entities
     * @param {Object} typeMap - { person: true, place: true, ... }
     * @returns {Array}
     */
    _filterByType(entities, typeMap) {
        if (!typeMap) return entities;

        return entities.filter(entity => {
            // 检查实体是否拥有至少一个被勾选的组件类型
            for (const comp of Object.values(entity.components)) {
                const type = comp.type;
                // customTags 类型的处理
                if (type === 'customTags') {
                    if (typeMap.customTags) return true;
                } else if (typeMap[type]) {
                    return true;
                }
            }
            return false;
        });
    },

    /**
     * 按时间范围筛选
     * @param {Array} entities
     * @param {Object} timeFilter - { enabled, mode, from, to, followTimeline }
     * @param {Object} currentTime - AppState.currentTime
     * @returns {Array}
     */
    _filterByTime(entities, timeFilter, currentTime) {
        if (!timeFilter || !timeFilter.enabled) return entities;

        let refTime;
        if (timeFilter.followTimeline) {
            // 跟随时间轴：使用当前时间
            refTime = currentTime || { year: 0 };
        } else if (timeFilter.mode === 'range' && timeFilter.from && timeFilter.to) {
            // 时段模式：检查实体活跃期是否与 [from, to] 有交集
            return entities.filter(entity => {
                const lifespan = this._getEntityLifespan(entity);
                if (!lifespan) return false;
                // 实体活跃区间与筛选区间有交集
                return TimeUtils.compare(lifespan.start, timeFilter.to) <= 0 &&
                    TimeUtils.compare(lifespan.end, timeFilter.from) >= 0;
            });
        } else {
            // 未提供有效时间，不过滤
            return entities;
        }

        if (!refTime) return entities;

        // moment 模式：实体在 refTime 时刻活跃
        return entities.filter(entity => {
            const lifespan = this._getEntityLifespan(entity);
            if (!lifespan) return false;
            return TimeUtils.compare(lifespan.start, refTime) <= 0 &&
                TimeUtils.compare(lifespan.end, refTime) >= 0;
        });
    },

    /**
     * 获取实体活跃时间范围
     * @param {Object} entity
     * @returns {{ start: Object, end: Object } | null}
     */
    _getEntityLifespan(entity) {
        const components = entity.components;

        // Person 组件
        if (components.person && components.person.birthTime && components.person.deathTime) {
            return {
                start: components.person.birthTime,
                end: components.person.deathTime
            };
        }

        // Motion 组件
        if (components.motion) {
            const waypoints = components.motion.waypoints || [];
            if (waypoints.length > 0) {
                const first = waypoints[0];
                const last = waypoints[waypoints.length - 1];
                // 取 arrival 作为活动开始时间
                const start = first.time.arrival || first.time;
                const end = last.time.departure || last.time.arrival || last.time;
                if (start && end) {
                    return { start, end };
                }
            }
        }

        // Place / Organization / Regime 无时间概念，不符合时间筛选时返回 null
        return null;
    },

    /**
     * 按地图可见范围筛选
     * @param {Array} entities
     * @param {Object} bounds - Leaflet LatLngBounds 对象
     * @returns {Array}
     */
    _filterByBounds(entities, bounds) {
        if (!bounds || typeof bounds.contains !== 'function') return entities;

        return entities.filter(entity => {
            // Place 实体：检查 position 是否在 bounds 内
            if (entity.components.place && entity.components.place.position) {
                const pos = entity.components.place.position;
                if (pos.lat != null && pos.lng != null) {
                    return bounds.contains([pos.lat, pos.lng]);
                }
            }

            // Motion 实体：检查至少一个途径点在 bounds 内
            if (entity.components.motion) {
                const waypoints = entity.components.motion.waypoints || [];
                for (const wp of waypoints) {
                    let lat, lng;
                    if (wp.pos) {
                        if (wp.pos.type === 'coords') {
                            lat = wp.pos.lat;
                            lng = wp.pos.lng;
                        } else if (wp.pos.type === 'place') {
                            // 绑定地点类型，需要查找地点实体的坐标
                            const placeEntity = AppState.get('entities').find(e => e.id === wp.pos.entityId);
                            if (placeEntity && placeEntity.components.place && placeEntity.components.place.position) {
                                lat = placeEntity.components.place.position.lat;
                                lng = placeEntity.components.place.position.lng;
                            }
                        }
                    }
                    if (lat != null && lng != null && bounds.contains([lat, lng])) {
                        return true;
                    }
                }
                return false;
            }

            // 其他无位置组件的实体不过滤
            return true;
        });
    },

    /**
     * 按关键词模糊匹配实体名称
     * @param {Array} entities
     * @param {string} keyword
     * @returns {Array}
     */
    _filterByKeyword(entities, keyword) {
        if (!keyword || typeof keyword !== 'string') return entities;

        const lower = keyword.toLowerCase();
        return entities.filter(entity => {
            const core = entity.components.core;
            if (!core || !core.name) return false;
            return core.name.toLowerCase().includes(lower);
        });
    },

    /**
     * 按自定义标签筛选
     * @param {Array} entities
     * @param {Array<string>} tags - 选中的标签列表
     * @returns {Array}
     */
    _filterByTags(entities, tags) {
        if (!tags || tags.length === 0) return entities;

        const tagSet = new Set(tags);
        return entities.filter(entity => {
            const ct = entity.components.customTags;
            if (!ct || !ct.tags) return false;
            return ct.tags.some(t => tagSet.has(t));
        });
    },

    /**
     * 从所有实体中提取唯一的自定义标签列表
     * @param {Array} entities
     * @returns {Array<string>}
     */
    getAllTags(entities) {
        const tagSet = new Set();
        if (!entities) return [];
        entities.forEach(entity => {
            const ct = entity.components.customTags;
            if (ct && ct.tags) {
                ct.tags.forEach(t => tagSet.add(t));
            }
        });
        return Array.from(tagSet).sort();
    },

    /**
     * 统计当前激活的筛选条件数量
     * @param {Object} criteria - filterCriteria
     * @returns {number}
     */
    getActiveFilterCount(criteria) {
        if (!criteria) return 0;
        let count = 0;

        // 类型筛选：不是全部勾选
        if (criteria.entityTypes) {
            const allOn = Object.values(criteria.entityTypes).every(v => v === true);
            if (!allOn) count++;
        }

        // 时间筛选
        if (criteria.timeFilter && criteria.timeFilter.enabled) count++;

        // 地图范围筛选
        if (criteria.mapBounds && criteria.mapBounds.enabled) count++;

        // 关键词
        if (criteria.keyword && criteria.keyword.trim()) count++;

        // 标签
        if (criteria.tags && criteria.tags.length > 0) count++;

        return count;
    }
};