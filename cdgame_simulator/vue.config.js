// vue.config.js
const webpack = require('webpack');

module.exports = {
    devServer: {
        port: 8080,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    outputDir: 'docs',
    publicPath: '/cdgame_simulator/',
    // 关闭生产 sourcemap：每次发布白送 12.6MB .map，且 GitHub Pages 不支持自动解压
    productionSourceMap: false,
    css: {
        loaderOptions: {
            less: {
                // antd 的 less 用到内联 JS（bezierEasing.less），less-loader v5 需顶层 javascriptEnabled
                javascriptEnabled: true,
            },
        },
    },
    configureWebpack: {
        plugins: [
            // 只保留 zh-cn 语言包，剔除 moment 全量 locale（约数百 KB）
            new webpack.ContextReplacementPlugin(/moment[/\\]locale$/, /zh-cn/),
        ],
    },
    chainWebpack: config => {
        // GraphQL Loader
        config.module
            .rule('markdown')
            .test(/\.md$/)
            .use('html-loader')
            .loader('html-loader')
            .end()
            .use('markdown-loader')
            .loader('markdown-loader')
            .end();
    }
}
