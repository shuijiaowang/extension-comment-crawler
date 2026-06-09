<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { resolvePlatformTheme } from '@/core/config.js';
import {
    getFieldVisibilityStorage,
    getPlatformCommentFields,
    migrateLegacyFieldVisibility,
} from '@/core/comment-fields.js';
import {
    getPlatformPageMetaFields,
    getPlatformPageStatFields,
} from '@/core/page-fields.js';
import {
    PLATFORM_IDS,
    PLATFORM_LABELS,
    clearPlatformRecords,
    deleteComment,
    deleteRecord,
    getPlatformRecordsStorage,
    updateComment,
} from '@/core/records.js';

const activePlatform = ref('bilibili');
const records = ref([]);
const expandedRecordId = ref(null);
const editing = ref(null);
const editForm = reactive({});
const fieldVisibility = reactive({});
/** @type {import('vue').Ref<(() => void) | null>} */
const unwatchRef = ref(null);

const commentFields = computed(() => getPlatformCommentFields(activePlatform.value));
const pageMetaFields = computed(() => getPlatformPageMetaFields(activePlatform.value));
const pageStatFields = computed(() => getPlatformPageStatFields(activePlatform.value));

const isFieldVisible = (key) => fieldVisibility[key] === true;

const loadFieldVisibility = async (platformId) => {
    const fields = getPlatformCommentFields(platformId);
    const saved = await getFieldVisibilityStorage(platformId).getValue();
    for (const key of Object.keys(fieldVisibility)) {
        if (!fields.some((f) => f.key === key)) {
            delete fieldVisibility[key];
        }
    }
    for (const f of fields) {
        fieldVisibility[f.key] = saved[f.key] ?? true;
    }
};

const platformTheme = computed(() => resolvePlatformTheme(`${activePlatform.value}.com`));
const platformThemeStyle = computed(() => ({
    '--accent': platformTheme.value.primary,
    '--accent-hover': platformTheme.value.primaryHover,
    '--accent-rgb': platformTheme.value.primaryRgb,
}));
const totalComments = computed(() =>
    records.value.reduce((sum, r) => sum + (r.commentCount ?? r.comments?.length ?? 0), 0),
);

const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('zh-CN');
};

/** @param {string} picture */
const pictureUrls = (picture) =>
    String(picture || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s));

/** @param {import('@/core/page-fields.js').PageFieldDef} field @param {string} value */
const formatPageFieldValue = (field, value) => `${value}${field.suffix ?? ''}`;

/** @param {import('@/core/records.js').CrawlRecord} record */
const hasPageInfo = (record) => {
    const info = record.pageInfo;
    if (!info) return false;
    return Boolean(
        info.videoTitle ||
            info.coverPic ||
            info.authorName ||
            info.bvid ||
            pageMetaFields.value.some((f) => info[f.key]) ||
            pageStatFields.value.some((f) => info[f.key]),
    );
};

const loadRecords = async () => {
    const list = await getPlatformRecordsStorage(activePlatform.value).getValue();
    records.value = [...list];
};

const setupWatch = () => {
    unwatchRef.value?.();
    unwatchRef.value = getPlatformRecordsStorage(activePlatform.value).watch((newVal) => {
        records.value = [...newVal];
    });
};

const switchPlatform = async (id) => {
    activePlatform.value = id;
    expandedRecordId.value = null;
    editing.value = null;
    await loadFieldVisibility(id);
    await loadRecords();
    setupWatch();
};

const toggleRecord = (recordId) => {
    expandedRecordId.value = expandedRecordId.value === recordId ? null : recordId;
};

const onDeleteRecord = async (recordId) => {
    if (!confirm('确定删除这条爬取记录？')) return;
    records.value = await deleteRecord(activePlatform.value, recordId);
    if (expandedRecordId.value === recordId) expandedRecordId.value = null;
};

const onClearPlatform = async () => {
    const label = PLATFORM_LABELS[activePlatform.value];
    if (!confirm(`确定清空「${label}」的全部爬取记录？此操作不可恢复。`)) return;
    await clearPlatformRecords(activePlatform.value);
    records.value = [];
    expandedRecordId.value = null;
};

/** @param {Record<string, unknown>} comment */
const filterCommentForExport = (comment) => {
    /** @type {Record<string, unknown>} */
    const filtered = {};
    for (const f of commentFields.value) {
        if (fieldVisibility[f.key]) {
            filtered[f.key] = comment[f.key] ?? '';
        }
    }
    if (comment.replies?.length) {
        filtered.replies = comment.replies.map(filterCommentForExport);
    }
    return filtered;
};

/** @param {import('@/core/records.js').CrawlRecord} record */
const filterRecordForExport = (record) => ({
    id: record.id,
    url: record.url,
    title: record.title,
    crawledAt: record.crawledAt,
    commentCount: record.commentCount ?? record.comments?.length ?? 0,
    comments: (record.comments ?? []).map(filterCommentForExport),
});

/** @param {string} content @param {string} filename @param {string} mimeType */
const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
};

/** @param {import('@/core/records.js').CrawlRecord} record */
const recordToTxt = (record) => {
    const lines = [
        `标题: ${record.title || '未命名页面'}`,
        `链接: ${record.url}`,
        `爬取时间: ${formatTime(record.crawledAt)}`,
        `评论数: ${record.commentCount ?? record.comments?.length ?? 0}`,
    ];
    lines.push('');

    /** @param {Record<string, unknown>} comment @param {string} [indent] */
    const appendCommentLines = (comment, indent = '') => {
        for (const f of commentFields.value) {
            if (!fieldVisibility[f.key]) continue;
            const val = comment[f.key];
            if (val != null && val !== '') {
                lines.push(`${indent}${f.label}: ${val}`);
            }
        }
    };

    record.comments?.forEach((comment, i) => {
        lines.push(`======== 评论 ${i + 1} ========`);
        appendCommentLines(comment);
        comment.replies?.forEach((reply, ri) => {
            lines.push(`--- 回复 ${ri + 1} ---`);
            appendCommentLines(reply, '  ');
        });
        lines.push('');
    });

    return lines.join('\n');
};

const onExport = () => {
    const data = records.value.map(filterRecordForExport);
    downloadFile(
        JSON.stringify(data, null, 2),
        `crawl-records-${activePlatform.value}-${Date.now()}.json`,
        'application/json',
    );
};

/** @param {import('@/core/records.js').CrawlRecord} record @param {'json' | 'txt'} format */
const onExportRecord = (record, format) => {
    const stamp = Date.now();
    const base = `crawl-${activePlatform.value}-${record.id.slice(0, 8)}-${stamp}`;
    if (format === 'json') {
        downloadFile(
            JSON.stringify(filterRecordForExport(record), null, 2),
            `${base}.json`,
            'application/json',
        );
    } else {
        downloadFile(recordToTxt(record), `${base}.txt`, 'text/plain;charset=utf-8');
    }
};

const openEdit = (recordId, commentIndex, comment, replyIndex = null) => {
    editing.value = { recordId, commentIndex, replyIndex };
    for (const f of commentFields.value) {
        editForm[f.key] = comment[f.key] ?? '';
    }
};

const closeEdit = () => {
    editing.value = null;
};

const saveEdit = async () => {
    if (!editing.value) return;
    const { recordId, commentIndex, replyIndex } = editing.value;
    const patch = {};
    for (const f of commentFields.value) {
        patch[f.key] = editForm[f.key];
    }

    if (replyIndex != null) {
        const record = records.value.find((r) => r.id === recordId);
        const replies = [...(record?.comments[commentIndex]?.replies ?? [])];
        replies[replyIndex] = { ...replies[replyIndex], ...patch };
        records.value = await updateComment(activePlatform.value, recordId, commentIndex, {
            replies,
        });
    } else {
        records.value = await updateComment(
            activePlatform.value,
            recordId,
            commentIndex,
            patch,
        );
    }
    closeEdit();
};

const onDeleteComment = async (recordId, commentIndex, replyIndex = null) => {
    const label = replyIndex != null ? '这条回复' : '这条评论';
    if (!confirm(`确定删除${label}？`)) return;
    records.value = await deleteComment(
        activePlatform.value,
        recordId,
        commentIndex,
        replyIndex ?? undefined,
    );
};

onMounted(async () => {
    await migrateLegacyFieldVisibility();
    await loadFieldVisibility(activePlatform.value);
    await loadRecords();
    setupWatch();
});

watch(
    fieldVisibility,
    () => {
        getFieldVisibilityStorage(activePlatform.value).setValue({ ...fieldVisibility });
    },
    { deep: true },
);

onUnmounted(() => {
    unwatchRef.value?.();
});
</script>

<template>
    <div class="records-page" :style="platformThemeStyle">
        <header class="header">
            <div class="header-row">
                <div>
                    <h1>爬取记录</h1>
                    <p class="subtitle">
                        共 {{ records.length }} 次爬取，{{ totalComments }} 条一级评论
                    </p>
                </div>
                <div class="header-actions">
                    <button type="button" class="btn secondary" @click="onExport">导出 JSON</button>
                    <button type="button" class="btn danger" @click="onClearPlatform">
                        清空当前平台
                    </button>
                </div>
            </div>
            <nav class="platform-tabs">
                <button
                    v-for="id in PLATFORM_IDS"
                    :key="id"
                    type="button"
                    class="tab"
                    :class="{ active: activePlatform === id }"
                    @click="switchPlatform(id)"
                >
                    {{ PLATFORM_LABELS[id] }}
                    <span v-if="activePlatform === id" class="tab-count">{{ records.length }}</span>
                </button>
            </nav>
            <div class="field-filter">
                <span class="field-filter-label">显示 / 导出字段</span>
                <label v-for="f in commentFields" :key="f.key" class="field-checkbox">
                    <input v-model="fieldVisibility[f.key]" type="checkbox" />
                    <span>{{ f.label }}</span>
                </label>
            </div>
        </header>

        <main class="main">
            <p v-if="!records.length" class="empty">暂无记录，在对应网站完成爬取后会自动保存到这里。</p>

            <article v-for="record in records" :key="record.id" class="record-card">
                <div class="record-head" @click="toggleRecord(record.id)">
                    <div class="record-meta">
                        <h2 class="record-title">{{ record.title || '未命名页面' }}</h2>
                        <p class="record-url">
                            <a :href="record.url" target="_blank" rel="noopener" @click.stop>{{
                                record.url
                            }}</a>
                        </p>
                        <p class="record-info">
                            <span>{{ formatTime(record.crawledAt) }}</span>
                            <span>{{ record.commentCount ?? record.comments?.length ?? 0 }} 条评论</span>
                        </p>
                        <div
                            v-if="hasPageInfo(record)"
                            class="video-summary"
                            @click.stop
                        >
                            <img
                                v-if="record.pageInfo.coverPic"
                                class="video-cover"
                                :src="record.pageInfo.coverPic"
                                alt="封面"
                                loading="lazy"
                            />
                            <div class="video-summary-body">
                                <div
                                    v-if="record.pageInfo.authorName || record.pageInfo.authorAvatar"
                                    class="video-author"
                                >
                                    <img
                                        v-if="record.pageInfo.authorAvatar"
                                        class="author-avatar"
                                        :src="record.pageInfo.authorAvatar"
                                        alt=""
                                        loading="lazy"
                                    />
                                    <div class="author-text">
                                        <a
                                            v-if="record.pageInfo.authorLink"
                                            class="author-name"
                                            :href="record.pageInfo.authorLink"
                                            target="_blank"
                                            rel="noopener"
                                        >{{ record.pageInfo.authorName || record.pageInfo.authorId }}</a>
                                        <span v-else class="author-name">{{
                                            record.pageInfo.authorName || record.pageInfo.authorId
                                        }}</span>
                                        <span v-if="record.pageInfo.authorId" class="author-id"
                                            >mid {{ record.pageInfo.authorId }}</span
                                        >
                                    </div>
                                </div>
                                <p v-if="record.pageInfo.videoTitle" class="video-title">
                                    {{ record.pageInfo.videoTitle }}
                                </p>
                                <p
                                    v-if="record.pageInfo.bvid || record.pageInfo.avid || record.pageInfo.category"
                                    class="video-ids"
                                >
                                    <span v-if="record.pageInfo.bvid">{{ record.pageInfo.bvid }}</span>
                                    <span v-if="record.pageInfo.avid">av{{ record.pageInfo.avid }}</span>
                                    <span v-if="record.pageInfo.category">{{ record.pageInfo.category }}</span>
                                </p>
                                <p v-if="pageMetaFields.some((f) => record.pageInfo[f.key])" class="video-meta">
                                    <span
                                        v-for="f in pageMetaFields"
                                        :key="f.key"
                                        v-show="record.pageInfo[f.key]"
                                    >{{ f.label }} {{ formatPageFieldValue(f, record.pageInfo[f.key]) }}</span>
                                </p>
                                <p v-if="pageStatFields.some((f) => record.pageInfo[f.key])" class="video-stats">
                                    <span
                                        v-for="f in pageStatFields"
                                        :key="f.key"
                                        v-show="record.pageInfo[f.key]"
                                    >{{ f.label }} {{ record.pageInfo[f.key] }}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="record-actions" @click.stop>
                        <button
                            type="button"
                            class="btn sm"
                            title="导出为 JSON（仅含已选字段）"
                            @click="onExportRecord(record, 'json')"
                        >
                            JSON
                        </button>
                        <button
                            type="button"
                            class="btn sm"
                            title="导出为 TXT（仅含已选字段）"
                            @click="onExportRecord(record, 'txt')"
                        >
                            TXT
                        </button>
                        <button
                            type="button"
                            class="btn icon"
                            :title="expandedRecordId === record.id ? '收起' : '展开'"
                            @click="toggleRecord(record.id)"
                        >
                            {{ expandedRecordId === record.id ? '▾' : '▸' }}
                        </button>
                        <button
                            type="button"
                            class="btn icon danger"
                            title="删除记录"
                            @click="onDeleteRecord(record.id)"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div v-if="expandedRecordId === record.id" class="comments-panel">
                    <div
                        v-for="(comment, ci) in record.comments"
                        :key="ci"
                        class="comment-block"
                    >
                        <div class="comment-row">
                            <div class="comment-main">
                                <div class="comment-header">
                                    <strong v-if="isFieldVisible('userName')">{{
                                        comment.userName || '匿名'
                                    }}</strong>
                                    <span
                                        v-if="isFieldVisible('userId') && comment.userId"
                                        class="muted"
                                    >ID: {{ comment.userId }}</span>
                                    <a
                                        v-if="isFieldVisible('userLink') && comment.userLink"
                                        class="user-link"
                                        :href="comment.userLink"
                                        target="_blank"
                                        rel="noopener"
                                        @click.stop
                                    >主页</a>
                                    <span
                                        v-if="isFieldVisible('isAuthor') && comment.isAuthor"
                                        class="badge"
                                    >{{ comment.isAuthor }}</span>
                                    <span
                                        v-if="isFieldVisible('tag') && comment.tag"
                                        class="badge tag"
                                    >{{ comment.tag }}</span>
                                    <span
                                        v-if="isFieldVisible('vip') && comment.vip"
                                        class="badge"
                                    >{{ comment.vip }}</span>
                                    <span
                                        v-if="isFieldVisible('level') && comment.level"
                                        class="badge"
                                    >{{ comment.level }}</span>
                                    <span v-if="isFieldVisible('time')" class="muted">{{
                                        comment.time
                                    }}</span>
                                    <span
                                        v-if="isFieldVisible('location') && comment.location"
                                        class="muted"
                                    >{{ comment.location }}</span>
                                    <span v-if="isFieldVisible('like')" class="like"
                                        >♥ {{ comment.like }}</span
                                    >
                                </div>
                                <p v-if="isFieldVisible('content')" class="comment-content">
                                    {{ comment.content }}
                                </p>
                                <p
                                    v-if="isFieldVisible('picture') && pictureUrls(comment.picture).length"
                                    class="comment-pictures"
                                >
                                    <a
                                        v-for="(img, pi) in pictureUrls(comment.picture)"
                                        :key="pi"
                                        class="picture-link"
                                        :href="img"
                                        target="_blank"
                                        rel="noopener"
                                    >{{ img }}</a>
                                </p>
                            </div>
                            <div class="comment-actions">
                                <button
                                    type="button"
                                    class="btn sm"
                                    @click="openEdit(record.id, ci, comment)"
                                >
                                    编辑
                                </button>
                                <button
                                    type="button"
                                    class="btn sm danger"
                                    @click="onDeleteComment(record.id, ci)"
                                >
                                    删除
                                </button>
                            </div>
                        </div>

                        <div v-if="comment.replies?.length" class="replies">
                            <div
                                v-for="(reply, ri) in comment.replies"
                                :key="ri"
                                class="comment-row reply-row"
                            >
                                <div class="comment-main">
                                    <div class="comment-header">
                                        <strong v-if="isFieldVisible('userName')">{{
                                            reply.userName || '匿名'
                                        }}</strong>
                                        <span
                                            v-if="isFieldVisible('userId') && reply.userId"
                                            class="muted"
                                        >ID: {{ reply.userId }}</span>
                                        <a
                                            v-if="isFieldVisible('userLink') && reply.userLink"
                                            class="user-link"
                                            :href="reply.userLink"
                                            target="_blank"
                                            rel="noopener"
                                            @click.stop
                                        >主页</a>
                                        <span
                                            v-if="isFieldVisible('tag') && reply.tag"
                                            class="badge tag"
                                        >{{ reply.tag }}</span>
                                        <span
                                            v-if="isFieldVisible('vip') && reply.vip"
                                            class="badge"
                                        >{{ reply.vip }}</span>
                                        <span
                                            v-if="isFieldVisible('level') && reply.level"
                                            class="badge"
                                        >{{ reply.level }}</span>
                                        <span v-if="isFieldVisible('time')" class="muted">{{
                                            reply.time
                                        }}</span>
                                        <span
                                            v-if="isFieldVisible('location') && reply.location"
                                            class="muted"
                                        >{{ reply.location }}</span>
                                        <span v-if="isFieldVisible('like')" class="like"
                                            >♥ {{ reply.like }}</span
                                        >
                                    </div>
                                    <p v-if="isFieldVisible('content')" class="comment-content">
                                        {{ reply.content }}
                                    </p>
                                    <p
                                        v-if="isFieldVisible('picture') && pictureUrls(reply.picture).length"
                                        class="comment-pictures"
                                    >
                                        <a
                                            v-for="(img, pi) in pictureUrls(reply.picture)"
                                            :key="pi"
                                            class="picture-link"
                                            :href="img"
                                            target="_blank"
                                            rel="noopener"
                                        >{{ img }}</a>
                                    </p>
                                </div>
                                <div class="comment-actions">
                                    <button
                                        type="button"
                                        class="btn sm"
                                        @click="openEdit(record.id, ci, reply, ri)"
                                    >
                                        编辑
                                    </button>
                                    <button
                                        type="button"
                                        class="btn sm danger"
                                        @click="onDeleteComment(record.id, ci, ri)"
                                    >
                                        删除
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        </main>

        <div v-if="editing" class="modal-overlay" @click.self="closeEdit">
            <div class="modal">
                <h3>{{ editing.replyIndex != null ? '编辑回复' : '编辑评论' }}</h3>
                <form class="edit-form" @submit.prevent="saveEdit">
                    <label v-for="f in commentFields" :key="f.key" class="field">
                        <span>{{ f.label }}</span>
                        <textarea
                            v-if="f.textarea"
                            v-model="editForm[f.key]"
                            rows="3"
                        />
                        <input v-else v-model="editForm[f.key]" type="text" />
                    </label>
                    <div class="modal-actions">
                        <button type="button" class="btn secondary" @click="closeEdit">取消</button>
                        <button type="submit" class="btn primary">保存</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<style scoped>
.records-page {
    min-height: 100vh;
    color: #e8e8ed;
    background: #18181c;
}

.header {
    padding: 28px 40px 0;
    border-bottom: 1px solid #2a2a32;
}

.header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
}

h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
}

.subtitle {
    margin: 6px 0 0;
    font-size: 0.88rem;
    color: #888894;
}

.header-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
}

.platform-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: -1px;
}

.tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    font-size: 0.85rem;
    color: #888894;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
}

.tab:hover {
    color: #c4c4ce;
}

.tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
}

.tab-count {
    padding: 1px 6px;
    font-size: 0.72rem;
    color: var(--accent);
    background: rgb(var(--accent-rgb) / 12%);
    border-radius: 999px;
}

.field-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    padding: 14px 0 16px;
}

.field-filter-label {
    flex-shrink: 0;
    font-size: 0.78rem;
    font-weight: 500;
    color: #888894;
}

.field-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    color: #a8a8b3;
    cursor: pointer;
    user-select: none;
}

.field-checkbox input {
    accent-color: var(--accent);
    cursor: pointer;
}

.user-link {
    font-size: 0.75rem;
    color: var(--accent);
    text-decoration: none;
}

.user-link:hover {
    text-decoration: underline;
}

.main {
    padding: 24px 40px 48px;
    max-width: 960px;
}

.empty {
    margin: 0;
    padding: 48px 0;
    text-align: center;
    color: #888894;
}

.record-card {
    margin-bottom: 12px;
    background: #222228;
    border: 1px solid #2a2a32;
    border-radius: 10px;
    overflow: hidden;
}

.record-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    cursor: pointer;
    transition: background 0.15s;
}

.record-head:hover {
    background: #28282f;
}

.record-title {
    margin: 0 0 4px;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.4;
}

.record-url {
    margin: 0 0 6px;
    font-size: 0.78rem;
    line-height: 1.4;
    word-break: break-all;
}

.record-url a {
    color: #888894;
    text-decoration: none;
}

.record-url a:hover {
    color: var(--accent);
}

.record-info {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 0;
    font-size: 0.78rem;
    color: #6b6b78;
}

.video-summary {
    display: flex;
    gap: 12px;
    margin: 10px 0 0;
    padding: 10px 12px;
    font-size: 0.78rem;
    background: #1f1f26;
    border-radius: 8px;
}

.video-cover {
    flex-shrink: 0;
    width: 120px;
    height: 68px;
    object-fit: cover;
    border-radius: 6px;
    background: #2a2a32;
}

.video-summary-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.video-author {
    display: flex;
    align-items: center;
    gap: 8px;
}

.author-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    background: #2a2a32;
}

.author-text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
}

.author-name {
    color: #e8e8ee;
    font-weight: 500;
    text-decoration: none;
}

a.author-name:hover {
    color: var(--accent);
}

.author-id {
    color: #6b6b78;
    font-size: 0.72rem;
}

.video-title {
    margin: 0;
    color: #c4c4ce;
    line-height: 1.4;
    word-break: break-word;
}

.video-ids,
.video-meta,
.video-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 0;
    color: #888894;
    line-height: 1.4;
}

.video-stats {
    color: #a8a8b4;
}

.record-actions {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
}

.comments-panel {
    padding: 0 16px 14px;
    border-top: 1px solid #2a2a32;
}

.comment-block {
    padding: 12px 0;
    border-bottom: 1px solid #2a2a32;
}

.comment-block:last-child {
    border-bottom: none;
}

.comment-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.comment-main {
    flex: 1;
    min-width: 0;
}

.comment-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 0.8rem;
}

.comment-header strong {
    color: #e8e8ed;
}

.muted {
    color: #6b6b78;
}

.like {
    color: #888894;
}

.badge {
    padding: 1px 6px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--accent);
    background: rgb(var(--accent-rgb) / 12%);
    border-radius: 4px;
}

.badge.tag {
    color: #ffb86c;
    background: rgb(255 184 108 / 12%);
}

.comment-content {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: #c4c4ce;
    white-space: pre-wrap;
    word-break: break-word;
}

.comment-pictures {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 4px 0 0;
    font-size: 0.78rem;
}

.picture-link {
    color: var(--accent);
    text-decoration: none;
    word-break: break-all;
}

.picture-link:hover {
    text-decoration: underline;
}

.comment-actions {
    display: flex;
    flex-shrink: 0;
    gap: 4px;
}

.replies {
    margin-top: 8px;
    padding-left: 16px;
    border-left: 2px solid #36363f;
}

.reply-row {
    padding: 8px 0;
}

.btn {
    padding: 8px 14px;
    font-size: 0.82rem;
    font-weight: 500;
    color: #c4c4ce;
    background: #2a2a32;
    border: 1px solid #36363f;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.btn:hover {
    background: #36363f;
}

.btn.primary {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
}

.btn.primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
}

.btn.secondary {
    background: #222228;
}

.btn.danger {
    color: #ffb4b4;
    border-color: rgb(255 80 80 / 25%);
}

.btn.danger:hover {
    background: rgb(255 80 80 / 10%);
}

.btn.sm {
    padding: 4px 10px;
    font-size: 0.75rem;
}

.btn.icon {
    width: 32px;
    height: 32px;
    padding: 0;
    font-size: 0.9rem;
    line-height: 1;
}

.modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgb(0 0 0 / 55%);
}

.modal {
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    overflow-y: auto;
    padding: 20px;
    background: #222228;
    border: 1px solid #36363f;
    border-radius: 12px;
}

.modal h3 {
    margin: 0 0 16px;
    font-size: 1rem;
}

.edit-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
    color: #a8a8b3;
}

.field input,
.field textarea {
    padding: 8px 10px;
    font-size: 0.85rem;
    color: #e8e8ed;
    background: #18181c;
    border: 1px solid #36363f;
    border-radius: 8px;
    outline: none;
    resize: vertical;
}

.field input:focus,
.field textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgb(var(--accent-rgb) / 18%);
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
}
</style>
