<template>
    <a-layout id="app">
        <a-layout-sider :trigger="null" collapsible v-model="collapsed">
            <div class="logo">{{collapsed ? 'CS' : 'Cdgame Simulator'}}</div>
            <a-menu class="site-menu" theme="dark" mode="inline" :defaultSelectedKeys="['1']" @select="onSelectMenu"
                    :selectedKeys="selectedKeys">
                <a-menu-item v-for="item in visibleMenuItems" :key="item.key">
                    <a-icon :type="item.icon"/>
                    <span>{{ item.title }}</span>
                </a-menu-item>
            </a-menu>
        </a-layout-sider>
        <a-layout class="site-right">
            <a-layout-header class="site-right-header">
                <a-icon
                        class="trigger"
                        :type="collapsed ? 'menu-unfold' : 'menu-fold'"
                        @click="()=> collapsed = !collapsed"
                />
                <a-icon
                        class="trigger debug-toggle"
                        :type="hideDebugInfo ? 'eye-invisible' : 'eye'"
                        :title="hideDebugInfo ? '显示调试信息' : '隐藏调试信息'"
                        @click="toggleDebugInfo"
                />
            </a-layout-header>
            <a-layout-content class="site-content"
            >
                <router-view></router-view>
            </a-layout-content>

        </a-layout>
    </a-layout>
</template>
<script>
    import { menuItems } from './config/menu';
    
    export default {
        data() {
            return {
                collapsed: false,
                hideDebugInfo: false,
                menuItems
            };
        },
        methods: {
            // 防抖函数
            debounce(func, delay) {
                let timeoutId;
                return function(...args) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => func.apply(this, args), delay);
                };
            },
            
            onSelectMenu({selectedKeys}) {
                // 使用防抖处理菜单切换，避免频繁路由切换
                const debouncedPush = this.debounce((path) => {
                    this.$router.push(path);
                }, 50);
                
                if (selectedKeys && selectedKeys.length) {
                    debouncedPush(selectedKeys[0]);
                }
            },
            toggleDebugInfo() {
                this.hideDebugInfo = !this.hideDebugInfo;
                this.$root.$emit('toggle-debug-info', this.hideDebugInfo);
            }
        },
        computed: {
            selectedKeys() {
                return [this.$route.path]
            },
            visibleMenuItems() {
                return this.menuItems.filter(item => !item.hidden);
            }
        }
    }
</script>
<style lang="scss">
    #app {
        height: 100vh;

        .site-menu {
            a {
                color: rgba(255, 255, 255, 0.65);
            }
        }


        .logo {
            height: 32px;
            background: #1870d6;
            margin: 16px;
            color: #fbfff9;
            text-align: center;
            line-height: 32px;
            border-radius: 5px;
        }

        .site-right {
            position: relative;
            height: 100vh;

        }

        .site-right-header {
            background: #fff;
            padding: 0;
            width: 100%;
            height: 64px;

            .trigger {
                font-size: 18px;
                line-height: 64px;
                padding: 0 24px;
                cursor: pointer;
                transition: color 0.3s;

                &:hover {
                    color: #1870d6;
                }
            }
            
            .debug-toggle {
                color: #999;
                
                &:hover {
                    color: #1870d6;
                }
            }
        }

        .site-content {
            height: calc(100vh - 64px);
            overflow-x: hidden;
            overflow-y: auto;
        }

        .site-footer {
            text-align: center;
        }

        .site-card {
            margin: 24px 10px 0 10px;
            padding: 24px;
            background: #fff;
            min-height: 280px
        }
    }

</style>
