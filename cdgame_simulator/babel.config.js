module.exports = {
  presets: [
    '@vue/cli-plugin-babel/preset'
  ],
  plugins: [
    // antd-vue 按需引入：只打包用到的组件 + 对应编译好的 css（替代全量 antd.css 463KB）
    ['import', {
      libraryName: 'ant-design-vue',
      libraryDirectory: 'es',
      style: true,
    }, 'ant-design-vue']
  ]
}
