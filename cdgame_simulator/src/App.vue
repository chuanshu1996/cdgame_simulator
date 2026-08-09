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
                <div class="header-left">
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
                </div>
                <div class="header-right">
                    <a-button v-if="!isAdminLoggedIn" type="link" class="admin-btn" @click="showAdminLoginModal">
                        <a-icon type="user" />管理员登录
                    </a-button>
                    <a-button v-else type="link" class="admin-btn" @click="adminLogout">
                        <a-icon type="logout" />管理员登出
                    </a-button>
                </div>
            </a-layout-header>
            <a-layout-content class="site-content"
            >
                <router-view></router-view>
            </a-layout-content>

        </a-layout>
        
        <a-modal 
            v-model="adminLoginModalVisible" 
            title="管理员登录" 
            @ok="verifyAdminPassword" 
            @cancel="closeAdminLoginModal"
            :maskClosable="false"
            okText="登录"
            cancelText="取消">
            <a-input-password 
                v-model="adminPassword" 
                placeholder="请输入管理员密码" 
                @pressEnter="verifyAdminPassword"
                ref="adminPasswordInput" />
            <p v-if="adminPasswordError" class="error-text">{{ adminPasswordError }}</p>
        </a-modal>
    </a-layout>
</template>
<script>
    import { menuItems } from './config/menu';
    import { mapState } from 'vuex';
    
    export default {
        data() {
            return {
                collapsed: false,
                hideDebugInfo: false,
                menuItems,
                adminLoginModalVisible: false,
                adminPassword: '',
                adminPasswordError: '',
            };
        },
        computed: {
            ...mapState(['isAdminLoggedIn']),
            selectedKeys() {
                return [this.$route.path]
            },
            visibleMenuItems() {
                return this.menuItems.filter(item => {
                    if (item.hidden) return false;
                    if (item.adminOnly && !this.isAdminLoggedIn) return false;
                    return true;
                });
            }
        },
        methods: {
            debounce(func, delay) {
                let timeoutId;
                return function(...args) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => func.apply(this, args), delay);
                };
            },
            
            onSelectMenu({selectedKeys}) {
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
            },
            showAdminLoginModal() {
                this.adminLoginModalVisible = true;
                this.adminPassword = '';
                this.adminPasswordError = '';
                this.$nextTick(() => {
                    if (this.$refs.adminPasswordInput) {
                        this.$refs.adminPasswordInput.focus();
                    }
                });
            },
            closeAdminLoginModal() {
                this.adminLoginModalVisible = false;
                this.adminPassword = '';
                this.adminPasswordError = '';
            },
            verifyAdminPassword() {
                this.$store.commit('ADMIN_LOGIN', this.adminPassword);
                if (this.isAdminLoggedIn) {
                    this.adminLoginModalVisible = false;
                    this.adminPasswordError = '';
                    this.$message.success('管理员登录成功');
                } else {
                    this.adminPasswordError = '密码错误，请重试';
                }
            },
            adminLogout() {
                this.$store.commit('ADMIN_LOGOUT');
                this.$message.info('已退出管理员登录');
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
            display: flex;
            justify-content: space-between;
            align-items: center;

            .header-left {
                display: flex;
                align-items: center;
            }

            .header-right {
                display: flex;
                align-items: center;
                padding-right: 16px;
            }

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

            .admin-btn {
                color: #666;
                
                &:hover {
                    color: #1890ff;
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

    .error-text {
        color: #ff4d4f;
        margin-top: 8px;
    }
</style>
