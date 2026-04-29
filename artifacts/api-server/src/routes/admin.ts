import { Router } from "express";
import { readEvents } from "../lib/storage.js";

const router = Router();

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderAdminPage(events: Awaited<ReturnType<typeof readEvents>>) {
  const rows = events
    .slice()
    .reverse()
    .map((e) => {
      const dateStr = e.date || "-";
      const titleCell = e.link
        ? `<a href="${escHtml(e.link)}" target="_blank" rel="noopener">${escHtml(e.title)}</a>`
        : escHtml(e.title);
      return `
      <tr data-id="${escHtml(e.id)}">
        <td class="td-title">${titleCell}</td>
        <td>${escHtml(e.source)}</td>
        <td>${escHtml(dateStr)}</td>
        <td>${escHtml(new Date(e.crawledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }))}</td>
        <td><button class="btn-del" onclick="deleteEvent('${escHtml(e.id)}', this)">삭제</button></td>
      </tr>`;
    })
    .join("");

  const emptyRow =
    events.length === 0
      ? `<tr><td colspan="5" class="empty">수집된 데이터가 없습니다.<br>아래에서 크롤링을 실행하거나 수동으로 등록해 주세요.</td></tr>`
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
    .badge {
      background: #e94560;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 99px;
      letter-spacing: 0.5px;
    }
    main { max-width: 1200px; margin: 0 auto; padding: 28px 16px 60px; }

    /* Section cards */
    .section {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      margin-bottom: 20px;
      overflow: hidden;
    }
    .section-header {
      padding: 14px 20px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-header h2 { font-size: 0.9rem; font-weight: 700; color: #2d3748; flex: 1; }
    .section-body { padding: 16px 20px; }

    /* Buttons */
    button, .btn {
      cursor: pointer;
      border: none;
      border-radius: 7px;
      padding: 8px 16px;
      font-size: 0.82rem;
      font-weight: 600;
      transition: background 0.15s, opacity 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: #0f3460; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #1a4a8a; }
    .btn-danger { background: #fff; color: #c53030; border: 1px solid #fc8181; }
    .btn-danger:hover:not(:disabled) { background: #fff5f5; }
    .btn-sm { padding: 4px 10px; font-size: 0.75rem; }
    .btn-del { background: #fff5f5; color: #c53030; border: 1px solid #fed7d7; padding: 3px 8px; font-size: 0.72rem; border-radius: 5px; cursor: pointer; }
    .btn-del:hover { background: #fed7d7; }

    /* Crawl section */
    .crawl-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .crawl-row input[type="url"] {
      flex: 1;
      min-width: 200px;
      border: 1px solid #cbd5e0;
      border-radius: 7px;
      padding: 8px 12px;
      font-size: 0.85rem;
      color: #2d3748;
      outline: none;
    }
    .crawl-row input[type="url"]:focus { border-color: #0f3460; box-shadow: 0 0 0 2px rgba(15,52,96,0.15); }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 12px 0; }

    /* Manual form */
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group.full { grid-column: 1 / -1; }
    label { font-size: 0.75rem; font-weight: 600; color: #4a5568; }
    input[type="text"], input[type="date"], input[type="url"].form-input, textarea {
      border: 1px solid #cbd5e0;
      border-radius: 7px;
      padding: 7px 11px;
      font-size: 0.85rem;
      color: #2d3748;
      outline: none;
      font-family: inherit;
    }
    input:focus, textarea:focus { border-color: #0f3460; box-shadow: 0 0 0 2px rgba(15,52,96,0.15); }
    textarea { resize: vertical; min-height: 60px; }
    .form-actions { margin-top: 12px; display: flex; justify-content: flex-end; }

    /* Table */
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 600px; }
    thead th {
      background: #f7fafc;
      padding: 10px 14px;
      text-align: left;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #718096;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    tbody tr { border-bottom: 1px solid #f0f4f8; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: #f7fafc; }
    tbody td { padding: 10px 14px; font-size: 0.85rem; vertical-align: middle; color: #2d3748; }
    tbody td.td-title { max-width: 380px; word-break: break-word; }
    tbody td a { color: #2b6cb0; text-decoration: none; }
    tbody td a:hover { text-decoration: underline; }
    tbody td.empty { text-align: center; color: #a0aec0; padding: 48px 16px; line-height: 1.7; }

    /* Status / count */
    .count-badge { background: #e2e8f0; color: #4a5568; font-size: 0.75rem; font-weight: 600; padding: 3px 10px; border-radius: 99px; }
    #status-bar { margin-top: 12px; font-size: 0.8rem; color: #718096; min-height: 18px; padding: 0 2px; }
    #status-bar.success { color: #276749; }
    #status-bar.error { color: #c53030; }
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #cbd5e0; border-top-color: #0f3460; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .summary-list { margin-top: 8px; font-size: 0.78rem; color: #718096; }
    .summary-list span { display: block; }
    .summary-list .err { color: #c53030; }
    .summary-list .ok { color: #276749; }
  </style>
</head>
<body>
  <header>
    <h1>PLAY강릉 SNS 백오피스</h1>
    <span class="badge">BACKOFFICE</span>
  </header>
  <main>

    <!-- Crawl Section -->
    <div class="section">
      <div class="section-header">
        <h2>크롤링</h2>
      </div>
      <div class="section-body">
        <div class="crawl-row">
          <input type="url" id="custom-url" placeholder="크롤링할 URL 입력 (예: https://www.gangneung.go.kr/...)" />
          <button class="btn-primary" id="btn-crawl-url" onclick="runCrawl(true)">URL 크롤링</button>
        </div>
        <hr class="divider" />
        <div class="crawl-row">
          <span style="flex:1; font-size:0.82rem; color:#718096;">기본 소스 일괄 크롤링: 강릉시청 공지사항, 강릉시청 행사정보, 강원도 행사/축제</span>
          <button class="btn-primary" id="btn-crawl-all" onclick="runCrawl(false)">전체 크롤링</button>
          <button class="btn-danger" id="btn-reset" onclick="resetData()">전체 초기화</button>
        </div>
        <div id="status-bar"></div>
        <div id="summary-list" class="summary-list"></div>
      </div>
    </div>

    <!-- Manual Register Section -->
    <div class="section">
      <div class="section-header">
        <h2>수동 등록</h2>
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
        <span class="count-badge" id="count-badge">총 ${events.length}건</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>제목</th>
              <th>출처</th>
              <th>행사일</th>
              <th>수집일시</th>
              <th></th>
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
    const statusBar = document.getElementById('status-bar');
    const summaryList = document.getElementById('summary-list');

    function setStatus(msg, type) {
      statusBar.textContent = msg;
      statusBar.className = type || '';
    }
    function setLoading(msg) {
      statusBar.innerHTML = '<span class="spinner"></span>' + msg;
      statusBar.className = '';
      summaryList.innerHTML = '';
    }

    async function runCrawl(customOnly) {
      const urlInput = document.getElementById('custom-url');
      const customUrl = urlInput.value.trim();

      if (customOnly && !customUrl) {
        setStatus('크롤링할 URL을 입력해 주세요.', 'error');
        return;
      }

      const btnAll = document.getElementById('btn-crawl-all');
      const btnUrl = document.getElementById('btn-crawl-url');
      btnAll.disabled = true;
      btnUrl.disabled = true;
      setLoading(customOnly ? 'URL 크롤링 중...' : '전체 크롤링 중...');

      try {
        const body = customOnly ? { url: customUrl } : {};
        const res = await fetch('/api/events/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          setStatus('완료: 신규 ' + data.added + '건 추가, 총 ' + data.total + '건 수집됨.', 'success');
          if (data.summary) {
            summaryList.innerHTML = data.summary.map(s =>
              s.error
                ? '<span class="err">✗ ' + s.source + ': ' + s.error + '</span>'
                : '<span class="ok">✓ ' + s.source + ': ' + s.collected + '건 수집</span>'
            ).join('');
          }
          setTimeout(() => location.reload(), 1200);
        } else {
          setStatus('오류: ' + (data.error || '알 수 없는 오류'), 'error');
        }
      } catch(e) {
        setStatus('요청 실패: ' + e.message, 'error');
      } finally {
        btnAll.disabled = false;
        btnUrl.disabled = false;
      }
    }

    async function resetData() {
      if (!confirm('수집된 데이터를 모두 초기화하시겠습니까?')) return;
      const btn = document.getElementById('btn-reset');
      btn.disabled = true;
      setLoading('초기화 중...');
      try {
        const res = await fetch('/api/events', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          setStatus('초기화 완료.', 'success');
          setTimeout(() => location.reload(), 600);
        } else {
          setStatus('오류: ' + (data.error || '알 수 없는 오류'), 'error');
        }
      } catch(e) {
        setStatus('요청 실패: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
      }
    }

    async function deleteEvent(id, btn) {
      btn.disabled = true;
      try {
        const res = await fetch('/api/events/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          const row = btn.closest('tr');
          row.style.transition = 'opacity 0.2s';
          row.style.opacity = '0';
          setTimeout(() => {
            row.remove();
            const badge = document.getElementById('count-badge');
            const cur = parseInt(badge.textContent.replace(/[^0-9]/g, '')) - 1;
            badge.textContent = '총 ' + cur + '건';
            if (document.querySelectorAll('#event-tbody tr').length === 0) {
              document.getElementById('event-tbody').innerHTML =
                '<tr><td colspan="5" class="empty">수집된 데이터가 없습니다.<br>아래에서 크롤링을 실행하거나 수동으로 등록해 주세요.</td></tr>';
            }
          }, 200);
        }
      } catch(e) {
        btn.disabled = false;
      }
    }

    async function submitManual(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-manual');
      const statusEl = document.getElementById('manual-status');
      btn.disabled = true;
      statusEl.textContent = '';

      const body = {
        title: document.getElementById('m-title').value.trim(),
        source: document.getElementById('m-source').value.trim(),
        date: document.getElementById('m-date').value,
        link: document.getElementById('m-link').value.trim(),
        description: document.getElementById('m-desc').value.trim(),
      };

      try {
        const res = await fetch('/api/events/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      } finally {
        btn.disabled = false;
      }
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
