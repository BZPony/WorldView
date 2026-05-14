const SelectManager = {
    init() {
        // 监听全局自定义事件 'ui:select'
        EventBus.on('ui:select', (payload) => {
            // payload 格式：{ type: 'person', id: 123 }
            const { type, id } = payload;

            if (type === 'person') {
                const persons = AppState.get('persons') || [];
                const person = persons.find(p => p.id === id);
                if (person) {
                    AppState.set('selectedItem', { type: 'person', data: person });
                    console.log('selectedItem changed to' + ' person ' + id);
                }
            }
            // 其他类型...
        });
    }
};

window.SelectManager = SelectManager;