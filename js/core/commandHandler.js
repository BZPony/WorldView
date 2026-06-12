// js/core/commandHandler.js

/**
 * 命令处理器模块
 * 职责：
 * - 接收并处理所有来自 UI（如 ContextMenu, Toolbar, DetailPanel）的命令
 * - 通过命令模式实现 Undo/Redo 功能
 * - 所有应用数据的修改必须通过此模块
 */
const CommandHandler = {
    _undoStack: [],
    _redoStack: [],

    init() {
        // 订阅上下文菜单的所有动作
        EventBus.on('contextMenu:action', this._handleContextMenuAction.bind(this));

        // 订阅通用命令执行事件（来自 DetailPanel 等模块）
        EventBus.on('command:execute', this._handleCommand.bind(this));

        // 键盘快捷键
        document.addEventListener('keydown', this._handleKeydown.bind(this));
    },

    /**
     * 深拷贝 entities，剥离 Leaflet 运行时属性（_marker, _polyline, _waypointMarkers）
     * 这些属性由 MapView 附加在实体对象上，含有循环引用，JSON.stringify 无法处理
     * @param {Array} entities
     * @returns {Array} 纯净的深拷贝数组
     */
    _cloneEntities(entities) {
        return JSON.parse(JSON.stringify(entities, (key, value) => {
            if (key.startsWith('_')) return undefined;  // 跳过所有 _ 开头的运行时属性
            return value;
        }));
    },

    /**
     * 执行一个命令，记录到 undo 栈，清空 redo 栈
     * @param {Object} command - { type, description, execute, undo }
     */
    execute(command) {
        // 记录执行前快照
        command._beforeEntities = this._cloneEntities(AppState.get('entities'));
        // 执行
        command.execute();
        // 记录执行后快照
        command._afterEntities = this._cloneEntities(AppState.get('entities'));
        // 推入 undo 栈
        this._undoStack.push(command);
        // 清空 redo 栈
        this._redoStack = [];
        // 同步 selectedItem 引用，确保 DetailPanel 渲染最新数据
        this._syncSelectedItem();
        // 同步 secondaryPanelContent，确保途径点编辑后二级面板即时刷新
        this._syncSecondaryPanelContent();
        console.log(`[CommandHandler] 执行: ${command.description} (undoStack: ${this._undoStack.length})`);
    },

    /**
     * 撤销上一个命令
     */
    undo() {
        const command = this._undoStack.pop();
        if (!command) {
            console.log('[CommandHandler] 没有可撤销的操作');
            return;
        }

        // 用执行前快照恢复
        AppState.set('entities', command._beforeEntities);

        // 如果撤销的是编辑操作，需要同步 selectedItem 中 data 的引用
        this._syncSelectedItem();

        this._redoStack.push(command);
        console.log(`[CommandHandler] 撤销: ${command.description} (undoStack: ${this._undoStack.length})`);
    },

    /**
     * 重做之前撤销的命令
     */
    redo() {
        const command = this._redoStack.pop();
        if (!command) {
            console.log('[CommandHandler] 没有可重做的操作');
            return;
        }

        // 用执行后快照恢复
        AppState.set('entities', command._afterEntities);

        // 同步 selectedItem 引用
        this._syncSelectedItem();

        this._undoStack.push(command);
        console.log(`[CommandHandler] 重做: ${command.description} (redoStack: ${this._redoStack.length})`);
    },

    /**
     * 在 undo/redo 后，同步 selectedItem.data 指向新的实体引用
     * 因为 AppState.set('entities', ...) 会替换整个数组，selectedItem.data 需要同步更新
     */
    _syncSelectedItem() {
        const selectedItem = AppState.get('selectedItem');
        if (selectedItem && selectedItem.type === 'entity') {
            const entities = AppState.get('entities');
            const updated = entities.find(e => e.id === selectedItem.data.id);
            if (updated) {
                // 直接修改 selectedItem 引用
                AppState.set('selectedItem', { type: 'entity', data: updated });
            } else {
                // 实体已被删除，清空选中
                AppState.set('selectedItem', null);
            }
        }
    },

    /**
     * 同步 secondaryPanelContent 中的 data 指向最新实体数据
     * 与 _syncSelectedItem 对称，确保二级面板在编辑后即时刷新
     */
    _syncSecondaryPanelContent() {
        if (!AppState.get('isSecondaryPanelOpen')) return;
        const secContent = AppState.get('secondaryPanelContent');
        if (!secContent || !secContent.data) return;
        const compType = secContent.data._componentType;
        const index = secContent.data._index;
        if (compType == null || index == null) return;

        const selectedItem = AppState.get('selectedItem');
        if (!selectedItem) return;
        const entity = selectedItem.data;
        const comp = entity.components[compType];
        if (!comp) return;
        const itemsField = compType === 'motion' ? 'waypoints' : 'entries';
        const items = comp[itemsField];
        if (!items || index < 0 || index >= items.length) return;

        // 重新计算标题（途径点名称可能已变更）
        const item = items[index];
        const title = compType === 'motion'
            ? (MapView._getWaypointDisplayName(item) || `途径点 ${index + 1}`)
            : (item.name || `名称条目 ${index + 1}`);
        const updatedData = { ...item, _componentType: compType, _index: index };
        AppState.set('secondaryPanelContent', { title: title, data: updatedData });
    },

    /**
     * 沿路径读取嵌套属性
     */
    _getByPath(obj, path) {
        let current = obj;
        for (const key of path) {
            if (current == null) return undefined;
            current = current[key];
        }
        return current;
    },

    /**
     * 沿路径设置嵌套属性，不可变更新
     */
    _setByPath(obj, path, value) {
        if (path.length === 0) return value;
        const [head, ...rest] = path;
        if (Array.isArray(obj)) {
            const copy = [...obj];
            copy[head] = rest.length > 0 ? this._setByPath(obj[head], rest, value) : value;
            return copy;
        }
        return { ...obj, [head]: rest.length > 0 ? this._setByPath(obj[head], rest, value) : value };
    },

    /**
     * 创建编辑实体字段的命令（统一 path 模式）
     * @param {Object} params
     * @param {string} params.entityId
     * @param {string} params.componentType
     * @param {Array} params.path - 如 ['name'] 或 ['waypoints', 0, 'name']
     * @param {*} params.oldValue
     * @param {*} params.newValue
     * @returns {Object} command
     */
    createEditFieldCommand({ entityId, componentType, path, oldValue, newValue }) {
        const pathStr = `${componentType}.${path.join('.')}`;
        return {
            type: 'editEntityField',
            description: `编辑字段 ${pathStr}`,
            entityId,
            componentType,
            path,
            oldValue,
            newValue,
            execute: () => {
                const entities = AppState.get('entities').map(e => {
                    if (e.id !== entityId) return e;
                    const comp = this._setByPath(
                        JSON.parse(JSON.stringify(e.components[componentType])),
                        path, newValue
                    );
                    return { ...e, components: { ...e.components, [componentType]: comp } };
                });
                AppState.set('entities', entities);
            },
        };
    },

    /**
     * 创建实体命令
     * @param {Object} params
     * @param {string} params.description
     * @param {Object} params.entity - 要创建的实体数据
     * @param {boolean} params.selectAfter - 创建后是否自动选中
     * @returns {Object} command
     */
    createCreateEntityCommand({ description, entity, selectAfter = false }) {
        return {
            type: 'createEntity',
            description,
            entity,
            selectAfter,
            execute: () => {
                const entities = AppState.get('entities') || [];
                AppState.set('entities', [...entities, entity]);

                if (selectAfter) {
                    AppState.set('selectedItem', { type: 'entity', data: entity });
                }
            },
        };
    },

    // ───── 事件处理 ─────

    /**
     * 处理上下文菜单发出的动作
     */
    _handleContextMenuAction(payload) {
        const { action, latlng } = payload;

        switch (action) {
            case 'createPerson':
                this._handleCreatePerson(latlng);
                break;

            case 'createPlace':
                this._handleCreatePlace(latlng);
                break;

            case 'createWaypoint':
                this._handleCreateWaypoint(latlng);
                break;

            default:
                console.warn(`CommandHandler: 未知的 action '${action}'`);
        }
    },

    /**
     * 处理通用命令执行事件（来自 DetailPanel 等模块）
     * 事件格式：{ type, entityId, componentType, field, oldValue, newValue }
     */
    _handleCommand(payload) {
        const { type } = payload;

        switch (type) {
            case 'editEntityField':
                this.execute(this.createEditFieldCommand(payload));
                break;

            case 'deleteEntity':
                this._handleDeleteEntity(payload.entityId);
                break;

            default:
                console.warn(`CommandHandler: 未知的命令类型 '${type}'`);
        }
    },

    /**
     * 删除实体
     * @param {string} entityId
     */
    _handleDeleteEntity(entityId) {
        const entities = AppState.get('entities');
        const entity = entities.find(e => e.id === entityId);
        if (!entity) return;
        this.execute({
            type: 'deleteEntity',
            description: `删除实体 ${entity.components.core?.name || entityId}`,
            execute: () => {
                AppState.set('entities', entities.filter(e => e.id !== entityId));
            }
        });
    },

    /**
     * 键盘快捷键处理
     */
    _handleKeydown(e) {
        // Ctrl+Z / Cmd+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        }
        // Ctrl+Shift+Z / Cmd+Shift+Z
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
            e.preventDefault();
            this.redo();
        }
        // Ctrl+Y / Cmd+Y（备选重做快捷键）
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
    },

    /**
     * 处理"创建人物"命令
     */
    async _handleCreatePerson(latlng) {
        // 1. 调用 entities.js 创建数据
        const newPerson = createPersonData({ name: "新人物", lat: latlng.lat, lng: latlng.lng });

        // 2. 通过命令模式执行
        const command = this.createCreateEntityCommand({
            description: '创建人物',
            entity: newPerson,
            selectAfter: true
        });
        this.execute(command);
    },

    /**
     * 处理"创建地点"命令
     */
    async _handleCreatePlace(latlng) {
        const newPlace = createPlaceData({ name: "新地点", lat: latlng.lat, lng: latlng.lng });
        const command = this.createCreateEntityCommand({
            description: '创建地点',
            entity: newPlace,
            selectAfter: true
        });
        this.execute(command);
    },

    /**
     * 处理"创建途径点"命令
     * 在当前选中实体的 waypoints 中按时间顺序插入新途径点
     */
    async _handleCreateWaypoint(latlng) {
        const selectedItem = AppState.get('selectedItem');
        if (!selectedItem) return;
        const entity = selectedItem.data;
        const waypoints = entity.components.motion?.waypoints;
        if (!waypoints) return;

        const items = waypoints;
        const currentTime = AppState.get('currentTime') || { year: 0 };
        const newItem = DetailPanel._createMotionDefault(items, items.length - 1);
        newItem.time = {
            arrival: { ...currentTime },
            departure: { ...currentTime }
        };
        newItem.pos = { type: 'coords', lat: latlng.lat, lng: latlng.lng, name: '新途径点' };

        // 按时间插入：找到离开时间小于当前时间的最后一个 waypoint，在其后插入
        let insertIdx = items.length;
        for (let i = 0; i < items.length; i++) {
            const dep = items[i].time.departure || items[i].time.arrival || items[i].time;
            if (TimeUtils.compare(dep, currentTime) > 0) {
                insertIdx = i;
                break;
            }
        }

        const oldValue = JSON.parse(JSON.stringify(items));
        const newValue = [...items];
        newValue.splice(insertIdx, 0, newItem);

        EventBus.emit('command:execute', {
            type: 'editEntityField',
            entityId: entity.id,
            componentType: 'motion',
            path: ['waypoints'],
            oldValue,
            newValue
        });

        // 创建后立即打开新途径点的二级面板
        AppState.set('secondaryPanelContent', {
            title: '新途径点',
            data: { ...newItem, _componentType: 'motion', _index: insertIdx }
        });
        AppState.set('isSecondaryPanelOpen', true);
    },
};

// 导出或挂载到全局
window.CommandHandler = CommandHandler;