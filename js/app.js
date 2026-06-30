// ==================== 常量 ====================
const CATEGORIES = {
  silicone: { id: 'silicone', name: '硅酮密封胶', color: '#3b82f6' },
  butyl: { id: 'butyl', name: '丁基橡胶', color: '#10b981' },
  primer: { id: 'primer', name: '底涂剂', color: '#f59e0b' },
  ms: { id: 'ms', name: '改性硅烷MS胶', color: '#8b5cf6' },
  instant: { id: 'instant', name: '瞬干胶', color: '#ef4444' },
  'pu-two': { id: 'pu-two', name: '聚氨酯胶-双组份', color: '#06b6d4' },
  'pu-one': { id: 'pu-one', name: '聚氨酯胶-单组份', color: '#ec4899' },
  polysulfide: { id: 'polysulfide', name: '聚硫胶', color: '#6366f1' }
};

const REPORT_TYPES = {
  tds: { id: 'tds', name: 'TDS技术数据表' },
  msds: { id: 'msds', name: 'MSDS安全数据表' },
  fire: { id: 'fire', name: '防火测试报告' },
  environment: { id: 'environment', name: '环保检测报告' },
  mechanical: { id: 'mechanical', name: '力学性能报告' },
  aging: { id: 'aging', name: '老化测试报告' },
  supplier: { id: 'supplier', name: '供应商资质证书' },
  other: { id: 'other', name: '其他' }
};

const REPORT_TYPE_ORDER = ['tds','msds','fire','environment','mechanical','aging','supplier','other'];

// ==================== 状态 ====================
let state = {
  category: 'all',
  search: '',
  detailId: null,
  activeTab: null
};

// ==================== 初始化 ====================
function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  updateStats();
  renderCategoryNav();
  bindEvents();
  handleRoute();
}

function updateStats() {
  const totalProducts = ADHESIVES.length;
  const totalReports = ADHESIVES.reduce((sum, a) => sum + (a.reports?.length || 0), 0);
  document.getElementById('total-products').textContent = totalProducts;
  document.getElementById('total-reports').textContent = totalReports;
}

function renderCategoryNav() {
  const nav = document.getElementById('category-nav');
  nav.innerHTML = '';

  const allCount = ADHESIVES.length;
  nav.appendChild(createCatLink('all', '全部', allCount, state.category === 'all'));

  for (const cat of Object.values(CATEGORIES)) {
    const count = ADHESIVES.filter(a => a.category === cat.id).length;
    if (count > 0) {
      nav.appendChild(createCatLink(cat.id, cat.name, count, state.category === cat.id));
    }
  }
}

function createCatLink(id, name, count, active) {
  const a = document.createElement('a');
  a.href = '#' + (id === 'all' ? '' : 'cat=' + id);
  a.dataset.cat = id;
  if (active) a.classList.add('active');
  a.innerHTML = name + '<span class="count">' + count + '</span>';
  return a;
}

function bindEvents() {
  window.addEventListener('hashchange', handleRoute);

  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');

  searchInput.addEventListener('input', e => {
    state.search = e.target.value.trim().toLowerCase();
    if (!state.detailId) renderHome();
  });

  searchBtn.addEventListener('click', () => {
    state.search = searchInput.value.trim().toLowerCase();
    if (!state.detailId) renderHome();
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('pdf-modal').querySelector('.modal-overlay').addEventListener('click', closeModal);
}

// ==================== 路由 ====================
function handleRoute() {
  const hash = location.hash.slice(1);
  const params = new URLSearchParams(hash);

  state.detailId = params.get('id') || null;
  state.category = params.get('cat') || 'all';

  if (state.detailId) {
    renderDetail(state.detailId);
  } else {
    renderHome();
  }

  renderCategoryNav();
}

// ==================== 首页 ====================
function renderHome() {
  const main = document.getElementById('main-content');
  const filtered = filterProducts();

  if (filtered.length === 0) {
    main.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><h3>未找到匹配的产品</h3><p>请尝试其他关键词</p></div>';
    return;
  }

  let html = '<h2 class="page-title">' + getPageTitle() + '</h2>';
  html += '<div class="products-grid">';

  for (const p of filtered) {
    const cat = CATEGORIES[p.category];
    const reportCount = p.reports?.length || 0;
    const typeCount = new Set(p.reports?.map(r => r.type) || []).size;

    html += '<a class="product-card" href="#id=' + p.id + '">';
    html += '<span class="cat-tag" style="background:' + (cat?.color || '#999') + '15;color:' + (cat?.color || '#999') + '">' + (cat?.name || p.category) + '</span>';
    html += '<div class="brand">' + escapeHtml(p.brand) + '</div>';
    html += '<div class="model">' + escapeHtml(p.model) + '</div>';
    html += '<div class="fullname">' + escapeHtml(p.fullName) + '</div>';
    html += '<div class="stats">';
    html += '<span><strong>' + reportCount + '</strong> 份报告</span>';
    html += '<span><strong>' + typeCount + '</strong> 种类型</span>';
    html += '</div></a>';
  }

  html += '</div>';
  main.innerHTML = html;
}

function getPageTitle() {
  if (state.search) return '搜索: "' + escapeHtml(state.search) + '"';
  if (state.category !== 'all') return CATEGORIES[state.category]?.name || '全部产品';
  return '全部产品 (' + ADHESIVES.length + ')';
}

function filterProducts() {
  return ADHESIVES.filter(p => {
    if (state.category !== 'all' && p.category !== state.category) return false;
    if (!state.search) return true;
    const q = state.search;
    return (p.brand && p.brand.toLowerCase().includes(q)) ||
           (p.model && p.model.toLowerCase().includes(q)) ||
           (p.fullName && p.fullName.toLowerCase().includes(q));
  });
}

// ==================== 详情页 ====================
function renderDetail(id) {
  const product = ADHESIVES.find(a => a.id === id);
  const main = document.getElementById('main-content');

  if (!product) {
    main.innerHTML = '<div class="empty"><div class="empty-icon">❓</div><h3>产品不存在</h3></div>';
    return;
  }

  const cat = CATEGORIES[product.category];
  const reports = product.reports || [];

  // 默认选中第一个有数据的标签
  const typesWithData = REPORT_TYPE_ORDER.filter(t => reports.some(r => r.type === t));
  if (!state.activeTab || !typesWithData.includes(state.activeTab)) {
    state.activeTab = typesWithData[0] || 'tds';
  }

  let html = '';

  // Header
  html += '<div class="detail-header">';
  html += '<a href="#" class="back">← 返回列表</a>';
  html += '<div class="cat-tag">' + (cat?.name || product.category) + '</div>';
  html += '<h1>' + escapeHtml(product.brand) + '<span class="model">' + escapeHtml(product.model) + '</span></h1>';
  html += '<div class="fullname">' + escapeHtml(product.fullName) + '</div>';
  html += '</div>';

  // Tabs
  html += '<div class="report-tabs">';
  for (const typeId of REPORT_TYPE_ORDER) {
    const typeInfo = REPORT_TYPES[typeId];
    const count = reports.filter(r => r.type === typeId).length;
    if (count === 0) continue;
    const active = typeId === state.activeTab ? 'active' : '';
    html += '<button class="' + active + '" data-tab="' + typeId + '">' + typeInfo.name + '<span class="count">' + count + '</span></button>';
  }
  html += '</div>';

  // Report list
  const currentReports = reports.filter(r => r.type === state.activeTab);
  html += '<div class="report-list">';

  if (currentReports.length === 0) {
    html += '<div class="empty"><div class="empty-icon">📄</div><h3>暂无报告</h3></div>';
  } else {
    for (const r of currentReports) {
      html += '<div class="report-item">';
      html += '<div class="report-icon">📄</div>';
      html += '<div class="report-info">';
      html += '<div class="report-title">' + escapeHtml(r.title) + '</div>';
      html += '<div class="report-meta">';
      html += '<span>' + escapeHtml(r.fileName) + '</span>';
      if (r.fileSize) html += '<span>' + escapeHtml(r.fileSize) + '</span>';
      if (r.uploadDate) html += '<span>' + formatDate(r.uploadDate) + '</span>';
      html += '</div></div>';
      html += '<div class="report-actions">';
      html += '<button class="btn-primary" onclick="previewPdf(\'' + r.id + '\',\'' + product.id + '\')">在线预览</button>';
      html += '<a href="' + r.filePath + '" download>下载</a>';
      html += '<a href="' + r.filePath + '" target="_blank">打开</a>';
      html += '</div></div>';
    }
  }

  html += '</div>';
  main.innerHTML = html;

  // Bind tab clicks
  main.querySelectorAll('.report-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      renderDetail(id);
    });
  });
}

// ==================== PDF 预览 ====================
function previewPdf(reportId, productId) {
  const product = ADHESIVES.find(a => a.id === productId);
  if (!product) return;
  const report = product.reports?.find(r => r.id === reportId);
  if (!report) return;

  document.getElementById('modal-title').textContent = report.title;
  document.getElementById('modal-download').href = report.filePath;
  document.getElementById('pdf-frame').src = report.filePath;
  document.getElementById('pdf-modal').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('pdf-modal').classList.remove('show');
  document.getElementById('pdf-frame').src = '';
  document.body.style.overflow = '';
}

// ==================== 工具函数 ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('zh-CN');
}

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', init);
