import * as XLSX from 'xlsx';
import { formatRecordFieldValue, resolveRecordMeta } from './record-fields.js';

/**
 * @typedef {{ key: string, label: string, suffix?: string }} FieldDef
 */

/**
 * 将单条抓取记录导出为双 Sheet 的 Excel 文件（Uint8Array）。
 *
 * Sheet「评论」：一行一条评论（一级 / 二级），含 recordId 便于未来多记录合并。
 * Sheet「{workSectionLabel}+作者」：单行作品信息 + 作者信息。
 *
 * @param {import('./records.js').CrawlRecord} record  原始记录（未过滤）
 * @param {{
 *   commentFieldDefs: FieldDef[],
 *   videoFieldDefs: FieldDef[],
 *   authorFieldDefs: FieldDef[],
 *   workSectionLabel: string,
 * }} options
 * @returns {Uint8Array}
 */
export function buildRecordXlsx(record, { commentFieldDefs, videoFieldDefs, authorFieldDefs, workSectionLabel }) {
    const wb = XLSX.utils.book_new();

    // ===== Sheet 1: 评论 =====
    const commentHeaders = [
        '记录ID',
        '层级',
        '父评论序号',
        ...commentFieldDefs.map((f) => f.label),
    ];

    /** @type {(string | number)[][]} */
    const commentRows = [commentHeaders];

    for (const [i, comment] of (record.comments ?? []).entries()) {
        commentRows.push([
            record.id,
            1,
            '',
            ...commentFieldDefs.map((f) => comment[f.key] ?? ''),
        ]);
        for (const reply of comment.replies ?? []) {
            commentRows.push([
                record.id,
                2,
                i + 1,
                ...commentFieldDefs.map((f) => reply[f.key] ?? ''),
            ]);
        }
    }

    const wsComments = XLSX.utils.aoa_to_sheet(commentRows);
    XLSX.utils.book_append_sheet(wb, wsComments, '评论');

    // ===== Sheet 2: 作品+作者 =====
    const { videoInfo, authorInfo } = resolveRecordMeta(record);

    const infoHeaders = [
        '记录ID',
        '作品URL',
        '标题',
        '抓取时间',
        ...videoFieldDefs.map((f) => f.label),
        ...authorFieldDefs.map((f) => f.label),
    ];

    const infoRow = [
        record.id,
        record.url ?? '',
        record.title ?? '',
        record.crawledAt ?? '',
        ...videoFieldDefs.map((f) =>
            videoInfo[f.key] ? formatRecordFieldValue(f, videoInfo[f.key]) : '',
        ),
        ...authorFieldDefs.map((f) =>
            authorInfo[f.key] ? formatRecordFieldValue(f, authorInfo[f.key]) : '',
        ),
    ];

    const wsInfo = XLSX.utils.aoa_to_sheet([infoHeaders, infoRow]);
    XLSX.utils.book_append_sheet(wb, wsInfo, `${workSectionLabel}+作者`);

    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
