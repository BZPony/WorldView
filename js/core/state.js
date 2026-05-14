// js/core/state.js

const AppState = {
    state: {
        //应用状态，可以在view模块中修改
        selectedItem: null,
        currentTime: 0,          // 当前时间
        isSidebarOpen: true,     // 侧边栏是否打开
        isDetailPanelOpen: false,

        //应用数据，只能通过commandHandler模块修改
        persons: [],              // 人物数据（将由 data/entities.js 写入）
        entities: []
    },

    /**
     * 获取状态值
     * @param {string} key
     * @returns {*}
     */
    get(key) {
        return this.state[key];
    },

    /**
     * 设置状态值，并自动通过 EventBus 广播变化
     * @param {string} key
     * @param {*} value
     */
    set(key, value) {
        this.state[key] = value;
        EventBus.emit('state:change', {
            key: key,
            value: value,
            state: this.state
        });
    }
};

window.AppState = AppState;