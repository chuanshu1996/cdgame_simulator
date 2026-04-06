// vue.config.js
module.exports = {
    devServer: {
        port: 8080
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
