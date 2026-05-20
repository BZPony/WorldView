const SelectManager = {
    init() {
        // 监听全局自定义事件 'ui:select'
        EventBus.on('ui:select', (payload) => {
            // payload 格式：{ type : 'entity' id : '123' }
            const { type, id } = payload;

            if (type === 'entity') {
                console.log('selectedItem changed to' + ' entity ' + id);
                const entities = AppState.get('entities') || [];
                const entity = entities.find(e => e.id === id);
                if (entity) {
                    AppState.set('selectedItem', { type: 'entity', data: entity });
                }
            }
            // 其他类型...
        });
    }
};

window.SelectManager = SelectManager;