import { compareCells, detectDelimiter, encodeCSV, filterRows, inferColumnType, normalizeTable, parseCSV } from './csv.js';

const $ = (selector) => document.querySelector(selector);
const el = Object.fromEntries([
  'welcome', 'workspace', 'dropzone', 'file-input', 'open-button', 'export-button', 'theme-button', 'sample-button', 'filename', 'file-meta', 'row-count', 'column-count', 'delimiter-label', 'visible-count', 'search-input', 'delimiter-select', 'columns-button', 'columns-panel', 'columns-list', 'all-columns', 'page-size', 'table-head', 'table-body', 'empty-state', 'range-label', 'page-label', 'prev-page', 'next-page', 'close-button', 'toast', 'filter-button', 'filter-count', 'filter-panel', 'filter-column', 'filter-operator', 'filter-value-wrap', 'filter-value', 'filter-value2-wrap', 'filter-value2', 'add-filter', 'clear-filters', 'filter-chips',
].map((id) => [id.replaceAll('-', '_'), $(`#${id}`)]));

const state = { rawText: '', filename: '', delimiter: ',', headers: [], rows: [], filtered: [], visible: new Set(), columnTypes: [], filters: [], query: '', sort: null, direction: 1, page: 1, pageSize: 50 };
let toastTimer;
const delimiterNames = { ',': 'Comma', '\t': 'Tab', ';': 'Semicolon', '|': 'Pipe' };
const operators = {
  text: [['contains', '포함'], ['not_contains', '포함하지 않음'], ['eq', '같음'], ['neq', '같지 않음'], ['starts', '시작 문자'], ['ends', '끝 문자'], ['empty', '비어 있음'], ['not_empty', '비어 있지 않음']],
  number: [['eq', '='], ['neq', '≠'], ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['between', '범위'], ['empty', '비어 있음'], ['not_empty', '비어 있지 않음']],
  date: [['on', '해당 날짜'], ['before', '이전'], ['after', '이후'], ['between', '기간'], ['empty', '비어 있음'], ['not_empty', '비어 있지 않음']],
};
const operatorLabels = Object.fromEntries(Object.values(operators).flat());
const sample = `Order ID,Date,Customer,Region,Product,Category,Quantity,Unit Price,Status
BR-1048,2026-07-28,김하늘,서울,Wireless Keyboard,Accessories,2,59000,배송 완료
BR-1049,2026-07-29,Alex Kim,부산,27-inch Monitor,Displays,1,329000,배송 중
BR-1050,2026-07-30,박서준,대전,USB-C Hub,Accessories,3,45000,결제 완료
BR-1051,2026-07-31,이수민,서울,"Desk, Walnut",Furniture,1,218000,준비 중
BR-1052,2026-08-01,Jamie Lee,인천,Mechanical Mouse,Accessories,2,74000,배송 완료
BR-1053,2026-08-02,최유진,광주,Laptop Stand,Furniture,4,38000,배송 중
BR-1054,2026-08-03,윤지호,대구,Webcam Pro,Cameras,1,129000,결제 완료`;

function showToast(message) {
  el.toast.textContent = message; el.toast.classList.add('visible'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('visible'), 2200);
}

function decodeFile(buffer) {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementRatio = (utf8.match(/\uFFFD/g) || []).length / Math.max(1, utf8.length);
  if (replacementRatio < 0.002) return { text: utf8, encoding: 'UTF-8' };
  try { return { text: new TextDecoder('euc-kr').decode(bytes), encoding: 'EUC-KR' }; }
  catch { return { text: utf8, encoding: 'UTF-8' }; }
}

function loadText(text, filename, encoding = 'UTF-8', forcedDelimiter) {
  state.rawText = text; state.filename = filename; state.delimiter = forcedDelimiter || detectDelimiter(text);
  const table = normalizeTable(parseCSV(text, state.delimiter));
  if (!table.headers.length) { showToast('표시할 데이터가 없습니다.'); return; }
  state.headers = table.headers; state.rows = table.rows; state.visible = new Set(table.headers.map((_, i) => i)); state.columnTypes = table.headers.map((_, index) => inferColumnType(table.rows, index));
  state.query = ''; state.filters = []; state.sort = null; state.direction = 1; state.page = 1;
  el.search_input.value = ''; el.filename.textContent = filename;
  el.file_meta.textContent = `${encoding} · ${new Blob([text]).size.toLocaleString()} bytes · 브라우저에서만 처리됨`;
  el.delimiter_select.value = state.delimiter === '\t' ? 'tab' : state.delimiter;
  el.welcome.hidden = true; el.workspace.hidden = false; el.export_button.disabled = false;
  buildColumnPanel(); buildFilterBuilder(); renderFilterChips(); applyView();
}

async function loadFile(file) {
  if (!file || !/\.(csv|tsv|txt)$/i.test(file.name)) { showToast('CSV 또는 TSV 파일을 선택해 주세요.'); return; }
  try { const decoded = decodeFile(await file.arrayBuffer()); loadText(decoded.text, file.name, decoded.encoding); }
  catch { showToast('파일을 읽지 못했습니다.'); }
}

function buildColumnPanel() {
  el.columns_list.replaceChildren(...state.headers.map((header, index) => {
    const label = document.createElement('label'); const input = document.createElement('input');
    input.type = 'checkbox'; input.checked = state.visible.has(index); input.addEventListener('change', () => {
      if (input.checked) state.visible.add(index); else if (state.visible.size > 1) state.visible.delete(index); else { input.checked = true; showToast('열을 하나 이상 표시해야 합니다.'); }
      render();
    });
    label.append(input, document.createTextNode(header)); return label;
  }));
}

function buildFilterBuilder() {
  const typeLabels = { text: '텍스트', number: '숫자', date: '날짜' };
  el.filter_column.replaceChildren(...state.headers.map((header, index) => {
    const option = document.createElement('option'); option.value = String(index); option.textContent = `${header} · ${typeLabels[state.columnTypes[index]]}`; return option;
  }));
  updateFilterOperators();
}

function updateFilterOperators() {
  const column = Number(el.filter_column.value || 0); const type = state.columnTypes[column] || 'text';
  el.filter_operator.replaceChildren(...operators[type].map(([value, label]) => {
    const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
  }));
  el.filter_value.type = type === 'date' ? 'date' : type === 'number' ? 'number' : 'text';
  el.filter_value2.type = el.filter_value.type; updateFilterValueFields();
}

function updateFilterValueFields() {
  const operator = el.filter_operator.value; const noValue = operator === 'empty' || operator === 'not_empty'; const between = operator === 'between';
  el.filter_value_wrap.hidden = noValue; el.filter_value2_wrap.hidden = !between;
  el.filter_value_wrap.firstChild.textContent = between ? (state.columnTypes[Number(el.filter_column.value)] === 'date' ? '시작일' : '최솟값') : '값';
}

function addFilter() {
  const column = Number(el.filter_column.value); const operator = el.filter_operator.value; const noValue = operator === 'empty' || operator === 'not_empty';
  const value = el.filter_value.value.trim(); const value2 = el.filter_value2.value.trim();
  if (!noValue && !value) { showToast('필터 값을 입력해 주세요.'); el.filter_value.focus(); return; }
  if (operator === 'between' && !value2) { showToast('범위의 끝 값을 입력해 주세요.'); el.filter_value2.focus(); return; }
  state.filters.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, column, type: state.columnTypes[column], operator, value, value2 });
  el.filter_value.value = ''; el.filter_value2.value = ''; state.page = 1; renderFilterChips(); applyView();
}

function removeFilter(id) { state.filters = state.filters.filter((filter) => filter.id !== id); state.page = 1; renderFilterChips(); applyView(); }

function renderFilterChips() {
  el.filter_chips.replaceChildren(...state.filters.map((filter) => {
    const chip = document.createElement('span'); chip.className = 'filter-chip';
    const column = document.createElement('b'); column.textContent = state.headers[filter.column];
    const description = document.createElement('span');
    const values = filter.operator === 'between' ? `${filter.value} – ${filter.value2}` : (filter.operator === 'empty' || filter.operator === 'not_empty' ? '' : filter.value);
    description.textContent = `${operatorLabels[filter.operator]}${values ? ` ${values}` : ''}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `${state.headers[filter.column]} 필터 제거`); remove.addEventListener('click', () => removeFilter(filter.id));
    chip.append(column, description, remove); return chip;
  }));
  el.filter_count.textContent = String(state.filters.length); el.filter_count.hidden = state.filters.length === 0;
  el.clear_filters.disabled = state.filters.length === 0;
}

function applyView() {
  const needle = state.query.toLocaleLowerCase();
  const matchingRows = filterRows(state.rows, state.filters);
  const allowed = new Set(matchingRows);
  state.filtered = state.rows.map((row, originalIndex) => ({ row, originalIndex })).filter(({ row }) => allowed.has(row) && (!needle || row.some((cell) => cell.toLocaleLowerCase().includes(needle))));
  if (state.sort !== null) {
    state.filtered.sort((a, b) => (compareCells(a.row[state.sort], b.row[state.sort]) || a.originalIndex - b.originalIndex) * state.direction);
  }
  const pages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize)); state.page = Math.min(state.page, pages); render();
}

function render() {
  const visibleIndexes = [...state.visible];
  const headRow = document.createElement('tr'); const numberHead = document.createElement('th'); numberHead.className = 'row-number'; numberHead.textContent = '#'; headRow.append(numberHead);
  visibleIndexes.forEach((index) => {
    const th = document.createElement('th'); const button = document.createElement('button'); const label = document.createElement('span'); const icon = document.createElement('span');
    label.textContent = state.headers[index]; icon.className = 'sort-icon'; icon.textContent = state.sort === index ? (state.direction === 1 ? '↑' : '↓') : '↕';
    button.append(label, icon); button.title = `${state.headers[index]} 열 정렬`; button.addEventListener('click', () => sortBy(index)); th.append(button); headRow.append(th);
  });
  el.table_head.replaceChildren(headRow);
  const start = (state.page - 1) * state.pageSize; const pageRows = state.filtered.slice(start, start + state.pageSize);
  el.table_body.replaceChildren(...pageRows.map(({ row, originalIndex }) => {
    const tr = document.createElement('tr'); const number = document.createElement('td'); number.className = 'row-number'; number.textContent = originalIndex + 1; tr.append(number);
    visibleIndexes.forEach((index) => { const td = document.createElement('td'); td.textContent = row[index]; td.title = row[index]; tr.append(td); }); return tr;
  }));
  const total = state.filtered.length; const end = Math.min(start + state.pageSize, total); const pages = Math.max(1, Math.ceil(total / state.pageSize));
  el.row_count.textContent = state.rows.length.toLocaleString(); el.column_count.textContent = state.headers.length.toLocaleString();
  el.delimiter_label.textContent = delimiterNames[state.delimiter]; el.visible_count.textContent = total.toLocaleString();
  el.range_label.textContent = total ? `${(start + 1).toLocaleString()}–${end.toLocaleString()} / ${total.toLocaleString()}개 행` : '0개 행'; el.page_label.textContent = `${state.page} / ${pages}`;
  el.prev_page.disabled = state.page <= 1; el.next_page.disabled = state.page >= pages; el.empty_state.hidden = total > 0; el.table_body.hidden = total === 0;
}

function sortBy(index) { if (state.sort === index) state.direction *= -1; else { state.sort = index; state.direction = 1; } state.page = 1; applyView(); }
function closeFile() { state.rawText = ''; state.filters = []; el.workspace.hidden = true; el.welcome.hidden = false; el.export_button.disabled = true; el.file_input.value = ''; }
function exportResults() {
  const indexes = [...state.visible]; const headers = indexes.map((i) => state.headers[i]); const rows = state.filtered.map(({ row }) => indexes.map((i) => row[i]));
  const blob = new Blob(['\uFEFF', encodeCSV(headers, rows)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `${state.filename.replace(/\.[^.]+$/, '')}-filtered.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); showToast(`${rows.length.toLocaleString()}개 행을 저장했습니다.`);
}
function setTheme(theme) { document.documentElement.dataset.theme = theme; localStorage.setItem('utils-theme', theme); el.theme_button.textContent = theme === 'dark' ? '☀' : '☾'; el.theme_button.setAttribute('aria-label', theme === 'dark' ? '라이트 테마 사용' : '다크 테마 사용'); }

el.open_button.addEventListener('click', () => el.file_input.click()); el.dropzone.addEventListener('click', () => el.file_input.click());
el.dropzone.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') el.file_input.click(); });
el.file_input.addEventListener('change', () => loadFile(el.file_input.files[0]));
['dragenter', 'dragover'].forEach((name) => el.dropzone.addEventListener(name, (event) => { event.preventDefault(); el.dropzone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((name) => el.dropzone.addEventListener(name, (event) => { event.preventDefault(); el.dropzone.classList.remove('dragging'); }));
el.dropzone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0])); el.sample_button.addEventListener('click', () => loadText(sample, 'sample-orders.csv'));
el.search_input.addEventListener('input', () => { state.query = el.search_input.value.trim(); state.page = 1; applyView(); });
el.delimiter_select.addEventListener('change', () => { const value = el.delimiter_select.value; loadText(state.rawText, state.filename, '재해석됨', value === 'auto' ? detectDelimiter(state.rawText) : value === 'tab' ? '\t' : value); });
el.page_size.addEventListener('change', () => { state.pageSize = Number(el.page_size.value); state.page = 1; render(); });
el.prev_page.addEventListener('click', () => { state.page -= 1; render(); }); el.next_page.addEventListener('click', () => { state.page += 1; render(); });
el.columns_button.addEventListener('click', () => { el.columns_panel.hidden = !el.columns_panel.hidden; el.columns_button.setAttribute('aria-expanded', String(!el.columns_panel.hidden)); });
el.all_columns.addEventListener('click', () => { state.visible = new Set(state.headers.map((_, i) => i)); buildColumnPanel(); render(); });
el.filter_button.addEventListener('click', () => { el.filter_panel.hidden = !el.filter_panel.hidden; el.filter_button.setAttribute('aria-expanded', String(!el.filter_panel.hidden)); });
el.filter_column.addEventListener('change', updateFilterOperators); el.filter_operator.addEventListener('change', updateFilterValueFields); el.add_filter.addEventListener('click', addFilter);
el.filter_value.addEventListener('keydown', (event) => { if (event.key === 'Enter' && el.filter_value2_wrap.hidden) addFilter(); }); el.filter_value2.addEventListener('keydown', (event) => { if (event.key === 'Enter') addFilter(); });
el.clear_filters.addEventListener('click', () => { state.filters = []; state.page = 1; renderFilterChips(); applyView(); });
el.close_button.addEventListener('click', closeFile); el.export_button.addEventListener('click', exportResults); el.theme_button.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !el.workspace.hidden) { event.preventDefault(); el.search_input.focus(); } if (event.key === 'Escape') { el.columns_panel.hidden = true; el.filter_panel.hidden = true; } });
document.addEventListener('click', (event) => { if (!el.columns_panel.hidden && !el.columns_panel.contains(event.target) && event.target !== el.columns_button) el.columns_panel.hidden = true; });
setTheme(localStorage.getItem('utils-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
