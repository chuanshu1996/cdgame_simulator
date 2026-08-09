// vue.config.js
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
