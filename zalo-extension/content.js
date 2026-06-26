// OME Zalo AI Helper - content script for chat.zalo.me
(function () {
  'use strict';

  // ── CONFIG (saved in chrome.storage.local) ──
  let GAS_URL = '';
  let GEMINI_KEY = '';
  let _cache = { customers: null, orders: null, fetchedAt: 0 };
  let _activeTone = 'Thân thiện';
  let _currentPhone = '';
  let _currentCustData = null;
  let _cfgVisible = false;

  const CACHE_TTL = 5 * 60 * 1000; // 5 phút
  const CARE_STATUSES = [
    'Chưa liên hệ', 'Chưa sử dụng',
    'Hẹn gọi lại sau', 'Đang sd', 'Đang tạm ngưng',
    'Knm/Máy bận', 'Cúp ngang', 'Thuê bao',
    'Phân vân/Tiềm năng', 'Chốt',
    'Kcnc/Không hiệu quả', 'Đặt hộ/Sai số', 'Bầu'
  ];

  // ── BUILD PANEL ──
  function buildPanel() {
    if (document.getElementById('ome-zai-panel')) return;

    // Toggle button
    const toggle = document.createElement('button');
    toggle.id = 'ome-zai-toggle';
    toggle.title = 'OME Zalo AI';
    toggle.textContent = '🤖 AI';
    toggle.onclick = () => togglePanel();
    document.body.appendChild(toggle);

    // Main panel
    const panel = document.createElement('div');
    panel.id = 'ome-zai-panel';
    panel.innerHTML = `
      <div class="zai-hdr">
        <div>
          <div class="zai-hdr-title">🤖 OME Zalo AI</div>
          <div class="zai-hdr-sub">Tra cứu & gợi ý phản hồi khách</div>
        </div>
        <button class="zai-cfg-btn" id="zai-cfg-toggle" title="Cài đặt">⚙</button>
      </div>

      <!-- Config -->
      <div class="zai-cfg" id="zai-cfg" style="display:none">
        <label>URL Web App GAS (appweb teamduyen)</label>
        <input id="zai-gas-url" placeholder="https://script.google.com/macros/s/..." type="text">
        <label>Gemini API Key <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#00b14f;font-weight:normal">(Lấy miễn phí)</a></label>
        <input id="zai-gemini-key" placeholder="AIza..." type="password">
        <button class="zai-cfg-save" id="zai-cfg-save">💾 Lưu cài đặt</button>
      </div>

      <!-- Body -->
      <div class="zai-body" id="zai-body">
        <!-- Phone row -->
        <div>
          <div class="zai-section-label">Số điện thoại khách</div>
          <div class="zai-phone-row">
            <input id="zai-phone-input" placeholder="0901234567" type="tel">
            <button class="zai-btn zai-btn-primary zai-btn-sm" id="zai-lookup-btn" onclick="window._zaiLookup()">Tra cứu</button>
          </div>
          <div style="font-size:10px;color:#9ca3af;margin-top:3px" id="zai-auto-hint"></div>
        </div>

        <!-- Customer card -->
        <div id="zai-cust-area"></div>

        <!-- Care status update -->
        <div class="zai-update-section" id="zai-update-section" style="display:none">
          <div class="zai-section-label" style="margin-bottom:6px">📋 Cập nhật tình trạng CS</div>
          <label>Tình trạng</label>
          <select id="zai-status-sel">
            <option value="">— Chọn —</option>
            ${CARE_STATUSES.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
          <label>Ghi chú</label>
          <textarea id="zai-note-ta" placeholder="Ghi chú thêm..." rows="2"></textarea>
          <div class="zai-save-row">
            <button class="zai-btn zai-btn-primary zai-btn-sm" id="zai-save-btn" onclick="window._zaiSaveStatus()">💾 Lưu về GSheet</button>
            <span class="zai-save-status" id="zai-save-status"></span>
          </div>
        </div>

        <hr class="zai-div">

        <!-- Message + AI -->
        <div>
          <div class="zai-section-label">Tin nhắn khách (copy từ Zalo)</div>
          <textarea class="zai-msg-area" id="zai-msg" placeholder="Dán tin nhắn của khách vào đây..."></textarea>
          <div style="margin-top:5px;font-size:11px;color:#6b7280">Ngữ cảnh / Sản phẩm (tuỳ chọn)</div>
          <input class="zai-ctx-input" id="zai-ctx" placeholder="VD: Đang tư vấn kem dưỡng, khách hỏi về giá...">
          <div class="zai-tones" id="zai-tones" style="margin-top:8px">
            <button class="zai-tone" data-tone="Thân thiện" onclick="window._zaiTone(this)">Thân thiện</button>
            <button class="zai-tone" data-tone="Chuyên nghiệp" onclick="window._zaiTone(this)">Chuyên nghiệp</button>
            <button class="zai-tone" data-tone="Ngắn gọn" onclick="window._zaiTone(this)">Ngắn gọn</button>
            <button class="zai-tone" data-tone="Nhiệt tình" onclick="window._zaiTone(this)">Nhiệt tình</button>
          </div>
          <button class="zai-btn zai-btn-primary" id="zai-gen-btn" onclick="window._zaiGenerate()" style="width:100%;margin-top:8px">✨ Tạo gợi ý AI</button>
        </div>

        <!-- Suggestions -->
        <div id="zai-sug-area"></div>

        <!-- Error -->
        <div class="zai-error" id="zai-error" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(panel);

    // Set default tone
    setTone('Thân thiện');

    // Config toggle
    document.getElementById('zai-cfg-toggle').onclick = () => {
      _cfgVisible = !_cfgVisible;
      document.getElementById('zai-cfg').style.display = _cfgVisible ? 'block' : 'none';
    };

    // Save config
    document.getElementById('zai-cfg-save').onclick = saveConfig;

    // Load saved config
    chrome.storage.local.get(['ome_gas_url', 'ome_gemini_key'], (res) => {
      GAS_URL = res.ome_gas_url || '';
      GEMINI_KEY = res.ome_gemini_key || '';
      if (GAS_URL) document.getElementById('zai-gas-url').value = GAS_URL;
      if (GEMINI_KEY) document.getElementById('zai-gemini-key').value = GEMINI_KEY;
      if (!GAS_URL || !GEMINI_KEY) {
        _cfgVisible = true;
        document.getElementById('zai-cfg').style.display = 'block';
      }
    });
  }

  function togglePanel() {
    const panel = document.getElementById('ome-zai-panel');
    const btn = document.getElementById('ome-zai-toggle');
    if (!panel) return;
    panel.classList.toggle('open');
    btn.classList.toggle('shifted');
  }

  function saveConfig() {
    GAS_URL = document.getElementById('zai-gas-url').value.trim();
    GEMINI_KEY = document.getElementById('zai-gemini-key').value.trim();
    chrome.storage.local.set({ ome_gas_url: GAS_URL, ome_gemini_key: GEMINI_KEY });
    _cfgVisible = false;
    document.getElementById('zai-cfg').style.display = 'none';
    showMsg('zai-save-status', '✓ Đã lưu', 2000);
    _cache = { customers: null, orders: null, fetchedAt: 0 };
  }

  // ── AUTO-DETECT PHONE FROM ZALO CHAT ──
  function extractPhone(text) {
    if (!text) return null;
    const m = text.match(/(?:^|\D)(0[3-9]\d{8})(?:\D|$)/);
    return m ? m[1] : null;
  }

  function watchZaloChat() {
    const observer = new MutationObserver(() => {
      const nameEl = document.querySelector(
        '[class*="chat-header"] [class*="name"], [class*="conversation-header"] [class*="name"], ' +
        '[class*="title-chat"] span, [class*="header-chat"] [class*="title"]'
      );
      if (!nameEl) return;
      const name = nameEl.textContent || '';
      const phone = extractPhone(name);
      if (phone && phone !== _currentPhone) {
        _currentPhone = phone;
        const inp = document.getElementById('zai-phone-input');
        if (inp) {
          inp.value = phone;
          const hint = document.getElementById('zai-auto-hint');
          if (hint) hint.textContent = '✓ Tự động phát hiện từ tên chat: ' + name.trim();
          window._zaiLookup();
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── DATA FETCHING ──
  async function fetchAllData() {
    if (!GAS_URL) throw new Error('Chưa cài đặt URL GAS. Nhấn ⚙ để cài đặt.');
    const now = Date.now();
    if (_cache.customers && _cache.orders && now - _cache.fetchedAt < CACHE_TTL) {
      return _cache;
    }
    const sep = GAS_URL.includes('?') ? '&' : '?';
    const [custRes, ordRes] = await Promise.all([
      fetch(GAS_URL + sep + 'action=customers', { redirect: 'follow' }),
      fetch(GAS_URL + sep + 'action=orders', { redirect: 'follow' })
    ]);
    const custData = await custRes.json();
    const ordData = await ordRes.json();

    const custMap = {};
    (custData.rows || []).forEach(r => { if (r.phone) custMap[normPhone(r.phone)] = r; });

    const ordMap = {};
    (ordData.orders || []).forEach(o => {
      const p = normPhone(o.phone);
      if (!p) return;
      if (!ordMap[p]) ordMap[p] = [];
      ordMap[p].push(o);
    });

    _cache = { customers: custMap, orders: ordMap, fetchedAt: Date.now() };
    return _cache;
  }

  function normPhone(p) {
    if (!p) return '';
    let s = String(p).replace(/\D/g, '');
    if (s.startsWith('84') && s.length === 11) s = '0' + s.slice(2);
    return s;
  }

  // ── LOOKUP ──
  window._zaiLookup = async function () {
    const raw = (document.getElementById('zai-phone-input').value || '').trim();
    if (!raw) { showError('Vui lòng nhập số điện thoại.'); return; }
    hideError();
    const phone = normPhone(raw);
    const area = document.getElementById('zai-cust-area');
    const updateSec = document.getElementById('zai-update-section');
    area.innerHTML = '<div class="zai-loading"><div class="zai-spinner"></div>Đang tra cứu...</div>';
    updateSec.style.display = 'none';
    _currentCustData = null;
    try {
      const data = await fetchAllData();
      const care = data.customers[phone];
      const orders = (data.orders[phone] || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

      if (!care && !orders.length) {
        area.innerHTML = `<div class="zai-not-found">Không tìm thấy <strong>${raw}</strong> trong dữ liệu.<br><small>Thử Sync GS trên app trước.</small></div>`;
        return;
      }

      const name = orders.length ? (orders[0].name || raw) : raw;
      const products = [...new Set(orders.map(o => o.product).filter(Boolean))].join(', ');
      const totalRev = orders.reduce((s, o) => s + (parseFloat(o.revenue) || 0), 0);
      const last3 = orders.slice(0, 3);

      _currentCustData = { phone, name, care, orders };

      area.innerHTML = `
        <div class="zai-card">
          <div class="zai-card-name">${escHtml(name)} <span style="font-size:11px;font-weight:400;color:#9ca3af">${raw}</span></div>
          <div class="zai-chips">
            ${orders.length ? `<span class="zai-chip">📦 ${orders.length} đơn</span>` : ''}
            ${totalRev ? `<span class="zai-chip">💰 ${Math.round(totalRev / 1000)}K</span>` : ''}
            ${products ? `<span class="zai-chip">🏷 ${escHtml(products)}</span>` : ''}
            ${care && care.status ? `<span class="zai-chip">📋 ${escHtml(care.status)}</span>` : ''}
            ${care && care.cs ? `<span class="zai-chip">👤 CS: ${escHtml(care.cs)}</span>` : ''}
          </div>
          ${care && care.note ? `<div class="zai-card-note">📝 ${escHtml(care.note)}</div>` : ''}
          ${last3.length ? `
            <div class="zai-card-orders">
              <strong>Đơn gần nhất:</strong><br>
              ${last3.map(o => {
                const d = o.date ? new Date(o.date).toLocaleDateString('vi-VN') : '?';
                return `• ${d} — ${escHtml(o.product || o.productDetail || '?')}${o.revenue ? ' (' + Number(o.revenue).toLocaleString('vi-VN') + 'đ)' : ''}`;
              }).join('<br>')}
            </div>` : ''}
        </div>
      `;

      updateSec.style.display = 'block';
      if (care && care.status) document.getElementById('zai-status-sel').value = care.status;
      if (care && care.note) document.getElementById('zai-note-ta').value = care.note;
    } catch (e) {
      area.innerHTML = '';
      showError(e.message);
    }
  };

  // ── SAVE STATUS BACK TO GAS ──
  window._zaiSaveStatus = async function () {
    if (!_currentCustData) { showError('Chưa tra cứu khách nào.'); return; }
    if (!GAS_URL) { showError('Chưa cài đặt URL GAS.'); return; }
    const status = document.getElementById('zai-status-sel').value;
    const note = document.getElementById('zai-note-ta').value;
    const btn = document.getElementById('zai-save-btn');
    btn.disabled = true;
    btn.textContent = 'Đang lưu...';
    try {
      const care = _currentCustData.care || {};
      const row = {
        phone: _currentCustData.phone,
        status: status || care.status || '',
        zalo: care.zalo || '',
        cs: care.cs || '',
        note,
        schedules: care.schedules || '',
        schedGoi: care.schedGoi || '',
        schedGoiNote: care.schedGoiNote || '',
        schedSP: care.schedSP || '',
        schedSPNote: care.schedSPNote || '',
        schedCS: care.schedCS || '',
        schedCSNote: care.schedCSNote || '',
        schedHen: care.schedHen || '',
        schedHenNote: care.schedHenNote || ''
      };
      const res = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'saveSingle', row }),
        headers: { 'Content-Type': 'text/plain' }
      });
      const d = await res.json();
      if (d.ok) {
        showMsg('zai-save-status', '✓ Đã lưu lên GSheet!', 3000);
        if (_cache.customers) _cache.customers[_currentCustData.phone] = { ...care, status, note };
      } else {
        showError('Lỗi lưu: ' + JSON.stringify(d));
      }
    } catch (e) {
      showError('Lỗi kết nối GAS: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '💾 Lưu về GSheet';
    }
  };

  // ── AI GENERATE ──
  window._zaiGenerate = async function () {
    if (!GEMINI_KEY) { showError('Chưa cài đặt Gemini API Key. Nhấn ⚙.'); return; }
    const msg = (document.getElementById('zai-msg').value || '').trim();
    if (!msg) { showError('Vui lòng dán tin nhắn của khách.'); return; }
    const ctx = (document.getElementById('zai-ctx').value || '').trim();
    const btn = document.getElementById('zai-gen-btn');
    const sugArea = document.getElementById('zai-sug-area');
    hideError();
    btn.disabled = true;
    btn.textContent = 'AI đang soạn...';
    sugArea.innerHTML = '<div class="zai-loading"><div class="zai-spinner"></div>Đang tạo gợi ý...</div>';

    let custLines = [];
    if (_currentCustData) {
      const { name, phone, care, orders } = _currentCustData;
      custLines.push('Tên khách: ' + name);
      custLines.push('SĐT: ' + phone);
      if (orders && orders.length) custLines.push('Số đơn đã mua: ' + orders.length);
      const prods = [...new Set((orders || []).map(o => o.product).filter(Boolean))].join(', ');
      if (prods) custLines.push('Sản phẩm đã mua: ' + prods);
      if (care && care.status) custLines.push('Tình trạng CS hiện tại: ' + care.status);
      if (care && care.note) custLines.push('Ghi chú CS: ' + care.note);
      const last = (orders || []).slice(0, 2).map(o => {
        const d = o.date ? new Date(o.date).toLocaleDateString('vi-VN') : '';
        return `${d} ${o.product || ''} ${o.revenue ? '(' + Number(o.revenue).toLocaleString('vi-VN') + 'đ)' : ''}`.trim();
      }).join(', ');
      if (last) custLines.push('Đơn gần nhất: ' + last);
    }
    if (ctx) custLines.push('Ngữ cảnh bổ sung: ' + ctx);

    const prompt = `Bạn là nhân viên chăm sóc khách hàng chuyên nghiệp của shop bán lẻ Việt Nam.
${custLines.length ? 'Thông tin khách hàng:\n' + custLines.join('\n') + '\n' : ''}
Tin nhắn khách gửi: "${msg}"

Hãy viết 3 phiên bản phản hồi cho khách, giọng văn ${_activeTone.toLowerCase()}, bằng tiếng Việt tự nhiên, phù hợp nhắn qua Zalo.
Mỗi phiên bản trên 1 dòng riêng, bắt đầu bằng "1.", "2.", "3.". Không giải thích thêm.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 800 }
          })
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err.error && err.error.message) || 'HTTP ' + res.status);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const sugs = text.split(/\n(?=\d+\.)/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      if (!sugs.length) sugs.push(text.trim());

      sugArea.innerHTML = `
        <div class="zai-section-label">💡 Gợi ý phản hồi (click để copy)</div>
        ${sugs.map((s, i) => `
          <div class="zai-sug" onclick="window._zaiCopy(this,'${encodeURIComponent(s)}')">
            <div class="zai-sug-num">Phương án ${i + 1}</div>
            <div>${escHtml(s).replace(/\n/g, '<br>')}</div>
            <span class="zai-copy-badge">Copy</span>
          </div>
        `).join('')}
      `;
    } catch (e) {
      sugArea.innerHTML = '';
      showError('Lỗi Gemini: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Tạo gợi ý AI';
    }
  };

  window._zaiCopy = function (el, encoded) {
    const text = decodeURIComponent(encoded);
    navigator.clipboard.writeText(text).then(() => {
      const badge = el.querySelector('.zai-copy-badge');
      if (badge) { badge.textContent = '✓ Đã copy!'; badge.classList.add('zai-copied'); }
      setTimeout(() => {
        if (badge) { badge.textContent = 'Copy'; badge.classList.remove('zai-copied'); }
      }, 1500);
    });
  };

  window._zaiTone = function (btn) {
    document.querySelectorAll('.zai-tone').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activeTone = btn.dataset.tone;
  };

  function setTone(tone) {
    document.querySelectorAll('.zai-tone').forEach(b => {
      b.classList.toggle('active', b.dataset.tone === tone);
    });
    _activeTone = tone;
  }

  function showError(msg) {
    const el = document.getElementById('zai-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }
  function hideError() {
    const el = document.getElementById('zai-error');
    if (el) el.style.display = 'none';
  }
  function showMsg(id, msg, ms) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    if (ms) setTimeout(() => { el.textContent = ''; }, ms);
  }
  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function init() {
    buildPanel();
    watchZaloChat();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
