import { Router } from "express";
import { readEvents } from "../lib/storage.js";
import type { SourceType, EventStatus } from "../lib/storage.js";

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

function actionButtons(id: string, status: EventStatus): string {
  const approveDisabled = status === "approved" ? "disabled" : "";
  const rejectDisabled = status === "rejected" ? "disabled" : "";
  const draftDisabled = status === "draft" ? "disabled" : "";
  return `
    <div class="action-btns">
      <button class="btn-action btn-approve" onclick="setStatus('${id}','approved',this)" ${approveDisabled} title="발행 승인">✓</button>
      <button class="btn-action btn-reject" onclick="setStatus('${id}','rejected',this)" ${rejectDisabled} title="제외">✕</button>
      <button class="btn-action btn-draft" onclick="setStatus('${id}','draft',this)" ${draftDisabled} title="수집됨으로 되돌리기">↩</button>
      <button class="btn-del" onclick="deleteEvent('${id}', this)" title="삭제">🗑</button>
    </div>`;
}

function renderAdminPage(events: Awaited<ReturnType<typeof readEvents>>) {
  const total = events.length;
  const approvedCount = events.filter((e) => e.status === "approved").length;
  const draftCount = events.filter((e) => e.status === "draft").length;
  const rejectedCount = events.filter((e) => e.status === "rejected").length;

  const rows = events
    .slice()
    .reverse()
    .map((e) => {
      const dateStr = e.date || "-";
      const titleCell = e.link
        ? `<a href="${escHtml(e.link)}" target="_blank" rel="noopener">${escHtml(e.title)}</a>`
        : escHtml(e.title);
      return `
      <tr data-id="${escHtml(e.id)}" data-status="${escHtml(e.status)}">
        <td class="td-title">${titleCell}</td>
        <td>${escHtml(e.source)}</td>
        <td>${sourceTypeBadge(e.sourceType)}</td>
        <td>${statusBadge(e.status)}</td>
        <td>${escHtml(dateStr)}</td>
        <td>${escHtml(new Date(e.crawledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }))}</td>
        <td>${actionButtons(e.id, e.status)}</td>
      </tr>`;
    })
    .join("");

  const emptyRow =
    events.length === 0
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
      background: #f0f4f8;
      color: #1a202c;
      min-height: 100vh;
      font-size: 14px;
    }
    header {
      background: #0f3460;
      color: #fff;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    header h1 { font-size: 1.1rem; font-weight: 700; }
    .hbadge {
      background: #e94560; color: #fff;
      font-size: 0.65rem; font-weight: 700;
      padding: 2px 8px; border-radius: 99px; letter-spacing: 0.5px;
    }
    main { max-width: 1300px; margin: 0 auto; padding: 28px 16px 60px; }

    /* stat bar */
    .stat-bar {
      display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
    }
    .stat-card {
      background: #fff; border-radius: 10px; padding: 14px 20px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      display: flex; flex-direction: column; gap: 2px; min-width: 110px;
    }
    .stat-card .num { font-size: 1.6rem; font-weight: 800; line-height: 1; }
    .stat-card .lbl { font-size: 0.72rem; color: #718096; font-weight: 600; }
    .stat-total .num  { color: #2d3748; }
    .stat-draft .num  { color: #b7791f; }
    .stat-approved .num { color: #276749; }
    .stat-rejected .num { color: #c53030; }

    /* section */
    .section {
      background: #fff; border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      margin-bottom: 20px; overflow: hidden;
    }
    .section-header {
      padding: 14px 20px; border-bottom: 1px solid #e2e8f0;
      display: flex; align-items: center; gap: 10px;
    }
    .section-header h2 { font-size: 0.9rem; font-weight: 700; color: #2d3748; flex: 1; }
    .section-body { padding: 16px 20px; }

    /* buttons */
    button, .btn {
      cursor: pointer; border: none; border-radius: 7px;
      padding: 8px 16px; font-size: 0.82rem; font-weight: 600;
      transition: background 0.15s, opacity 0.15s;
      display: inline-flex; align-items: center; gap: 5px;
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-primary { background: #0f3460; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #1a4a8a; }
    .btn-danger-outline { background: #fff; color: #c53030; border: 1px solid #fc8181; }
    .btn-danger-outline:hover:not(:disabled) { background: #fff5f5; }

    /* action btns in table */
    .action-btns { display: flex; gap: 4px; align-items: center; }
    .btn-action {
      width: 26px; height: 26px; padding: 0; border-radius: 5px;
      font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .btn-approve { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .btn-approve:hover:not(:disabled) { background: #c6f6d5; }
    .btn-reject  { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }
    .btn-reject:hover:not(:disabled)  { background: #fed7d7; }
    .btn-draft   { background: #fffbeb; color: #b7791f; border: 1px solid #fef3c7; }
    .btn-draft:hover:not(:disabled)   { background: #fef3c7; }
    .btn-del     { background: #f7fafc; color: #718096; border: 1px solid #e2e8f0; width: 26px; height: 26px; padding: 0; border-radius: 5px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
    .btn-del:hover { background: #fed7d7; color: #c53030; border-color: #fed7d7; }

    /* source type badges */
    .src-badge {
      display: inline-block; font-size: 0.68rem; font-weight: 700;
      padding: 2px 7px; border-radius: 4px; letter-spacing: 0.3px; white-space: nowrap;
    }
    .badge-rss    { background: #ebf8ff; color: #2b6cb0; border: 1px solid #bee3f8; }
    .badge-html   { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .badge-manual { background: #faf5ff; color: #6b46c1; border: 1px solid #e9d8fd; }

    /* status badges */
    .status-badge {
      display: inline-block; font-size: 0.68rem; font-weight: 700;
      padding: 2px 8px; border-radius: 4px; white-space: nowrap;
    }
    .status-draft    { background: #fffbeb; color: #b7791f; border: 1px solid #fef3c7; }
    .status-approved { background: #f0fff4; color: #276749; border: 1px solid #c6f6d5; }
    .status-rejected { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; }

    /* filter bar */
    .filter-bar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
    .filter-btn {
      padding: 5px 14px; border-radius: 99px; font-size: 0.78rem; font-weight: 600;
      border: 1px solid #e2e8f0; background: #fff; color: #718096; cursor: pointer;
      transition: all 0.15s;
    }
    .filter-btn.active { background: #0f3460; color: #fff; border-color: #0f3460; }
    .filter-btn:hover:not(.active) { background: #f7fafc; }

    /* crawl section */
    .crawl-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .crawl-row input[type="url"] {
      flex: 1; min-width: 200px; border: 1px solid #cbd5e0; border-radius: 7px;
      padding: 8px 12px; font-size: 0.85rem; color: #2d3748; outline: none;
    }
    .crawl-row input[type="url"]:focus { border-color: #0f3460; box-shadow: 0 0 0 2px rgba(15,52,96,0.15); }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }

    /* manual form */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group.full { grid-column: 1 / -1; }
    label { font-size: 0.75rem; font-weight: 600; color: #4a5568; }
    input[type="text"], input[type="date"], input[type="url"].form-input, textarea {
      border: 1px solid #cbd5e0; border-radius: 7px; padding: 7px 11px;
      font-size: 0.85rem; color: #2d3748; outline: none; font-family: inherit;
    }
    input:focus, textarea:focus { border-color: #0f3460; box-shadow: 0 0 0 2px rgba(15,52,96,0.15); }
    textarea { resize: vertical; min-height: 60px; }
    .form-actions { margin-top: 12px; display: flex; justify-content: flex-end; }

    /* table */
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 820px; }
    thead th {
      background: #f7fafc; padding: 10px 12px; text-align: left;
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      color: #718096; border-bottom: 1px solid #e2e8f0; white-space: nowrap;
    }
    tbody tr { border-bottom: 1px solid #f0f4f8; transition: background 0.1s; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: #f7fafc; }
    tbody tr[data-status="approved"] { background: #f0fff4; }
    tbody tr[data-status="rejected"] { background: #fff5f5; opacity: 0.75; }
    tbody tr[data-status="approved"]:hover { background: #e6ffed; }
    tbody tr[data-status="rejected"]:hover { background: #ffe8e8; opacity: 1; }
    tbody td { padding: 10px 12px; font-size: 0.84rem; vertical-align: middle; color: #2d3748; }
    tbody td.td-title { max-width: 320px; word-break: break-word; }
    tbody td a { color: #2b6cb0; text-decoration: none; }
    tbody td a:hover { text-decoration: underline; }
    tbody td.empty { text-align: center; color: #a0aec0; padding: 48px 16px; line-height: 1.7; }

    .count-badge { background: #e2e8f0; color: #4a5568; font-size: 0.75rem; font-weight: 600; padding: 3px 10px; border-radius: 99px; }
    #status-bar { margin-top: 12px; font-size: 0.8rem; color: #718096; min-height: 18px; }
    #status-bar.success { color: #276749; }
    #status-bar.error { color: #c53030; }
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #cbd5e0; border-top-color: #0f3460; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .summary-list { margin-top: 8px; font-size: 0.78rem; }
    .summary-list span { display: block; padding: 1px 0; }
    .summary-list .err { color: #c53030; }
    .summary-list .ok  { color: #276749; }

    /* tier legend */
    .tier-legend { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; font-size: 0.78rem; color: #718096; align-items: center; }
    .tier-legend strong { color: #2d3748; }
  </style>
</head>
<body>
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
    </div>

    <!-- Crawl Section -->
    <div class="section">
      <div class="section-header">
        <h2>크롤링</h2>
      </div>
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
      <div class="section-body" style="padding-bottom:0;">
        <div class="filter-bar">
          <button class="filter-btn active" onclick="filterBy('all', this)">전체 <span id="f-all">${total}</span></button>
          <button class="filter-btn" onclick="filterBy('draft', this)">수집됨 <span id="f-draft">${draftCount}</span></button>
          <button class="filter-btn" onclick="filterBy('approved', this)">발행 승인 <span id="f-approved">${approvedCount}</span></button>
          <button class="filter-btn" onclick="filterBy('rejected', this)">제외 <span id="f-rejected">${rejectedCount}</span></button>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>출처</th>
              <th>수집유형</th>
              <th>상태</th>
              <th>행사일</th>
              <th>수집일시</th>
              <th>액션</th>
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

    // ── Filter ──────────────────────────────────────────────────────────────
    function filterBy(status, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('#event-tbody tr[data-id]').forEach(row => {
        if (status === 'all' || row.dataset.status === status) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }

    // ── Status update ────────────────────────────────────────────────────────
    async function setStatus(id, status, btn) {
      btn.disabled = true;
      try {
        const res = await fetch('/api/events/' + id + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const data = await res.json();
        if (!data.success) { btn.disabled = false; return; }

        const row = btn.closest('tr');
        row.dataset.status = status;

        // update status badge cell
        const statusCell = row.querySelectorAll('td')[3];
        statusCell.innerHTML = BADGE_STATUS[status] || status;

        // update row background (via CSS attribute selector)
        // re-enable/disable action buttons
        row.querySelector('.btn-approve').disabled = (status === 'approved');
        row.querySelector('.btn-reject').disabled  = (status === 'rejected');
        row.querySelector('.btn-draft').disabled   = (status === 'draft');

        // update stats
        recalcStats();
      } catch(e) {
        btn.disabled = false;
      }
    }

    function recalcStats() {
      const rows = [...document.querySelectorAll('#event-tbody tr[data-id]')];
      const total    = rows.length;
      const draft    = rows.filter(r => r.dataset.status === 'draft').length;
      const approved = rows.filter(r => r.dataset.status === 'approved').length;
      const rejected = rows.filter(r => r.dataset.status === 'rejected').length;

      document.getElementById('stat-total').textContent    = total;
      document.getElementById('stat-draft').textContent    = draft;
      document.getElementById('stat-approved').textContent = approved;
      document.getElementById('stat-rejected').textContent = rejected;
      document.getElementById('count-badge').textContent   = '총 ' + total + '건';
      document.getElementById('f-all').textContent      = total;
      document.getElementById('f-draft').textContent    = draft;
      document.getElementById('f-approved').textContent = approved;
      document.getElementById('f-rejected').textContent = rejected;
    }

    // ── Crawl ────────────────────────────────────────────────────────────────
    const statusBar   = document.getElementById('status-bar');
    const summaryList = document.getElementById('summary-list');

    function setGlobalStatus(msg, type) { statusBar.textContent = msg; statusBar.className = type || ''; }
    function setLoading(msg) {
      statusBar.innerHTML = '<span class="spinner"></span>' + msg;
      statusBar.className = '';
      summaryList.innerHTML = '';
    }

    async function runCrawl(customOnly) {
      const urlInput = document.getElementById('custom-url');
      const customUrl = urlInput.value.trim();
      if (customOnly && !customUrl) { setGlobalStatus('URL을 입력해 주세요.', 'error'); return; }

      const btnAll = document.getElementById('btn-crawl-all');
      const btnUrl = document.getElementById('btn-crawl-url');
      btnAll.disabled = true; btnUrl.disabled = true;
      setLoading(customOnly ? 'URL 크롤링 중...' : 'RSS → HTML 순서로 크롤링 중...');

      try {
        const body = customOnly ? { url: customUrl } : {};
        const res = await fetch('/api/events/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          setGlobalStatus('완료: 신규 ' + data.added + '건 추가, 총 ' + data.total + '건.', 'success');
          if (data.summary) {
            summaryList.innerHTML = data.summary.map(s => {
              const badge = BADGE_SRC[s.sourceType] || '';
              return s.error
                ? '<span class="err">✗ ' + badge + ' ' + s.source + ': ' + s.error + '</span>'
                : '<span class="ok">✓ ' + badge + ' ' + s.source + ': ' + s.collected + '건</span>';
            }).join('');
          }
          setTimeout(() => location.reload(), 1500);
        } else {
          setGlobalStatus('오류: ' + (data.error || '알 수 없는 오류'), 'error');
        }
      } catch(e) {
        setGlobalStatus('요청 실패: ' + e.message, 'error');
      } finally {
        btnAll.disabled = false; btnUrl.disabled = false;
      }
    }

    async function resetData() {
      if (!confirm('수집된 데이터를 모두 초기화하시겠습니까?')) return;
      const btn = document.getElementById('btn-reset');
      btn.disabled = true; setLoading('초기화 중...');
      try {
        const res = await fetch('/api/events', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) { setGlobalStatus('초기화 완료.', 'success'); setTimeout(() => location.reload(), 600); }
        else { setGlobalStatus('오류: ' + data.error, 'error'); }
      } catch(e) { setGlobalStatus('요청 실패: ' + e.message, 'error'); }
      finally { btn.disabled = false; }
    }

    async function deleteEvent(id, btn) {
      btn.disabled = true;
      try {
        const res = await fetch('/api/events/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          const row = btn.closest('tr');
          row.style.transition = 'opacity 0.2s'; row.style.opacity = '0';
          setTimeout(() => { row.remove(); recalcStats(); }, 200);
        } else { btn.disabled = false; }
      } catch(e) { btn.disabled = false; }
    }

    // ── Manual register ──────────────────────────────────────────────────────
    async function submitManual(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-manual');
      const statusEl = document.getElementById('manual-status');
      btn.disabled = true; statusEl.textContent = '';

      const body = {
        title:       document.getElementById('m-title').value.trim(),
        source:      document.getElementById('m-source').value.trim(),
        date:        document.getElementById('m-date').value,
        link:        document.getElementById('m-link').value.trim(),
        description: document.getElementById('m-desc').value.trim(),
      };

      try {
        const res = await fetch('/api/events/manual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          statusEl.style.color = '#276749';
          statusEl.textContent = '등록되었습니다. (총 ' + data.total + '건)';
          document.getElementById('manual-form').reset();
          setTimeout(() => location.reload(), 800);
        } else {
          statusEl.style.color = '#c53030';
          statusEl.textContent = '오류: ' + (data.error || '등록 실패');
        }
      } catch(e) {
        statusEl.style.color = '#c53030';
        statusEl.textContent = '요청 실패: ' + e.message;
      } finally { btn.disabled = false; }
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
