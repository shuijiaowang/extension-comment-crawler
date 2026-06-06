<script setup>
</script>

<template>
    <div class="records-page">
        <header class="header">
            <h1>爬取记录</h1>
            <p class="subtitle">独立全屏页已打开成功</p>
        </header>
        <main class="main">
            <p class="placeholder">后续可在此查看、整理并导出爬取记录。</p>
        </main>
    </div>
</template>

<style scoped>
.records-page {
    min-height: 100vh;
    color: #e8e8ed;
    background: #18181c;
}

.header {
    padding: 32px 40px 24px;
    border-bottom: 1px solid #2a2a32;
}

h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
}

.subtitle {
    margin: 8px 0 0;
    font-size: 0.9rem;
    color: #888894;
}

.main {
    padding: 32px 40px;
}

.placeholder {
    margin: 0;
    font-size: 0.95rem;
    color: #a8a8b3;
}
</style>
