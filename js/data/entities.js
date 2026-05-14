/*
实体数据结构使用ECS(Entity-Component-System)，
每个实体只是一个id加上一组动态挂载的组件，每个组件只携带自己关心的数据。
一个实体完全由其携带的组件决定是什么。
*/

/**
 * 基础信息组件（必备）
 */
function createCoreComponent({ name, color, icon = 'man' }) {
    return { type: 'core', name, color, icon };
}

/**
 * 时间轴轨迹组件（可选）
 */
function createTimelineComponent(waypoints = []) {
    return { type: 'timeline', waypoints };
}

/**
 * 人物组件（可选）
 */
function createPersonComponent({ birthTime, deathTime, gender, description } = {}) {
    return { type: 'person', birthTime, deathTime, gender, description };
}

/**
 * 政权组件（可选）
 */
function createRegimeComponent({ capital, population, governmentType } = {}) {
    return { type: 'regime', capital, population, governmentType };
}

/**
 * 组织组件（可选）
 */
function createOrganizationComponent({ headquarters, leader, members } = {}) {
    return { type: 'organization', headquarters, leader, members };
}

//未来有更多组件，则在此添加对应的组件创建函数
//...

/**
 * 创建实体
 * @param {string} id - 唯一标识
 * @param {Array<Object>} components - 组件数组，其中必须包含 core 组件
 * @returns {Object} 实体对象
 */
function createEntity(id, components) {
    const componentMap = {};
    for (const comp of components) {
        componentMap[comp.type] = comp;
    }
    if (!componentMap.core) {
        throw new Error(`实体 ${id} 缺少必需的 core 组件`);
    }
    return { id, components: componentMap };
}

/**
 * 快速创建人物实体
 */
function createPersonEntity({ id, name, color, waypoints, icon, ...personOptions }) {
    return createEntity(id, [
        createCoreComponent({ name, color, icon }),
        createTimelineComponent(waypoints),
        createPersonComponent(personOptions)
    ]);
}

// 新实体数组
const defaultEntities = [
    createPersonEntity({
        id: 'person_1',
        name: '张三',
        color: '#4f454f',
        waypoints: [
            { lat: 30, lng: 110, time: 0 },
            { lat: 32, lng: 115, time: 20 },
            { lat: 35, lng: 120, time: 40 },
            { lat: 40, lng: 116, time: 80 }
        ],
        birthTime: -50,
        deathTime: 100,
        gender: '男',
        description: '一位旅行者'
    }),
    createPersonEntity({
        id: 'person_2',
        name: '暮光闪闪',
        color: '#ff4d4f',
        waypoints: [
            { lat: 31, lng: 120, time: -200 },
            { lat: 33, lng: 118, time: 0 },
            { lat: 36, lng: 122, time: 50 },
            { lat: 38, lng: 119, time: 150 }
        ],
        birthTime: -250,
        deathTime: 200,
        gender: '女',
        description: '小马谷的图书管理员'
    }),
    createPersonEntity({
        id: 'person_3',
        name: '夜神月',
        color: '#347290',
        waypoints: [
            { lat: 28, lng: 115, time: -50 },
            { lat: 30, lng: 118, time: 0 },
            { lat: 34, lng: 117, time: 30 },
            { lat: 37, lng: 121, time: 70 }
        ],
        birthTime: -100,
        deathTime: 80,
        gender: '男',
        description: '卡密'
    }),
    createPersonEntity({
        id: 'person_4',
        name: '尤莉',
        color: '#359890',
        waypoints: [
            { lat: 29, lng: 112, time: -100 },
            { lat: 31, lng: 114, time: -20 },
            { lat: 33, lng: 116, time: 10 },
            { lat: 36, lng: 118, time: 60 }
        ],
        birthTime: -100,
        deathTime: 60,
        gender: '女',
        description: '金发德国少女'
    }),
    createPersonEntity({
        id: 'person_5',
        name: '利维亚的杰洛特',
        color: '#d7115d',
        waypoints: [
            { lat: 32, lng: 110, time: -150 },
            { lat: 35, lng: 113, time: -50 },
            { lat: 38, lng: 116, time: 50 },
            { lat: 41, lng: 119, time: 150 }
        ],
        birthTime: -300,
        deathTime: 150,
        gender: '男',
        description: '传奇猎魔人'
    })
];

// 保留旧 persons 数组，确保未迁移的模块仍能工作
const persons = defaultEntities.map(e => {
    // 简单转换回旧的扁平结构供兼容（实际可以暂时不动，但为了安全先保留旧变量）
    // 注意：如果你不想保留，可以在后续步骤中让所有模块直接使用实体，然后删除这行。
    const core = e.components.core;
    const timeline = e.components.timeline?.waypoints || [];
    return {
        id: e.id,
        name: core.name,
        color: core.color,
        iconUrl: null,
        iconSize: [32, 32],
        timeline,
        marker: null,
        polyline: null,
        tags: [String]
    };
});

/**
 * 创建一个新的人物（纯数据操作），不修改persons，只返回一个默认的人物数据结构
 */
function createPersonData({ name, lat, lng }) {
    const persons = AppState.get('persons') || [];
    const newId = Date.now();

    return {
        id: newId,
        name: name,
        timeline: [{ lat, lng, time: AppState.get('currentTime') || 0 }],
        color: "#4f454f",
        iconUrl: null,
        iconSize: [32, 32],
        tags: [],
        marker: null,
        polyline: null
    };
}

const organization = [
    {
        id: 6,
        name: "圣殿骑士",

        color: "#ffdd1a",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 7,
        name: "罗莎莉亚的指头",

        color: "#c115b5",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 8,
        name: "保护伞公司",

        color: "#ff1d1d",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 9,
        name: "猎魔人",

        color: "#143869",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 10,
        name: "避难所科技",

        color: "#ff970f",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
]

const regime = [
    {
        id: 11,
        name: "天马城邦",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 12,
        name: "洛斯里克王国",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 13,
        name: "永恒之城诺克隆恩",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 14,
        name: "博德之门",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
    {
        id: 15,
        name: "圣殿骑士",

        color: "#247290",
        iconUrl: null,
        iconSize: [32, 32],

        tags: [String],
        marker: null,
    },
]