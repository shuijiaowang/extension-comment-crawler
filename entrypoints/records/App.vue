<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { resolvePlatformTheme } from '@/core/config.js';
import {
    getFieldVisibilityStorage,
    getPlatformCommentFields,
    migrateLegacyFieldVisibility,
} from '@/core/comment-fields.js';
import {
    formatRecordFieldValue,
    getAuthorFieldVisibilityStorage,
    getPlatformAuthorFields,
    getPlatformVideoFields,
    getVideoFieldVisibilityStorage,
    resolveRecordMeta,
} from '@/core/record-fields.js';
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
/** @type {import('vue').Ref<Set<string>>} */
const expandedMetaSections = ref(new Set());
const editing = ref(null);
const editForm = reactive({});
const commentFieldVisibility = reactive({});
const videoFieldVisibility = reactive({});
const authorFieldVisibility = reactive({});
/** @type {import('vue').Ref<(() => void) | null>} */
const unwatchRef = ref(null);

const commentFields = computed(() => getPlatformCommentFields(activePlatform.value));
const videoFields = computed(() => getPlatformVideoFields(activePlatform.value));
const authorFields = computed(() => getPlatformAuthorFields(activePlatform.value));

const isCommentFieldVisible = (key) => commentFieldVisibility[key] === true;
const isVideoFieldVisible = (key) => videoFieldVisibility[key] === true;
const isAuthorFieldVisible = (key) => authorFieldVisibility[key] === true;

const loadSectionVisibility = async (platformId) => {
    const [commentSaved, videoSaved, authorSaved] = await Promise.all([
        getFieldVisibilityStorage(platformId).getValue(),
        getVideoFieldVisibilityStorage(platformId).getValue(),
        getAuthorFieldVisibilityStorage(platformId).getValue(),
    ]);
    for (const key of Object.keys(commentFieldVisibility)) {
        if (!commentFields.value.some((f) => f.key === key)) delete commentFieldVisibility[key];
    }
    for (const f of commentFields.value) {
        commentFieldVisibility[f.key] = commentSaved[f.key] ?? true;
    }
    for (const key of Object.keys(videoFieldVisibility)) {
        if (!videoFields.value.some((f) => f.key === key)) delete videoFieldVisibility[key];
    }
    for (const f of videoFields.value) {
        videoFieldVisibility[f.key] = videoSaved[f.key] ?? true;
    }
    for (const key of Object.keys(authorFieldVisibility)) {
        if (!authorFields.value.some((f) => f.key === key)) delete authorFieldVisibility[key];
    }
    for (const f of authorFields.value) {
        authorFieldVisibility[f.key] = authorSaved[f.key] ?? true;
    }
};

const workSectionLabel = computed(() =>
    activePlatform.value === 'xiaohongshu' ? '作品' : '视频',
);

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

/** @param {import('@/core/records.js').CrawlRecord} record */
const getRecordMeta = (record) => resolveRecordMeta(record);

/** @param {import('@/core/records.js').CrawlRecord} record */
const hasVideoInfo = (record) => {
    const { videoInfo } = getRecordMeta(record);
    return videoFields.value.some((f) => videoInfo[f.key]);
};

/** @param {import('@/core/records.js').CrawlRecord} record */
const hasAuthorInfo = (record) => {
    const { authorInfo } = getRecordMeta(record);
    return authorFields.value.some((f) => authorInfo[f.key]);
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
    await loadSectionVisibility(id);
    await loadRecords();
    setupWatch();
};

const toggleRecord = (recordId) => {
    expandedRecordId.value = expandedRecordId.value === recordId ? null : recordId;
};

/** @param {string} recordId @param {'work' | 'author'} section */
const metaSectionKey = (recordId, section) => `${recordId}:${section}`;

/** @param {string} recordId @param {'work' | 'author'} section */
const isMetaSectionExpanded = (recordId, section) =>
    expandedMetaSections.value.has(metaSectionKey(recordId, section));

/** @param {string} recordId @param {'work' | 'author'} section */
const toggleMetaSection = (recordId, section) => {
    const key = metaSectionKey(recordId, section);
    const next = new Set(expandedMetaSections.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedMetaSections.value = next;
};

const onDeleteRecord = async (recordId) => {
    if (!confirm('确定删除这条抓取记录？')) return;
    records.value = await deleteRecord(activePlatform.value, recordId);
    if (expandedRecordId.value === recordId) expandedRecordId.value = null;
};

const onClearPlatform = async () => {
    const label = PLATFORM_LABELS[activePlatform.value];
    if (!confirm(`确定清空「${label}」的全部抓取记录？此操作不可恢复。`)) return;
    await clearPlatformRecords(activePlatform.value);
    records.value = [];
    expandedRecordId.value = null;
};

/** @param {Record<string, string>} info @param {import('@/core/record-fields.js').RecordFieldDef[]} fields @param {(key: string) => boolean} isVisible */
const filterInfoForExport = (info, fields, isVisible) => {
    /** @type {Record<string, string>} */
    const filtered = {};
    for (const f of fields) {
        if (isVisible(f.key) && info[f.key]) filtered[f.key] = info[f.key];
    }
    return filtered;
};

/** @param {Record<string, unknown>} comment */
const filterCommentForExport = (comment) => {
    /** @type {Record<string, unknown>} */
    const filtered = {};
    for (const f of commentFields.value) {
        if (isCommentFieldVisible(f.key)) {
            filtered[f.key] = comment[f.key] ?? '';
        }
    }
    if (comment.replies?.length) {
        filtered.replies = comment.replies.map(filterCommentForExport);
    }
    return filtered;
};

/** @param {import('@/core/records.js').CrawlRecord} record */
const filterRecordForExport = (record) => {
    const { videoInfo, authorInfo } = getRecordMeta(record);
    return {
        id: record.id,
        url: record.url,
        title: record.title,
        crawledAt: record.crawledAt,
        commentCount: record.commentCount ?? record.comments?.length ?? 0,
        videoInfo: filterInfoForExport(videoInfo, videoFields.value, isVideoFieldVisible),
        authorInfo: filterInfoForExport(authorInfo, authorFields.value, isAuthorFieldVisible),
        comments: (record.comments ?? []).map(filterCommentForExport),
    };
};

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
        `抓取时间: ${formatTime(record.crawledAt)}`,
        `评论数: ${record.commentCount ?? record.comments?.length ?? 0}`,
    ];
    lines.push('');

    const { videoInfo, authorInfo } = getRecordMeta(record);
    const appendInfoLines = (title, info, fields, isVisible) => {
        const entries = fields.filter((f) => isVisible(f.key) && info[f.key]);
        if (!entries.length) return;
        lines.push(`======== ${title} ========`);
        for (const f of entries) {
            lines.push(`${f.label}: ${formatRecordFieldValue(f, info[f.key])}`);
        }
        lines.push('');
    };
    appendInfoLines(`${workSectionLabel.value}信息`, videoInfo, videoFields.value, isVideoFieldVisible);
    appendInfoLines('作者信息', authorInfo, authorFields.value, isAuthorFieldVisible);

    /** @param {Record<string, unknown>} comment @param {string} [indent] */
    const appendCommentLines = (comment, indent = '') => {
        for (const f of commentFields.value) {
            if (!isCommentFieldVisible(f.key)) continue;
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
    const platformFromUrl = new URLSearchParams(location.search).get('platform');
    if (platformFromUrl && PLATFORM_IDS.includes(platformFromUrl)) {
        activePlatform.value = platformFromUrl;
    }
    await migrateLegacyFieldVisibility();
    await loadSectionVisibility(activePlatform.value);
    await loadRecords();
    setupWatch();
});

watch(
    commentFieldVisibility,
    () => {
        getFieldVisibilityStorage(activePlatform.value).setValue({ ...commentFieldVisibility });
    },
    { deep: true },
);
watch(
    videoFieldVisibility,
    () => {
        getVideoFieldVisibilityStorage(activePlatform.value).setValue({ ...videoFieldVisibility });
    },
    { deep: true },
);
watch(
    authorFieldVisibility,
    () => {
        getAuthorFieldVisibilityStorage(activePlatform.value).setValue({ ...authorFieldVisibility });
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
                    <h1>抓取记录</h1>
                    <p class="subtitle">
                        共 {{ records.length }} 次抓取，{{ totalComments }} 条一级评论
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
            <div class="field-filters">
                <div v-if="videoFields.length" class="field-filter">
                    <span class="field-filter-label">{{ workSectionLabel }} · 显示 / 导出</span>
                    <label v-for="f in videoFields" :key="f.key" class="field-checkbox">
                        <input v-model="videoFieldVisibility[f.key]" type="checkbox" />
                        <span>{{ f.label }}</span>
                    </label>
                </div>
                <div v-if="authorFields.length" class="field-filter">
                    <span class="field-filter-label">作者 · 显示 / 导出</span>
                    <label v-for="f in authorFields" :key="f.key" class="field-checkbox">
                        <input v-model="authorFieldVisibility[f.key]" type="checkbox" />
                        <span>{{ f.label }}</span>
                    </label>
                </div>
                <div class="field-filter">
                    <span class="field-filter-label">评论 · 显示 / 导出</span>
                    <label v-for="f in commentFields" :key="f.key" class="field-checkbox">
                        <input v-model="commentFieldVisibility[f.key]" type="checkbox" />
                        <span>{{ f.label }}</span>
                    </label>
                </div>
            </div>
        </header>

        <main class="main">
            <p v-if="!records.length" class="empty">暂无记录，在对应网站完成抓取后会自动保存到这里。</p>

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

                <div
                    v-if="hasVideoInfo(record) || hasAuthorInfo(record)"
                    class="meta-row"
                    @click.stop
                >
                    <section v-if="hasVideoInfo(record)" class="meta-block">
                        <h3
                            class="meta-block-title collapsible"
                            @click="toggleMetaSection(record.id, 'work')"
                        >
                            <span class="collapse-icon">{{
                                isMetaSectionExpanded(record.id, 'work') ? '▾' : '▸'
                            }}</span>
                            {{ workSectionLabel }}
                        </h3>
                        <div
                            v-show="isMetaSectionExpanded(record.id, 'work')"
                            class="meta-block-body"
                        >
                            <img
                                v-if="
                                    isVideoFieldVisible('coverPic') &&
                                    getRecordMeta(record).videoInfo.coverPic
                                "
                                class="video-cover"
                                :src="getRecordMeta(record).videoInfo.coverPic"
                                alt="封面"
                                loading="lazy"
                            />
                            <dl class="meta-fields">
                                <template v-for="f in videoFields" :key="f.key">
                                    <div
                                        v-if="
                                            isVideoFieldVisible(f.key) &&
                                            f.key !== 'coverPic' &&
                                            getRecordMeta(record).videoInfo[f.key]
                                        "
                                        class="meta-item"
                                        :class="{ 'meta-item-wide': f.multiImage }"
                                    >
                                        <dt>{{ f.label }}</dt>
                                        <dd>
                                            <div
                                                v-if="
                                                    f.multiImage &&
                                                    pictureUrls(
                                                        getRecordMeta(record).videoInfo[f.key],
                                                    ).length
                                                "
                                                class="meta-image-list"
                                            >
                                                <a
                                                    v-for="(img, pi) in pictureUrls(
                                                        getRecordMeta(record).videoInfo[f.key],
                                                    )"
                                                    :key="pi"
                                                    :href="img"
                                                    target="_blank"
                                                    rel="noopener"
                                                    :title="`图片 ${pi + 1}`"
                                                >
                                                    <img
                                                        class="meta-thumb"
                                                        :src="img"
                                                        alt=""
                                                        loading="lazy"
                                                    />
                                                </a>
                                            </div>
                                            <img
                                                v-else-if="f.image"
                                                class="meta-thumb"
                                                :src="getRecordMeta(record).videoInfo[f.key]"
                                                alt=""
                                                loading="lazy"
                                            />
                                            <a
                                                v-else-if="f.link"
                                                :href="getRecordMeta(record).videoInfo[f.key]"
                                                target="_blank"
                                                rel="noopener"
                                            >{{ getRecordMeta(record).videoInfo[f.key] }}</a>
                                            <span v-else>{{
                                                formatRecordFieldValue(
                                                    f,
                                                    getRecordMeta(record).videoInfo[f.key],
                                                )
                                            }}</span>
                                        </dd>
                                    </div>
                                </template>
                            </dl>
                        </div>
                    </section>
                    <section v-if="hasAuthorInfo(record)" class="meta-block">
                        <h3
                            class="meta-block-title collapsible"
                            @click="toggleMetaSection(record.id, 'author')"
                        >
                            <span class="collapse-icon">{{
                                isMetaSectionExpanded(record.id, 'author') ? '▾' : '▸'
                            }}</span>
                            作者
                        </h3>
                        <div
                            v-show="isMetaSectionExpanded(record.id, 'author')"
                            class="meta-block-body author-meta"
                        >
                            <img
                                v-if="
                                    isAuthorFieldVisible('authorAvatar') &&
                                    getRecordMeta(record).authorInfo.authorAvatar
                                "
                                class="author-avatar-lg"
                                :src="getRecordMeta(record).authorInfo.authorAvatar"
                                alt=""
                                loading="lazy"
                            />
                            <dl class="meta-fields">
                                <template v-for="f in authorFields" :key="f.key">
                                    <div
                                        v-if="
                                            isAuthorFieldVisible(f.key) &&
                                            f.key !== 'authorAvatar' &&
                                            getRecordMeta(record).authorInfo[f.key]
                                        "
                                        class="meta-item"
                                    >
                                        <dt>{{ f.label }}</dt>
                                        <dd>
                                            <img
                                                v-if="f.image"
                                                class="meta-thumb round"
                                                :src="getRecordMeta(record).authorInfo[f.key]"
                                                alt=""
                                                loading="lazy"
                                            />
                                            <a
                                                v-else-if="f.link"
                                                :href="getRecordMeta(record).authorInfo[f.key]"
                                                target="_blank"
                                                rel="noopener"
                                            >{{ getRecordMeta(record).authorInfo[f.key] }}</a>
                                            <span v-else>{{
                                                formatRecordFieldValue(
                                                    f,
                                                    getRecordMeta(record).authorInfo[f.key],
                                                )
                                            }}</span>
                                        </dd>
                                    </div>
                                </template>
                            </dl>
                        </div>
                    </section>
                </div>

                <div v-if="expandedRecordId === record.id" class="comments-panel">
                    <h3 class="meta-block-title comments-panel-title">评论</h3>
                    <div
                        v-for="(comment, ci) in record.comments"
                        :key="ci"
                        class="comment-block"
                    >
                        <div class="comment-row">
                            <div class="comment-main">
                                <div class="comment-header">
                                    <img
                                        v-if="
                                            isCommentFieldVisible('userAvatar') && comment.userAvatar
                                        "
                                        class="comment-avatar"
                                        :src="comment.userAvatar"
                                        alt=""
                                        loading="lazy"
                                    />
                                    <strong v-if="isCommentFieldVisible('userName')">{{
                                        comment.userName || '匿名'
                                    }}</strong>
                                    <span
                                        v-if="isCommentFieldVisible('userId') && comment.userId"
                                        class="muted"
                                    >ID: {{ comment.userId }}</span>
                                    <span
                                        v-if="isCommentFieldVisible('sex') && comment.sex"
                                        class="muted"
                                    >{{ comment.sex }}</span>
                                    <a
                                        v-if="isCommentFieldVisible('userLink') && comment.userLink"
                                        class="user-link"
                                        :href="comment.userLink"
                                        target="_blank"
                                        rel="noopener"
                                        @click.stop
                                    >主页</a>
                                    <span
                                        v-if="isCommentFieldVisible('isAuthor') && comment.isAuthor"
                                        class="badge"
                                    >{{ comment.isAuthor }}</span>
                                    <span
                                        v-if="isCommentFieldVisible('tag') && comment.tag"
                                        class="badge tag"
                                    >{{ comment.tag }}</span>
                                    <span
                                        v-if="isCommentFieldVisible('vip') && comment.vip"
                                        class="badge"
                                    >{{ comment.vip }}</span>
                                    <span
                                        v-if="isCommentFieldVisible('level') && comment.level"
                                        class="badge"
                                    >Lv{{ comment.level }}</span>
                                    <span
                                        v-if="isCommentFieldVisible('official') && comment.official"
                                        class="badge"
                                    >{{ comment.official }}</span>
                                    <span
                                        v-if="isCommentFieldVisible('nameplate') && comment.nameplate"
                                        class="badge tag"
                                    >{{ comment.nameplate }}</span>
                                    <span v-if="isCommentFieldVisible('time')" class="muted">{{
                                        comment.time
                                    }}</span>
                                    <span
                                        v-if="isCommentFieldVisible('location') && comment.location"
                                        class="muted"
                                    >{{ comment.location }}</span>
                                    <span v-if="isCommentFieldVisible('like')" class="like"
                                        >♥ {{ comment.like }}</span
                                    >
                                </div>
                                <p
                                    v-if="isCommentFieldVisible('sign') && comment.sign"
                                    class="comment-sign muted"
                                >
                                    {{ comment.sign }}
                                </p>
                                <p v-if="isCommentFieldVisible('content')" class="comment-content">
                                    {{ comment.content }}
                                </p>
                                <p
                                    v-if="isCommentFieldVisible('picture') && pictureUrls(comment.picture).length"
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
                                        <img
                                            v-if="
                                                isCommentFieldVisible('userAvatar') && reply.userAvatar
                                            "
                                            class="comment-avatar"
                                            :src="reply.userAvatar"
                                            alt=""
                                            loading="lazy"
                                        />
                                        <strong v-if="isCommentFieldVisible('userName')">{{
                                            reply.userName || '匿名'
                                        }}</strong>
                                        <span
                                            v-if="isCommentFieldVisible('userId') && reply.userId"
                                            class="muted"
                                        >ID: {{ reply.userId }}</span>
                                        <span
                                            v-if="isCommentFieldVisible('sex') && reply.sex"
                                            class="muted"
                                        >{{ reply.sex }}</span>
                                        <a
                                            v-if="isCommentFieldVisible('userLink') && reply.userLink"
                                            class="user-link"
                                            :href="reply.userLink"
                                            target="_blank"
                                            rel="noopener"
                                            @click.stop
                                        >主页</a>
                                        <span
                                            v-if="isCommentFieldVisible('isAuthor') && reply.isAuthor"
                                            class="badge"
                                        >{{ reply.isAuthor }}</span>
                                        <span
                                            v-if="isCommentFieldVisible('tag') && reply.tag"
                                            class="badge tag"
                                        >{{ reply.tag }}</span>
                                        <span
                                            v-if="isCommentFieldVisible('vip') && reply.vip"
                                            class="badge"
                                        >{{ reply.vip }}</span>
                                        <span
                                            v-if="isCommentFieldVisible('level') && reply.level"
                                            class="badge"
                                        >Lv{{ reply.level }}</span>
                                        <span
                                            v-if="isCommentFieldVisible('official') && reply.official"
                                            class="badge"
                                        >{{ reply.official }}</span>
                                        <span
                                            v-if="
                                                isCommentFieldVisible('nameplate') && reply.nameplate
                                            "
                                            class="badge tag"
                                        >{{ reply.nameplate }}</span>
                                        <span v-if="isCommentFieldVisible('time')" class="muted">{{
                                            reply.time
                                        }}</span>
                                        <span
                                            v-if="isCommentFieldVisible('location') && reply.location"
                                            class="muted"
                                        >{{ reply.location }}</span>
                                        <span v-if="isCommentFieldVisible('like')" class="like"
                                            >♥ {{ reply.like }}</span
                                        >
                                    </div>
                                    <p
                                        v-if="isCommentFieldVisible('sign') && reply.sign"
                                        class="comment-sign muted"
                                    >
                                        {{ reply.sign }}
                                    </p>
                                    <p v-if="isCommentFieldVisible('content')" class="comment-content">
                                        {{ reply.content }}
                                    </p>
                                    <p
                                        v-if="isCommentFieldVisible('picture') && pictureUrls(reply.picture).length"
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

.field-filters {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 0 16px;
}

.field-filter {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    padding: 10px 12px;
    background: #1f1f26;
    border-radius: 8px;
}

.meta-row {
    display: flex;
    gap: 12px;
    padding: 0 16px 14px;
    border-top: 1px solid #2a2a32;
}

.meta-row > .meta-block {
    flex: 1;
}

.meta-block {
    padding: 10px 12px;
    background: #1f1f26;
    border-radius: 8px;
    min-width: 0;
}

.meta-block-title {
    margin: 0 0 8px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b6b78;
}

.meta-block-title.collapsible {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 0;
    cursor: pointer;
    user-select: none;
}

.meta-block-title.collapsible:hover {
    color: #a8a8b3;
}

.collapse-icon {
    font-size: 0.85rem;
    line-height: 1;
}

.meta-item-wide {
    grid-column: 1 / -1;
}

.meta-image-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.meta-image-list a {
    display: block;
    line-height: 0;
}

.comments-panel-title {
    padding: 12px 16px 0;
    margin: 0;
}

.meta-block-body {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-top: 8px;
}

.meta-block-body.author-meta {
    align-items: center;
}

.meta-fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 6px 16px;
    flex: 1;
    min-width: 0;
    margin: 0;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.meta-item dt {
    margin: 0;
    font-size: 0.72rem;
    color: #6b6b78;
}

.meta-item dd {
    margin: 0;
    font-size: 0.78rem;
    color: #c4c4ce;
    word-break: break-word;
}

.meta-item a {
    color: var(--accent);
    text-decoration: none;
}

.meta-item a:hover {
    text-decoration: underline;
}

.meta-thumb {
    max-width: 120px;
    max-height: 68px;
    border-radius: 6px;
    object-fit: cover;
}

.meta-thumb.round {
    width: 40px;
    height: 40px;
    border-radius: 50%;
}

.video-cover {
    flex-shrink: 0;
    width: 120px;
    height: 68px;
    object-fit: cover;
    border-radius: 6px;
    background: #2a2a32;
}

.author-avatar-lg {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: #2a2a32;
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

@media (max-width: 900px) {
    .meta-row {
        flex-direction: column;
    }
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

.comment-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.comment-sign {
    margin: 0 0 4px;
    font-size: 0.78rem;
    line-height: 1.4;
    word-break: break-word;
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
