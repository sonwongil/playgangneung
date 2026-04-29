import { Router } from "express";
import { readEvents } from "../lib/storage.js";
import type { SourceType, EventStatus, SocialDraft } from "../lib/storage.js";

const router = Router();

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sourceTypeBadge(t: SourceType): string {
  const map: Record<SourceType, { label: string; cls: string }> = {
    rss: { label: "RSS", cls: "badge-rss" },
    html: { label: "HTML", cls: "badge-html" },
    manual: { label: "수동", cls: "badge-manual" },
  };
  const { label, cls } = map[t] ?? { label: t, cls: "badge-html" };
  return `<span class="src-badge ${cls}">${label}</span>`;
}

function statusBadge(s: EventStatus): string {
  const map: Record<EventStatus, { label: string; cls: string }> = {
    draft: { label: "수집됨", cls: "status-draft" },
    approved: { label: "발행 승인", cls: "status-approved" },
    rejected: { label: "제외", cls: "status-rejected" },
  };
  const { label, cls } = map[s] ?? { label: s, cls: "status-draft" };
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function draftBtn(id: string, hasDraft: boolean): string {
  if (hasDraft) {
    return `<button class="btn-action btn-sns has-draft" onclick="openDraftModal('${id}')" title="SNS 초안 확인">📋</button>`;
  }
  return `<button class="btn-action btn-sns" onclick="generateDraft('${id}',this)" title="SNS 초안 생성">✍️</button>`;
}

function actionButtons(id: string, status: EventStatus, hasDraft: boolean): string {
  const approveDisabled = status === "approved" ? "disabled" : "";
  const rejectDisabled  = status === "rejected"  ? "disabled" : "";
  const draftDisabled   = status === "draft"     ? "disabled" : "";
  const sns = status === "approved" ? draftBtn(id, hasDraft) : "";
  return `
    <div class="action-btns">
      <button class="btn-action btn-approve" onclick="setStatus('${id}','approved',this)" ${approveDisabled} title="발행 승인">✓</button>
      <button class="btn-action btn-reject"  onclick="setStatus('${id}','rejected',this)"  ${rejectDisabled}  title="제외">✕</button>
      <button class="btn-action btn-draft-s" onclick="setStatus('${id}','draft',this)"   ${draftDisabled}   title="수집됨으로 되돌리기">↩</button>
      ${sns}
      <button class="btn-del" onclick="deleteEvent('${id}', this)" title="삭제">🗑</button>
    </div>`;
}

function renderAdminPage(events: Awaited<ReturnType<typeof readEvents>>) {
  const total         = events.length;
  const approvedCount = events.filter((e) => e.status === "approved").length;
  const draftCount    = events.filter((e) => e.status === "draft").length;
  const rejectedCount = events.filter((e) => e.status === "rejected").length;
  const draftReady    = events.filter((e) => e.socialDraft !== null).length;

  const rows = events
    .slice()
    .reverse()
    .map((e) => {
      const dateStr   = e.date || "-";
      const titleCell = e.link
        ? `<a href="${escHtml(e.link)}" target="_blank" rel="noopener">${escHtml(e.title)}</a>`
        : escHtml(e.title);
      const hasDraft  = e.socialDraft !== null;
      const draftData = hasDraft
        ? escHtml(JSON.stringify(e.socialDraft))
        : "";
      return `
      <tr data-id="${escHtml(e.id)}" data-status="${escHtml(e.status)}" data-draft='${draftData}'>
        <td class="td-title">${titleCell}</td>
        <td>${escHtml(e.source)}</td>
        <td>${sourceTypeBadge(e.sourceType)}</td>
        <td>${statusBadge(e.status)}</td>
        <td>${escHtml(dateStr)}</td>
        <td>${escHtml(new Date(e.crawledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }))}</td>
        <td>${actionButtons(e.id, e.status, hasDraft)}</td>
      </tr>`;
    })
    .join("");

  const emptyRow = events.length === 0
    ? `<tr><td colspan="7" class="empty">수집된 데이터가 없습니다.<br>크롤링을 실행하거나 수동으로 등록해 주세요.</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PLAY강릉 SNS 백오피스</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', -apple-system, sans-serif;
      background: #f0f4f8; color: #1a202c; min-height: 100vh; font-size: 14px;
    }
    header {
      background: #0f3460; color: #fff; padding: 14px 28px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    header h1 { font-size: 1.1rem; font-weight: 700; }
    .hbadge { background: #e94560; color: #fff; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
    main { max-width: 1350px; margin: 0 auto; padding: 28px 16px 60px; }

    /* stat bar */
    .stat-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .stat-card {
      background: #fff; border-radius: 10px; padding: 14px 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      display: flex; flex-direction: column; gap: 2px; min-width: 110px;
    }
    .stat-card .num { font-size: 1.6rem; font-weight: 800; line-height: 1; }
    .stat-card .lbl { font-size: 0.72rem; color: #718096; font-weight: 600; }
    .stat-total .num    { color: #2d3748; }
    .stat-draft .num    { color: #b7791f; }
    .stat-approved .num { color: #276749; }
    .stat-rejected .num { color: #c53030; }
    .stat-sns .num      { color: #553c9a; }

    /* section */
    .section { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; }
    .section-header { padding: 14px 20px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 10px; }
    .section-header h2 { font-size: 0.9rem; font-weight: 700; color: #2d3748; flex: 1; }
    .section-body { padding: 16px 20px; }

    /* buttons */
    button { cursor: pointer; border: none; border-radius: 7px; padding: 8px 16px; font-size: 0.82rem; font-weight: 600; transition: background 0.15s, opacity 0.15s; display: inline-flex; align-items: center; gap: 5px; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #0f3460; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #1a4a8a; }
    .btn-danger-outline { background: #fff; color: #c53030; border: 1px solid #fc8181; }
    .btn-danger-outline:hover:not(:disabled) { background: #fff5f5; }

    /* table action btns */
    .action-btns { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
    .btn-action { width: 26px; height: 26px; padding: 0; border-radius: 5px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .btn-approve  { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .btn-approve:hover:not(:disabled)  { background: #c6f6d5; }
    .btn-reject   { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }
    .btn-reject:hover:not(:disabled)   { background: #fed7d7; }
    .btn-draft-s  { background: #fffbeb; color: #b7791f; border: 1px solid #fef3c7; }
    .btn-draft-s:hover:not(:disabled)  { background: #fef3c7; }
    .btn-sns      { background: #faf5ff; color: #553c9a; border: 1px solid #e9d8fd; width: auto; padding: 0 8px; font-size: 0.7rem; }
    .btn-sns:hover:not(:disabled)      { background: #e9d8fd; }
    .btn-sns.has-draft { background: #553c9a; color: #fff; border-color: #553c9a; }
    .btn-sns.has-draft:hover           { background: #44337a; }
    .btn-del { background: #f7fafc; color: #718096; border: 1px solid #e2e8f0; width: 26px; height: 26px; padding: 0; border-radius: 5px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
    .btn-del:hover { background: #fed7d7; color: #c53030; border-color: #fed7d7; }

    /* badges */
    .src-badge { display: inline-block; font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
    .badge-rss    { background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }
    .badge-html   { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .badge-manual { background: #faf5ff; color: #6b46c1; border: 1px solid #e9d8fd; }
    .status-badge { display: inline-block; font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
    .status-draft    { background: #fffbeb; color: #b7791f; border: 1px solid #fef3c7; }
    .status-approved { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .status-rejected { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }

    /* filter bar */
    .filter-bar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
    .filter-btn { padding: 5px 14px; border-radius: 99px; font-size: 0.78rem; font-weight: 600; border: 1px solid #e2e8f0; background: #fff; color: #718096; cursor: pointer; transition: all 0.15s; }
    .filter-btn.active { background: #0f3460; color: #fff; border-color: #0f3460; }
    .filter-btn:hover:not(.active) { background: #f7fafc; }

    /* crawl section */
    .crawl-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .crawl-row input[type="url"] { flex: 1; min-width: 200px; border: 1px solid #cbd5e0; border-radius: 7px; padding: 8px 12px; font-size: 0.85rem; color: #2d3748; outline: none; }
    .crawl-row input[type="url"]:focus { border-color: #0f3460; box-shadow: 0 0 0 2px rgba(15,52,96,0.15); }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }
    .tier-legend { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; font-size: 0.78rem; color: #718096; align-items: center; }
    .tier-legend strong { color: #2d3748; }

    /* manual form */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group.full { grid-column: 1 / -1; }
    label { font-size: 0.75rem; font-weight: 600; color: #4a5568; }
    input[type="text"], input[type="date"], input[type="url"].form-input, textarea { border: 1px solid #cbd5e0; border-radius: 7px; padding: 7px 11px; font-size: 0.85rem; color: #2d3748; outline: none; font-family: inherit; }
    input:focus, textarea:focus { border-color: #0f3460; box-shadow: 0 0 0 2px rgba(15,52,96,0.15); }
    textarea { resize: vertical; min-height: 60px; }
    .form-actions { margin-top: 12px; display: flex; justify-content: flex-end; }

    /* table */
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 860px; }
    thead th { background: #f7fafc; padding: 10px 12px; text-align: left; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #718096; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    tbody tr { border-bottom: 1px solid #f0f4f8; transition: background 0.1s; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: #f7fafc; }
    tbody tr[data-status="approved"] { background: #f0fff4; }
    tbody tr[data-status="rejected"] { background: #fff5f5; opacity: 0.75; }
    tbody tr[data-status="approved"]:hover { background: #e6ffed; }
    tbody tr[data-status="rejected"]:hover { background: #ffe8e8; opacity: 1; }
    tbody td { padding: 10px 12px; font-size: 0.84rem; vertical-align: middle; color: #2d3748; }
    tbody td.td-title { max-width: 300px; word-break: break-word; }
    tbody td a { color: #2b6cb0; text-decoration: none; }
    tbody td a:hover { text-decoration: underline; }
    tbody td.empty { text-align: center; color: #a0aec0; padding: 48px 16px; line-height: 1.7; }

    .count-badge { background: #e2e8f0; color: #4a5568; font-size: 0.75rem; font-weight: 600; padding: 3px 10px; border-radius: 99px; }
    #status-bar { margin-top: 12px; font-size: 0.8rem; color: #718096; min-height: 18px; }
    #status-bar.success { color: #276749; }
    #status-bar.error   { color: #c53030; }
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #cbd5e0; border-top-color: #0f3460; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .summary-list { margin-top: 8px; font-size: 0.78rem; }
    .summary-list span { display: block; padding: 1px 0; }
    .summary-list .err { color: #c53030; }
    .summary-list .ok  { color: #276749; }

    /* ── SNS Draft Modal ─────────────────────────────────────────────────── */
    .modal-backdrop {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.45); z-index: 1000;
      align-items: center; justify-content: center;
    }
    .modal-backdrop.open { display: flex; }
    .modal {
      background: #fff; border-radius: 16px; width: 560px; max-width: calc(100vw - 32px);
      max-height: 90vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      display: flex; flex-direction: column;
    }
    .modal-header {
      padding: 18px 22px; border-bottom: 1px solid #e2e8f0;
      display: flex; align-items: center; gap: 10px;
    }
    .modal-header h3 { font-size: 1rem; font-weight: 700; flex: 1; }
    .modal-close { background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 6px; width: 30px; height: 30px; padding: 0; font-size: 1rem; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .modal-close:hover { background: #fed7d7; border-color: #fed7d7; }
    .modal-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
    .draft-section label { font-size: 0.72rem; font-weight: 700; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px; }
    .draft-title-box { font-size: 1.05rem; font-weight: 700; color: #1a202c; background: #f7fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .draft-caption-box { font-size: 0.88rem; color: #2d3748; background: #f7fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; line-height: 1.7; }
    .hashtag-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .hashtag-chip { background: #ebf8ff; color: #2b6cb0; font-size: 0.78rem; font-weight: 600; padding: 3px 10px; border-radius: 99px; }
    .draft-meta { font-size: 0.75rem; color: #a0aec0; }
    .modal-footer { padding: 14px 22px; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; justify-content: flex-end; }
    .btn-copy { background: #edf2f7; color: #2d3748; border: 1px solid #e2e8f0; }
    .btn-copy:hover { background: #e2e8f0; }
    .btn-regen { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .btn-regen:hover { background: #c6f6d5; }
    #modal-loading { text-align: center; padding: 40px; color: #718096; font-size: 0.9rem; }
  </style>
</head>
<body>

  <!-- SNS Draft Modal -->
  <div class="modal-backdrop" id="modal-backdrop" onclick="closeModalOnBackdrop(event)">
    <div class="modal" id="draft-modal">
      <div class="modal-header">
        <h3>✍️ SNS 초안</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" id="modal-body">
        <div id="modal-loading"><span class="spinner"></span> 초안 생성 중...</div>
      </div>
      <div class="modal-footer">
        <button class="btn-copy btn-primary" onclick="copyDraft()" id="btn-copy" style="display:none">클립보드 복사</button>
        <button class="btn-regen btn-primary" onclick="regenDraft()" id="btn-regen" style="display:none">다시 생성</button>
        <button class="btn-primary" onclick="closeModal()">닫기</button>
      </div>
    </div>
  </div>

  <header>
    <h1>PLAY강릉 SNS 백오피스</h1>
    <span class="hbadge">BACKOFFICE</span>
  </header>
  <main>

    <!-- Stats -->
    <div class="stat-bar">
      <div class="stat-card stat-total">
        <span class="num" id="stat-total">${total}</span>
        <span class="lbl">전체</span>
      </div>
      <div class="stat-card stat-draft">
        <span class="num" id="stat-draft">${draftCount}</span>
        <span class="lbl">수집됨</span>
      </div>
      <div class="stat-card stat-approved">
        <span class="num" id="stat-approved">${approvedCount}</span>
        <span class="lbl">발행 승인</span>
      </div>
      <div class="stat-card stat-rejected">
        <span class="num" id="stat-rejected">${rejectedCount}</span>
        <span class="lbl">제외</span>
      </div>
      <div class="stat-card stat-sns">
        <span class="num" id="stat-sns">${draftReady}</span>
        <span class="lbl">SNS 초안</span>
      </div>
    </div>

    <!-- Crawl Section -->
    <div class="section">
      <div class="section-header"><h2>크롤링</h2></div>
      <div class="section-body">
        <div class="tier-legend">
          <strong>수집 우선순위:</strong>
          <span class="src-badge badge-rss">RSS</span> 1순위 &rarr;
          <span class="src-badge badge-html">HTML</span> 2순위 &rarr;
          <span class="src-badge badge-manual">수동</span> 최종 폴백
        </div>
        <div class="crawl-row">
          <input type="url" id="custom-url" placeholder="크롤링할 URL 직접 입력 (RSS/HTML 자동 감지)" />
          <button class="btn-primary" id="btn-crawl-url" onclick="runCrawl(true)">URL 크롤링</button>
        </div>
        <hr class="divider" />
        <div class="crawl-row">
          <span style="flex:1; font-size:0.82rem; color:#718096;">기본 소스 일괄 크롤링 (RSS 4개 → HTML 3개 순서로 시도)</span>
          <button class="btn-primary" id="btn-crawl-all" onclick="runCrawl(false)">전체 크롤링</button>
          <button class="btn-danger-outline" id="btn-reset" onclick="resetData()">전체 초기화</button>
        </div>
        <div id="status-bar"></div>
        <div id="summary-list" class="summary-list"></div>
      </div>
    </div>

    <!-- Manual Register -->
    <div class="section">
      <div class="section-header">
        <h2>수동 등록 <span class="src-badge badge-manual" style="margin-left:6px">수동</span></h2>
      </div>
      <div class="section-body">
        <form id="manual-form" onsubmit="submitManual(event)">
          <div class="form-grid">
            <div class="form-group full">
              <label for="m-title">제목 *</label>
              <input type="text" id="m-title" placeholder="행사/공지 제목" required />
            </div>
            <div class="form-group">
              <label for="m-source">출처</label>
              <input type="text" id="m-source" placeholder="예: 강릉시청, 강릉관광" />
            </div>
            <div class="form-group">
              <label for="m-date">행사일</label>
              <input type="date" id="m-date" />
            </div>
            <div class="form-group full">
              <label for="m-link">링크</label>
              <input type="text" id="m-link" placeholder="https://..." class="form-input" />
            </div>
            <div class="form-group full">
              <label for="m-desc">설명</label>
              <textarea id="m-desc" placeholder="간략한 설명 (선택)"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary" id="btn-manual">등록</button>
          </div>
        </form>
        <div id="manual-status" style="margin-top:10px; font-size:0.8rem; min-height:18px;"></div>
      </div>
    </div>

    <!-- List Section -->
    <div class="section">
      <div class="section-header">
        <h2>수집 목록</h2>
        <span class="count-badge" id="count-badge">총 ${total}건</span>
      </div>
      <div class="section-body" style="padding-bottom:0">
        <div class="filter-bar">
          <button class="filter-btn active" onclick="filterBy('all',this)">전체 <span id="f-all">${total}</span></button>
          <button class="filter-btn" onclick="filterBy('draft',this)">수집됨 <span id="f-draft">${draftCount}</span></button>
          <button class="filter-btn" onclick="filterBy('approved',this)">발행 승인 <span id="f-approved">${approvedCount}</span></button>
          <button class="filter-btn" onclick="filterBy('rejected',this)">제외 <span id="f-rejected">${rejectedCount}</span></button>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>제목</th><th>출처</th><th>수집유형</th><th>상태</th>
              <th>행사일</th><th>수집일시</th><th>액션</th>
            </tr>
          </thead>
          <tbody id="event-tbody">
            ${rows}${emptyRow}
          </tbody>
        </table>
      </div>
    </div>
  </main>

  <script>
    const BADGE_SRC = {
      rss:    '<span class="src-badge badge-rss">RSS</span>',
      html:   '<span class="src-badge badge-html">HTML</span>',
      manual: '<span class="src-badge badge-manual">수동</span>',
    };
    const BADGE_STATUS = {
      draft:    '<span class="status-badge status-draft">수집됨</span>',
      approved: '<span class="status-badge status-approved">발행 승인</span>',
      rejected: '<span class="status-badge status-rejected">제외</span>',
    };

    // ── Modal state ─────────────────────────────────────────────────────────
    let _currentId   = null;
    let _currentDraft = null;

    function openModal() {
      document.getElementById('modal-backdrop').classList.add('open');
    }
    function closeModal() {
      document.getElementById('modal-backdrop').classList.remove('open');
      _currentId = null; _currentDraft = null;
    }
    function closeModalOnBackdrop(e) {
      if (e.target === document.getElementById('modal-backdrop')) closeModal();
    }

    function renderDraftModal(draft) {
      _currentDraft = draft;
      const body = document.getElementById('modal-body');
      const tags = draft.hashtags.map(h => '<span class="hashtag-chip">' + h + '</span>').join('');
      const dt   = draft.createdAt
        ? new Date(draft.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        : '';
      body.innerHTML = \`
        <div class="draft-section">
          <label>제목</label>
          <div class="draft-title-box">\${draft.title}</div>
        </div>
        <div class="draft-section">
          <label>본문 (캡션)</label>
          <div class="draft-caption-box">\${draft.caption}</div>
        </div>
        <div class="draft-section">
          <label>해시태그</label>
          <div class="hashtag-list">\${tags}</div>
        </div>
        \${dt ? '<div class="draft-meta">생성일시: ' + dt + '</div>' : ''}
      \`;
      document.getElementById('btn-copy').style.display = '';
      document.getElementById('btn-regen').style.display = '';
    }

    // ── Generate draft ───────────────────────────────────────────────────────
    async function generateDraft(id, triggerBtn) {
      _currentId = id;
      if (triggerBtn) triggerBtn.disabled = true;

      document.getElementById('modal-body').innerHTML =
        '<div id="modal-loading"><span class="spinner"></span> SNS 초안 생성 중...</div>';
      document.getElementById('btn-copy').style.display = 'none';
      document.getElementById('btn-regen').style.display = 'none';
      openModal();

      try {
        const res  = await fetch('/api/events/' + id + '/draft', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          renderDraftModal(data.socialDraft);
          // Update row data-draft & button
          const row = document.querySelector('tr[data-id="' + id + '"]');
          if (row) {
            row.dataset.draft = JSON.stringify(data.socialDraft);
            const snsBtn = row.querySelector('.btn-sns');
            if (snsBtn) {
              snsBtn.classList.add('has-draft');
              snsBtn.title = 'SNS 초안 확인';
              snsBtn.textContent = '📋';
              snsBtn.onclick = () => openDraftModal(id);
            }
          }
          // update stat
          const s = document.getElementById('stat-sns');
          if (s) s.textContent = parseInt(s.textContent) + 1;
        } else {
          document.getElementById('modal-body').innerHTML =
            '<div style="color:#c53030;padding:24px">' + (data.error || '생성 실패') + '</div>';
        }
      } catch(e) {
        document.getElementById('modal-body').innerHTML =
          '<div style="color:#c53030;padding:24px">요청 실패: ' + e.message + '</div>';
      } finally {
        if (triggerBtn) triggerBtn.disabled = false;
      }
    }

    function openDraftModal(id) {
      _currentId = id;
      const row   = document.querySelector('tr[data-id="' + id + '"]');
      const raw   = row ? row.dataset.draft : '';
      if (!raw) { generateDraft(id, null); return; }
      try {
        const draft = JSON.parse(raw);
        document.getElementById('btn-copy').style.display = '';
        document.getElementById('btn-regen').style.display = '';
        openModal();
        renderDraftModal(draft);
      } catch { generateDraft(id, null); }
    }

    async function regenDraft() {
      if (_currentId) await generateDraft(_currentId, null);
    }

    function copyDraft() {
      if (!_currentDraft) return;
      const text =
        _currentDraft.title + '\\n\\n' +
        _currentDraft.caption + '\\n\\n' +
        _currentDraft.hashtags.join(' ');
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btn-copy');
        btn.textContent = '✓ 복사됨';
        setTimeout(() => { btn.textContent = '클립보드 복사'; }, 1500);
      });
    }

    // ── Filter ──────────────────────────────────────────────────────────────
    function filterBy(status, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#event-tbody tr[data-id]').forEach(row => {
        row.style.display = (status === 'all' || row.dataset.status === status) ? '' : 'none';
      });
    }

    // ── Status update ────────────────────────────────────────────────────────
    async function setStatus(id, status, btn) {
      btn.disabled = true;
      try {
        const res  = await fetch('/api/events/' + id + '/status', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const data = await res.json();
        if (!data.success) { btn.disabled = false; return; }

        const row = btn.closest('tr');
        row.dataset.status = status;
        row.querySelectorAll('td')[3].innerHTML = BADGE_STATUS[status] || status;

        const ab = row.querySelector('.btn-approve');
        const rb = row.querySelector('.btn-reject');
        const db = row.querySelector('.btn-draft-s');
        if (ab) ab.disabled = (status === 'approved');
        if (rb) rb.disabled = (status === 'rejected');
        if (db) db.disabled = (status === 'draft');

        // Show/hide SNS btn based on new status
        const existingSns = row.querySelector('.btn-sns');
        if (status === 'approved' && !existingSns) {
          const actionDiv = row.querySelector('.action-btns');
          const delBtn    = row.querySelector('.btn-del');
          const snsBtn    = document.createElement('button');
          snsBtn.className = 'btn-action btn-sns';
          snsBtn.title = 'SNS 초안 생성';
          snsBtn.textContent = '✍️';
          snsBtn.onclick = () => generateDraft(id, snsBtn);
          actionDiv.insertBefore(snsBtn, delBtn);
        } else if (status !== 'approved' && existingSns) {
          existingSns.remove();
        }

        recalcStats();
      } catch(e) { btn.disabled = false; }
    }

    function recalcStats() {
      const rows     = [...document.querySelectorAll('#event-tbody tr[data-id]')];
      const total    = rows.length;
      const draft    = rows.filter(r => r.dataset.status === 'draft').length;
      const approved = rows.filter(r => r.dataset.status === 'approved').length;
      const rejected = rows.filter(r => r.dataset.status === 'rejected').length;

      document.getElementById('stat-total').textContent    = total;
      document.getElementById('stat-draft').textContent    = draft;
      document.getElementById('stat-approved').textContent = approved;
      document.getElementById('stat-rejected').textContent = rejected;
      document.getElementById('count-badge').textContent   = '총 ' + total + '건';
      document.getElementById('f-all').textContent         = total;
      document.getElementById('f-draft').textContent       = draft;
      document.getElementById('f-approved').textContent    = approved;
      document.getElementById('f-rejected').textContent    = rejected;
    }

    // ── Crawl ────────────────────────────────────────────────────────────────
    const statusBar   = document.getElementById('status-bar');
    const summaryList = document.getElementById('summary-list');
    function setGlobalStatus(msg, type) { statusBar.textContent = msg; statusBar.className = type || ''; }
    function setLoading(msg) { statusBar.innerHTML = '<span class="spinner"></span>' + msg; statusBar.className = ''; summaryList.innerHTML = ''; }

    async function runCrawl(customOnly) {
      const url = document.getElementById('custom-url').value.trim();
      if (customOnly && !url) { setGlobalStatus('URL을 입력해 주세요.', 'error'); return; }
      const ba = document.getElementById('btn-crawl-all');
      const bu = document.getElementById('btn-crawl-url');
      ba.disabled = bu.disabled = true;
      setLoading(customOnly ? 'URL 크롤링 중...' : 'RSS → HTML 순서로 크롤링 중...');
      try {
        const res  = await fetch('/api/events/crawl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(customOnly ? { url } : {}) });
        const data = await res.json();
        if (data.success) {
          setGlobalStatus('완료: 신규 ' + data.added + '건 추가, 총 ' + data.total + '건.', 'success');
          if (data.summary) summaryList.innerHTML = data.summary.map(s => s.error ? '<span class="err">✗ ' + (BADGE_SRC[s.sourceType]||'') + ' ' + s.source + ': ' + s.error + '</span>' : '<span class="ok">✓ ' + (BADGE_SRC[s.sourceType]||'') + ' ' + s.source + ': ' + s.collected + '건</span>').join('');
          setTimeout(() => location.reload(), 1500);
        } else { setGlobalStatus('오류: ' + (data.error||''), 'error'); }
      } catch(e) { setGlobalStatus('요청 실패: ' + e.message, 'error'); }
      finally { ba.disabled = bu.disabled = false; }
    }

    async function resetData() {
      if (!confirm('수집된 데이터를 모두 초기화하시겠습니까?')) return;
      const btn = document.getElementById('btn-reset');
      btn.disabled = true; setLoading('초기화 중...');
      try {
        const res = await fetch('/api/events', { method: 'DELETE' });
        const d   = await res.json();
        if (d.success) { setGlobalStatus('초기화 완료.', 'success'); setTimeout(() => location.reload(), 600); }
        else { setGlobalStatus('오류: ' + d.error, 'error'); }
      } catch(e) { setGlobalStatus('요청 실패: ' + e.message, 'error'); }
      finally { btn.disabled = false; }
    }

    async function deleteEvent(id, btn) {
      btn.disabled = true;
      try {
        const res = await fetch('/api/events/' + id, { method: 'DELETE' });
        const d   = await res.json();
        if (d.success) {
          const row = btn.closest('tr');
          row.style.transition = 'opacity 0.2s'; row.style.opacity = '0';
          setTimeout(() => { row.remove(); recalcStats(); }, 200);
        } else { btn.disabled = false; }
      } catch(e) { btn.disabled = false; }
    }

    async function submitManual(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-manual');
      const el  = document.getElementById('manual-status');
      btn.disabled = true; el.textContent = '';
      const body = {
        title:       document.getElementById('m-title').value.trim(),
        source:      document.getElementById('m-source').value.trim(),
        date:        document.getElementById('m-date').value,
        link:        document.getElementById('m-link').value.trim(),
        description: document.getElementById('m-desc').value.trim(),
      };
      try {
        const res  = await fetch('/api/events/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.success) { el.style.color = '#276749'; el.textContent = '등록되었습니다. (총 ' + data.total + '건)'; document.getElementById('manual-form').reset(); setTimeout(() => location.reload(), 800); }
        else { el.style.color = '#c53030'; el.textContent = '오류: ' + (data.error||'등록 실패'); }
      } catch(e) { el.style.color = '#c53030'; el.textContent = '요청 실패: ' + e.message; }
      finally { btn.disabled = false; }
    }
  </script>
</body>
</html>`;
}

router.get("/admin", async (req, res) => {
  try {
    const events = await readEvents();
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderAdminPage(events));
  } catch (err) {
    req.log.error({ err }, "어드민 페이지 렌더 실패");
    res.status(500).send("서버 오류");
  }
});

export default router;
