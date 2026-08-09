<template>
    <div class="home" >
        <div v-html="readme" class="readme-content"></div>
    </div>
</template>

<script>
    import readme from '../../readme.md'


    export default {
        data() {
            return {
                readme,
            }
        }
    };
</script>
<style>
    .home {

        display: flex;
        justify-content: center;
        flex-direction: column;
        padding: 20px;
    }
    
    .readme-content {
        max-width: 900px;
        margin: 0 auto;
        line-height: 1.8;
    }
    
    .readme-content h2 {
        margin-top: 24px;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e8e8e8;
        color: #1890ff;
    }
    
    .readme-content h3 {
        margin-top: 20px;
        margin-bottom: 12px;
        color: #52c41a;
        font-size: 16px;
    }
    
    .readme-content ul {
        list-style: none;
        padding-left: 0;
    }
    
    .readme-content li {
        margin-bottom: 8px;
        padding-left: 20px;
        position: relative;
    }
    
    .readme-content li::before {
        content: '•';
        position: absolute;
        left: 0;
        color: #1890ff;
    }
    
    .readme-content a {
        color: #1890ff;
        text-decoration: none;
        transition: color 0.3s;
    }
    
    .readme-content a:hover {
        color: #40a9ff;
        text-decoration: underline;
    }
</style>
