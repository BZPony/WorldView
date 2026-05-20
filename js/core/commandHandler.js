// js/core/commandHandler.js

/**
 * 命令处理器模块
 * 职责：接收并处理所有来自 UI（如 ContextMenu, Toolbar）的命令，修改AppState中的应用数据
 */
const CommandHandler = {
    init() {
        // 订阅上下文菜单的所有动作
        EventBus.on('contextMenu:action', this._handleContextMenuAction.bind(this));

        // 未来可以在这里订阅其他命令源，例如:
        // EventBus.on('toolbar:click', this._handleToolbarAction.bind(this));
    },

    /**
     * 处理上下文菜单发出的动作
     */
    _handleContextMenuAction(payload) {
        const { action, latlng } = payload;

        switch (action) {
            case 'createPerson':
                this._handleCreatePerson(latlng);
                break;

            // ... 其他 action 的处理
            default:
                console.warn(`CommandHandler: 未知的 action '${action}'`);
        }
    },

    /**
     * 处理“创建人物”命令
     */
    async _handleCreatePerson(latlng) {
        // 1. 调用 entities.js 创建数据
        const newPerson = createPersonData({ name: "新人物", lat: latlng.lat, lng: latlng.lng });

        // 2. 更新全局状态
        const entities = AppState.get('entities') || [];
        AppState.set('entities', [...entities, newPerson]);

        // 3. 自动选中新创建的人物，触发 DetailPanel 打开
        AppState.set('selectedItem', { type: 'entity', data: newPerson });
    },
};

// 导出或挂载到全局
window.CommandHandler = CommandHandler;