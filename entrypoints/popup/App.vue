<script setup>
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfigStore } from '@/pinia/config.js';

const store = useConfigStore();
const { hostname, tabError, domainConfig } = storeToRefs(store);
const crawling = ref(false);

onMounted(() => {
    store.loadActiveTabConfig();
});

const onSave = () => store.saveConfig();

const onStartCrawl = async () => {
    if (crawling.value) return;
    crawling.value = true;
    try {
        await store.startCrawl();
    } catch (e) {
        tabError.value = e?.message ?? '发送失败，请确认已在 B 站页面且已刷新';
    } finally {
        crawling.value = false;
    }
};
</script>

<template>
    <div class="popup">
        <header class="header">
            <div class="header-top">
                <h1>评论爬取</h1>
                <span v-if="hostname && !tabError" class="host-badge">{{ hostname }}</span>
            </div>
            <p v-if="tabError" class="banner error">{{ tabError }}</p>
            <p v-else class="hint">在视频页打开 popup，保存配置后点击开始爬取</p>
        </header>

        <form class="form" @submit.prevent>
            <section class="section">
                <h2 class="section-title">采集范围</h2>
                <div class="field">
                    <label for="commentLimit">评论数量上限</label>
                    <input
                        id="commentLimit"
                        v-model.number="domainConfig.commentLimit"
                        type="number"
                        min="1"
                    />
                </div>
                <div class="field">
                    <label for="replyPages">二级评论分页数</label>
                    <input
                        id="replyPages"
                        v-model.number="domainConfig.commentReplisePageSizeLimit"
                        type="number"
                        min="0"
                    />
                </div>
                <label class="toggle">
                    <input v-model="domainConfig.crawlReplies" type="checkbox" />
                    <span class="toggle-track" aria-hidden="true" />
                    <span class="toggle-label">爬取二级评论（展开「查看全部」）</span>
                </label>
            </section>

            <section class="section">
                <h2 class="section-title">速率与滚动</h2>
                <div class="field-row">
                    <div class="field">
                        <label for="delayMin">休眠最小 (ms)</label>
                        <input
                            id="delayMin"
                            v-model.number="domainConfig.delayMin"
                            type="number"
                            min="0"
                        />
                    </div>
                    <div class="field">
                        <label for="delayMax">休眠最大 (ms)</label>
                        <input
                            id="delayMax"
                            v-model.number="domainConfig.delayMax"
                            type="number"
                            min="0"
                        />
                    </div>
                </div>
                <div class="field">
                    <label for="scrollStep">滚动步长 (px)</label>
                    <input
                        id="scrollStep"
                        v-model.number="domainConfig.scrollStep"
                        type="number"
                        min="0"
                    />
                </div>
            </section>
        </form>

        <footer class="actions">
            <button type="button" class="btn secondary" @click="onSave">保存配置</button>
            <button
                type="button"
                class="btn primary"
                :disabled="!!tabError || crawling"
                @click="onStartCrawl"
            >
                {{ crawling ? '爬取中…' : '开始爬取' }}
            </button>
        </footer>
    </div>
</template>

<style scoped>
.popup {
    width: 340px;
    padding: 0;
    color: #e8e8ed;
    background: #18181c;
}

.header {
    padding: 16px 16px 12px;
    border-bottom: 1px solid #2a2a32;
}

.header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

h1 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.host-badge {
    flex-shrink: 0;
    padding: 2px 8px;
    font-size: 0.7rem;
    font-weight: 500;
    color: #fb7299;
    background: rgb(251 114 153 / 12%);
    border: 1px solid rgb(251 114 153 / 25%);
    border-radius: 999px;
}

.hint {
    margin: 8px 0 0;
    font-size: 0.75rem;
    line-height: 1.4;
    color: #888894;
}

.banner {
    margin: 10px 0 0;
    padding: 8px 10px;
    font-size: 0.78rem;
    line-height: 1.4;
    border-radius: 8px;
}

.banner.error {
    color: #ffb4b4;
    background: rgb(255 80 80 / 10%);
    border: 1px solid rgb(255 80 80 / 20%);
}

.form {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.section {
    padding: 14px 16px;
    border-bottom: 1px solid #2a2a32;
}

.section-title {
    margin: 0 0 12px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b6b78;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 12px;
}

.field:last-child {
    margin-bottom: 0;
}

.field label {
    font-size: 0.8rem;
    color: #a8a8b3;
}

.field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 12px;
}

.field-row .field {
    margin-bottom: 0;
}

input[type='number'] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 0.85rem;
    color: #e8e8ed;
    background: #222228;
    border: 1px solid #36363f;
    border-radius: 8px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
}

input[type='number']:focus {
    border-color: #fb7299;
    box-shadow: 0 0 0 2px rgb(251 114 153 / 18%);
}

.toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 4px;
    cursor: pointer;
    user-select: none;
}

.toggle input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}

.toggle-track {
    position: relative;
    flex-shrink: 0;
    width: 36px;
    height: 20px;
    background: #36363f;
    border-radius: 999px;
    transition: background 0.2s;
}

.toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: #e8e8ed;
    border-radius: 50%;
    transition: transform 0.2s;
}

.toggle input:checked + .toggle-track {
    background: #fb7299;
}

.toggle input:checked + .toggle-track::after {
    transform: translateX(16px);
}

.toggle input:focus-visible + .toggle-track {
    box-shadow: 0 0 0 2px rgb(251 114 153 / 35%);
}

.toggle-label {
    font-size: 0.8rem;
    line-height: 1.35;
    color: #c4c4ce;
}

.actions {
    display: flex;
    gap: 10px;
    padding: 14px 16px 16px;
}

.btn {
    flex: 1;
    padding: 10px 14px;
    font-size: 0.85rem;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}

.btn.secondary {
    color: #c4c4ce;
    background: #222228;
    border-color: #36363f;
}

.btn.secondary:hover {
    background: #2a2a32;
    border-color: #45454f;
}

.btn.primary {
    color: #fff;
    background: #fb7299;
    border-color: #fb7299;
}

.btn.primary:hover:not(:disabled) {
    background: #ff85a8;
    border-color: #ff85a8;
}

.btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}
</style>
