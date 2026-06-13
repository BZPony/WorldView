// js/core/state.js

const AppState = {
    state: {
        //应用状态，可以在view模块中修改
        selectedItem: null,
        currentTime: { year: 0 },   // 当前时间（时间对象）
        timeZoomLevel: 'year',      // 当前时间轴缩放级别
        isSidebarOpen: true,        // 侧边栏是否打开
        isDetailPanelOpen: false,
        isSecondaryPanelOpen: false,
        secondaryPanelContent: { title: '', data: null },
        isLocationPickerActive: false,       // 定位选取模式是否激活
        locationPickerTarget: null,          // 目标途径点 { componentType, index }
        pinnedEntities: [],                  // 被图钉固定在时间轴上的实体 ID 列表
        filterCriteria: {                    // 侧边栏筛选条件
            entityTypes: { person: true, place: true, organization: true, regime: true, customTags: true },
            timeFilter: { enabled: false, mode: 'moment', from: null, to: null, followTimeline: true },
            mapBounds: { enabled: false },
            keyword: '',
            tags: []
        },

        //应用数据，只能通过commandHandler模块修改
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