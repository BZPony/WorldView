/*
实体数据结构使用ECS(Entity-Component-System)，
每个实体只是一个id加上一组动态挂载的组件，每个组件只携带自己关心的数据。
一个实体完全由其携带的组件决定是什么。
*/

/**
 * 基础信息组件（必备）
 */
function createCoreComponent({ name, color, icon = 'person' }) {
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

function createCustomTagComponent(tags = []) {
    return { type: 'customTags', tags };
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

function createOrganizationEntity({ id, name, color, icon, ...organizationOptions }) {
    return createEntity(id, [
        createCoreComponent({ name, color, icon }),
        createOrganizationComponent(organizationOptions)
    ]);
}

function createRegimeEntity({ id, name, color, icon, ...regimeOption }) {
    return createEntity(id, [
        createCoreComponent({ name, color, icon }),
        createRegimeComponent(regimeOption)
    ])
}

/**
 * 创建一个新的人物（纯数据操作），不修改persons，只返回一个默认的人物数据结构
 */
function createPersonData({ name, lat, lng }) {
    const persons = AppState.get('entities') || [];
    const newId = Date.now().toString();

    return createPersonEntity({
        id: newId,
        name: name,
        color: '#4f454f',
        waypoints: [{ lat, lng, time: AppState.get('currentTime') || 0 }],
        birthTime: 0,
        deathTime: 100,
        gender: '男',
        description: '新人物'
    });
}

// 新实体数组
const entities = [
    // ---------- 人物 ----------
    {
        id: 'person_1',
        components: {
            core: { type: 'core', name: '张三', color: '#4f454f', icon: 'person' },
            timeline: {
                type: 'timeline',
                waypoints: [
                    { lat: 30, lng: 110, time: 0 },
                    { lat: 32, lng: 115, time: 20 },
                    { lat: 35, lng: 120, time: 40 },
                    { lat: 40, lng: 116, time: 80 }
                ]
            },
            person: { type: 'person', birthTime: -50, deathTime: 100, gender: '男', description: '一位旅行者' }
        }
    },
    {
        id: 'person_2',
        components: {
            core: { type: 'core', name: '暮光闪闪', color: '#ff4d4f', icon: 'person' },
            timeline: {
                type: 'timeline',
                waypoints: [
                    { lat: 31, lng: 120, time: -200 },
                    { lat: 33, lng: 118, time: 0 },
                    { lat: 36, lng: 122, time: 50 },
                    { lat: 38, lng: 119, time: 150 }
                ]
            },
            person: { type: 'person', birthTime: -250, deathTime: 200, gender: '女', description: '小马谷的图书管理员' }
        }
    },
    {
        id: 'person_3',
        components: {
            core: { type: 'core', name: '夜神月', color: '#347290', icon: 'person' },
            timeline: {
                type: 'timeline',
                waypoints: [
                    { lat: 28, lng: 115, time: -50 },
                    { lat: 30, lng: 118, time: 0 },
                    { lat: 34, lng: 117, time: 30 },
                    { lat: 37, lng: 121, time: 70 }
                ]
            },
            person: { type: 'person', birthTime: -100, deathTime: 80, gender: '男', description: '卡密' }
        }
    },
    {
        id: 'person_4',
        components: {
            core: { type: 'core', name: '尤莉', color: '#359890', icon: 'person' },
            timeline: {
                type: 'timeline',
                waypoints: [
                    { lat: 29, lng: 112, time: -100 },
                    { lat: 31, lng: 114, time: -20 },
                    { lat: 33, lng: 116, time: 10 },
                    { lat: 36, lng: 118, time: 60 }
                ]
            },
            person: { type: 'person', birthTime: -100, deathTime: 60, gender: '女', description: '金发德国少女' }
        }
    },
    {
        id: 'person_5',
        components: {
            core: { type: 'core', name: '利维亚的杰洛特', color: '#d7115d', icon: 'person' },
            timeline: {
                type: 'timeline',
                waypoints: [
                    { lat: 32, lng: 110, time: -150 },
                    { lat: 35, lng: 113, time: -50 },
                    { lat: 38, lng: 116, time: 50 },
                    { lat: 41, lng: 119, time: 150 }
                ]
            },
            person: { type: 'person', birthTime: -300, deathTime: 150, gender: '男', description: '传奇猎魔人' }
        }
    },

    // ---------- 组织 ----------
    {
        id: 'org_1',
        components: {
            core: { type: 'core', name: '圣殿骑士', color: '#ffdd1a', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '阿克城',
                leader: '大团长罗伯特·德·萨布蕾',
                members: '骑士、牧师、军士'
            }
        }
    },
    {
        id: 'org_2',
        components: {
            core: { type: 'core', name: '罗莎莉亚的指头', color: '#c115b5', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '蔷薇教堂',
                leader: '罗莎莉亚',
                members: '指头女巫、血指猎人'
            }
        }
    },
    {
        id: 'org_3',
        components: {
            core: { type: 'core', name: '保护伞公司', color: '#ff1d1d', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '浣熊市地下研究所',
                leader: '奥斯维尔·斯宾塞',
                members: '研究员、安全部队、生化武器开发组'
            }
        }
    },
    {
        id: 'org_4',
        components: {
            core: { type: 'core', name: '猎魔人', color: '#143869', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '凯尔莫罕',
                leader: '维瑟米尔',
                members: '猎魔人学徒、学派导师'
            }
        }
    },
    {
        id: 'org_5',
        components: {
            core: { type: 'core', name: '避难所科技', color: '#ff970f', icon: 'organization' },
            organization: {
                type: 'organization',
                headquarters: '华盛顿特区',
                leader: '董事会',
                members: '科学家、工程师、监督者'
            }
        }
    },

    // ---------- 政权 ----------
    {
        id: 'regime_1',
        components: {
            core: { type: 'core', name: '天马城邦', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '云中城',
                population: '约50万小马',
                governmentType: '君主制'
            }
        }
    },
    {
        id: 'regime_2',
        components: {
            core: { type: 'core', name: '洛斯里克王国', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '洛斯里克王城',
                population: '未知（不死人诅咒蔓延）',
                governmentType: '君主制（双王子共治）'
            }
        }
    },
    {
        id: 'regime_3',
        components: {
            core: { type: 'core', name: '永恒之城诺克隆恩', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '诺克隆恩地下神殿',
                population: '夜人与泪滴族群',
                governmentType: '神权共和'
            }
        }
    },
    {
        id: 'regime_4',
        components: {
            core: { type: 'core', name: '博德之门', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '博德之门城',
                population: '约20万（多种族混居）',
                governmentType: '公爵议会制'
            }
        }
    },
    {
        id: 'regime_5',
        components: {
            core: { type: 'core', name: '圣殿骑士团', color: '#247290', icon: 'country' },
            regime: {
                type: 'regime',
                capital: '阿卡圣城',
                population: '以军事修士会为核心的政教合一领地',
                governmentType: '政教合一骑士团'
            }
        }
    }
];