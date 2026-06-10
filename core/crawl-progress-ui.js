import { CrawlAbortedError, MESSAGE_OPEN_RECORDS } from './config.js';

const HOST_ID = 'ext-comment-crawler-progress-host';

/**
 * 在目标页面插入爬取进度悬浮框（结束、完成提示、跳转记录页）
 * @param {{
 *   accent?: string,
 *   accentHover?: string,
 *   accentRgb?: string,
 *   platformLabel?: string,
 *   platformId?: string,
 * }} [options]
 */
export function createCrawlProgressPanel(options = {}) {
    const {
        accent = '#7c8aff',
        accentHover = '#95a3ff',
        accentRgb = '124 138 255',
        platformLabel = '评论爬取',
        platformId = '',
    } = options;

    let aborted = false;
    /** @type {'running' | 'scrolling' | 'replies' | 'saving' | 'done' | 'error'} */
    let phase = 'running';
    /** @type {{ roots: number, rootLimit: number, total: number, totalLimit: number, cachedRoots: number }} */
    let stats = { roots: 0, rootLimit: 0, total: 0, totalLimit: 0, cachedRoots: 0 };
    let doneRoots = 0;
    let doneTotal = 0;
    let doneNote = '';
    let errorMessage = '';

    const requestAbort = () => {
        if (aborted || phase === 'done' || phase === 'error') return;
        aborted = true;
        render();
    };

    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText =
        'all:initial;position:fixed;z-index:2147483646;bottom:24px;right:24px;font-family:system-ui,-apple-system,sans-serif;';

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
<style>
  :host, * { box-sizing: border-box; }
  .panel {
    width: 280px;
    padding: 14px 16px;
    color: #e8e8ed;
    background: #18181c;
    border: 1px solid #2a2a32;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgb(0 0 0 / 45%);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .badge {
    flex-shrink: 0;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 500;
    color: var(--accent);
    background: rgb(var(--accent-rgb) / 12%);
    border: 1px solid rgb(var(--accent-rgb) / 25%);
    border-radius: 999px;
  }
  .status {
    margin: 0 0 8px;
    font-size: 12px;
    line-height: 1.5;
    color: #a8a8b3;
    min-height: 36px;
  }
  .stats {
    margin: 0 0 12px;
    font-size: 11px;
    line-height: 1.45;
    color: #6b6b78;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  button {
    flex: 1;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-secondary {
    color: #c4c4ce;
    background: #222228;
    border-color: #36363f;
  }
  .btn-secondary:hover:not(:disabled) {
    background: #2a2a32;
    border-color: #45454f;
  }
  .btn-primary {
    color: #fff;
    background: var(--accent);
    border-color: var(--accent);
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .btn-ghost {
    flex: 0 0 auto;
    padding: 4px 8px;
    color: #6b6b78;
    background: transparent;
    border-color: transparent;
  }
  .btn-ghost:hover { color: #a8a8b3; }
  .done-banner {
    margin: 0 0 10px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.45;
    color: #b8f0c8;
    background: rgb(72 199 116 / 12%);
    border: 1px solid rgb(72 199 116 / 22%);
    border-radius: 8px;
  }
  .error-banner {
    margin: 0 0 10px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.45;
    color: #ffb4b4;
    background: rgb(255 80 80 / 10%);
    border: 1px solid rgb(255 80 80 / 20%);
    border-radius: 8px;
  }
</style>
<div class="panel" style="--accent:${accent};--accent-hover:${accentHover};--accent-rgb:${accentRgb}">
  <div class="head">
    <h2 class="title">评论爬取</h2>
    <span class="badge"></span>
    <button type="button" class="btn-ghost close-btn" title="关闭">✕</button>
  </div>
  <div class="banner" hidden></div>
  <p class="status"></p>
  <p class="stats"></p>
  <div class="actions"></div>
</div>`;

    const badgeEl = shadow.querySelector('.badge');
    const bannerEl = shadow.querySelector('.banner');
    const statusEl = shadow.querySelector('.status');
    const statsEl = shadow.querySelector('.stats');
    const actionsEl = shadow.querySelector('.actions');
    const closeBtn = shadow.querySelector('.close-btn');

    const formatLimit = (n) => (n > 0 ? String(n) : '不限');

    const statusText = () => {
        if (phase === 'done') return '爬取已完成，结果已保存到抓取记录。';
        if (phase === 'error') return errorMessage || '爬取失败';
        if (aborted) return '正在结束：完成当前步骤后将保存已采集数据。';
        if (phase === 'scrolling') return '正在滚动页面，加载更多一级评论…';
        if (phase === 'replies') return '正在展开并采集二级评论…';
        if (phase === 'saving') return '正在保存抓取结果…';
        return '正在采集一级评论…';
    };

    const statsText = () => {
        if (phase === 'done') {
            return `一级 ${doneRoots} 条 · 累计 ${doneTotal} 条（含二级）`;
        }
        if (phase === 'error') return '';
        const parts = [
            `一级 ${stats.roots}/${formatLimit(stats.rootLimit)}`,
            `累计 ${stats.total} 条`,
        ];
        if (stats.totalLimit > 0) parts.push(`上限 ${stats.totalLimit}`);
        if (stats.cachedRoots > stats.roots) parts.push(`已发现 ${stats.cachedRoots} 条`);
        return parts.join(' · ');
    };

    const renderActions = () => {
        actionsEl.innerHTML = '';
        if (phase === 'done') {
            const recordsBtn = document.createElement('button');
            recordsBtn.type = 'button';
            recordsBtn.className = 'btn-primary';
            recordsBtn.textContent = '查看抓取记录';
            recordsBtn.addEventListener('click', openRecords);
            actionsEl.appendChild(recordsBtn);

            const closeAction = document.createElement('button');
            closeAction.type = 'button';
            closeAction.className = 'btn-secondary';
            closeAction.textContent = '关闭';
            closeAction.addEventListener('click', destroy);
            actionsEl.appendChild(closeAction);
            return;
        }
        if (phase === 'error') {
            const closeAction = document.createElement('button');
            closeAction.type = 'button';
            closeAction.className = 'btn-secondary';
            closeAction.textContent = '关闭';
            closeAction.addEventListener('click', destroy);
            actionsEl.appendChild(closeAction);
            return;
        }

        const stopBtn = document.createElement('button');
        stopBtn.type = 'button';
        stopBtn.className = 'btn-secondary';
        stopBtn.textContent = '结束';
        stopBtn.disabled = aborted;
        stopBtn.addEventListener('click', requestAbort);
        actionsEl.appendChild(stopBtn);
    };

    const render = () => {
        badgeEl.textContent = platformLabel;
        statusEl.textContent = statusText();
        statsEl.textContent = statsText();

        bannerEl.hidden = true;
        bannerEl.className = 'banner';
        if (phase === 'done') {
            bannerEl.hidden = false;
            bannerEl.className = 'done-banner';
            bannerEl.textContent =
                doneNote || `完成！共采集 ${doneRoots} 条一级评论，累计 ${doneTotal} 条。`;
        } else if (phase === 'error') {
            bannerEl.hidden = false;
            bannerEl.className = 'error-banner';
            bannerEl.textContent = errorMessage || '爬取失败';
        }

        renderActions();
    };

    const openRecords = () => {
        browser.runtime
            .sendMessage({
                type: MESSAGE_OPEN_RECORDS,
                platform: platformId || undefined,
            })
            .catch(() => {
                statusEl.textContent = '无法打开记录页，请从扩展 popup 点击「查看抓取记录」。';
            });
    };

    const destroy = () => host.remove();

    closeBtn.addEventListener('click', destroy);

    const setProgress = (nextPhase, nextStats = {}) => {
        phase = nextPhase;
        stats = { ...stats, ...nextStats };
        render();
    };

    const setDone = ({ rootCount, totalCount, note = '' }) => {
        phase = 'done';
        doneRoots = rootCount;
        doneTotal = totalCount;
        doneNote = note;
        aborted = false;
        render();
    };

    const setError = (message) => {
        phase = 'error';
        errorMessage = message;
        aborted = false;
        render();
    };

    document.body.appendChild(host);
    render();

    return {
        requestAbort,
        throwIfAborted: () => {
            if (aborted) throw new CrawlAbortedError();
        },
        isAborted: () => aborted,
        setProgress,
        setDone,
        setError,
        destroy,
    };
}
