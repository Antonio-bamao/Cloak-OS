const TOKEN_KEY = 'cloak-admin-token';
const DEFAULT_TOKEN = 'dev-admin-token';

const REDIRECT_MODE_LABELS = {
  redirect: '直接跳转',
  iframe: '内嵌页',
  loading: '加载页'
};

const VERDICT_LABELS = {
  human: '正常访客',
  bot: '机器人',
  suspicious: '可疑访问'
};

const ACTION_LABELS = {
  money: '收益页',
  safe: '安全页',
  block: '拦截'
};

const state = {
  token: localStorage.getItem(TOKEN_KEY) || DEFAULT_TOKEN,
  overview: null,
  campaigns: [],
  logs: [],
  editingCampaignId: null,
  filters: {
    verdict: '',
    action: '',
    ipAddress: ''
  }
};

const elements = {
  tokenForm: document.querySelector('#token-form'),
  tokenInput: document.querySelector('#admin-token'),
  refreshButton: document.querySelector('#refresh-button'),
  statusVisits: document.querySelector('#status-visits'),
  campaignForm: document.querySelector('#campaign-form'),
  campaignId: document.querySelector('#campaign-id'),
  campaignName: document.querySelector('#campaign-name'),
  campaignSafeUrl: document.querySelector('#campaign-safe-url'),
  campaignMoneyUrl: document.querySelector('#campaign-money-url'),
  campaignMode: document.querySelector('#campaign-mode'),
  resetCampaignForm: document.querySelector('#reset-campaign-form'),
  saveCampaignButton: document.querySelector('#save-campaign-button'),
  campaignsTable: document.querySelector('#campaigns-table'),
  logsTable: document.querySelector('#logs-table'),
  logFilters: document.querySelector('#log-filters'),
  filterVerdict: document.querySelector('#filter-verdict'),
  filterAction: document.querySelector('#filter-action'),
  filterIp: document.querySelector('#filter-ip'),
  donutTotal: document.querySelector('#donut-total'),
  donutChart: document.querySelector('#donut-chart'),
  successModal: document.querySelector('#success-modal'),
  successMessage: document.querySelector('#success-message'),
  modalClose: document.querySelector('#modal-close'),
  modalOk: document.querySelector('#modal-ok'),
  toast: document.querySelector('#toast')
};

elements.tokenInput.value = state.token;

elements.tokenForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.token = elements.tokenInput.value.trim();
  localStorage.setItem(TOKEN_KEY, state.token);
  await refreshAll('令牌已保存');
});

elements.refreshButton.addEventListener('click', () => refreshAll('数据已刷新'));

elements.logFilters.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.filters = {
    verdict: elements.filterVerdict.value,
    action: elements.filterAction.value,
    ipAddress: elements.filterIp.value.trim()
  };
  await loadLogs();
});

elements.campaignForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: elements.campaignName.value.trim(),
    safeUrl: elements.campaignSafeUrl.value.trim(),
    moneyUrl: elements.campaignMoneyUrl.value.trim(),
    redirectMode: elements.campaignMode.value
  };

  if (state.editingCampaignId) {
    await api(`/api/v1/campaigns/${state.editingCampaignId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    showSuccessModal('活动已更新，新的分流规则已生效。');
  } else {
    await api('/api/v1/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showSuccessModal('活动已创建，已加入当前看板。');
  }

  resetCampaignForm();
  await refreshAll();
});

elements.resetCampaignForm.addEventListener('click', resetCampaignForm);
elements.modalClose.addEventListener('click', closeSuccessModal);
elements.modalOk.addEventListener('click', closeSuccessModal);
elements.successModal.addEventListener('click', (event) => {
  if (event.target === elements.successModal) {
    closeSuccessModal();
  }
});

document.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-campaign]');
  const deleteButton = event.target.closest('[data-delete-campaign]');

  if (editButton) {
    editCampaign(editButton.dataset.editCampaign);
  }

  if (deleteButton) {
    await deleteCampaign(deleteButton.dataset.deleteCampaign);
  }
});

refreshAll();

async function refreshAll(message) {
  try {
    await Promise.all([loadOverview(), loadCampaigns(), loadLogs()]);
    if (message) {
      showToast(message);
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function loadOverview() {
  const response = await api('/api/v1/analytics/overview');
  state.overview = response.data;
  renderOverview();
}

async function loadCampaigns() {
  const response = await api('/api/v1/campaigns');
  state.campaigns = response.data;
  renderCampaigns();
}

async function loadLogs() {
  const query = new URLSearchParams({
    page: '1',
    pageSize: '10'
  });

  for (const [key, value] of Object.entries(state.filters)) {
    if (value) {
      query.set(key, value);
    }
  }

  const response = await api(`/api/v1/logs?${query.toString()}`);
  state.logs = response.data;
  renderLogs();
}

async function api(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${state.token}`
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message || '请求失败');
  }

  return payload;
}

function renderOverview() {
  const overview = state.overview || emptyOverview();

  setText('#metric-campaigns', overview.campaignCount);
  setText('#metric-visits', overview.totalVisits);
  setText('#metric-bots', overview.verdicts.bot);
  setText('#metric-money', overview.actions.money);
  elements.statusVisits.textContent = String(overview.totalVisits);
  renderDonut(overview);
  renderVerdictBars(overview);
  renderActionStrip(overview);
}

function renderDonut(overview) {
  const total = Math.max(overview.totalVisits, 1);
  const human = Math.round((overview.verdicts.human / total) * 100);
  const bot = Math.round((overview.verdicts.bot / total) * 100);
  const suspicious = Math.max(0, 100 - human - bot);
  const humanEnd = human;
  const botEnd = human + bot;
  const suspiciousEnd = botEnd + suspicious;

  elements.donutTotal.textContent = `${overview.totalVisits > 0 ? 100 : 0}%`;
  elements.donutChart.style.background = `conic-gradient(from -30deg, #7c3aed 0 ${humanEnd}%, #fb4d67 ${humanEnd}% ${botEnd}%, #f0b429 ${botEnd}% ${suspiciousEnd}%, #e5e7eb ${suspiciousEnd}% 100%)`;
}

function renderVerdictBars(overview) {
  const total = Math.max(overview.totalVisits, 1);
  const rows = [
    ['正常访客', 'human', overview.verdicts.human],
    ['机器人', 'bot', overview.verdicts.bot],
    ['可疑访问', 'suspicious', overview.verdicts.suspicious]
  ];

  document.querySelector('#verdict-bars').innerHTML = rows.map(([label, key, value]) => {
    const width = Math.round((value / total) * 100);
    return `
      <div class="bar-row">
        <span class="bar-label">${label}</span>
        <span class="bar-track"><span class="bar-fill is-${key}" style="width:${width}%"></span></span>
        <span class="bar-value">${value}</span>
      </div>
    `;
  }).join('');
}

function renderActionStrip(overview) {
  const actions = [
    ['收益页', 'money', overview.actions.money],
    ['安全页', 'safe', overview.actions.safe],
    ['拦截', 'block', overview.actions.block]
  ];

  document.querySelector('#action-strip').innerHTML = actions.map(([label, key, value]) => `
    <div class="action-tile is-${key}">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join('');
}

function renderCampaigns() {
  if (state.campaigns.length === 0) {
    elements.campaignsTable.innerHTML = emptyRow(5, '暂无活动');
    return;
  }

  elements.campaignsTable.innerHTML = state.campaigns.map((campaign) => `
    <tr>
      <td>
        <span class="campaign-name">
          <span class="avatar-dot">${escapeHtml(campaignInitial(campaign.name))}</span>
          <span>${escapeHtml(campaign.name)}</span>
        </span>
      </td>
      <td><span class="pill">${escapeHtml(formatRedirectMode(campaign.redirectMode))}</span></td>
      <td class="mono">${escapeHtml(campaign.safeUrl)}</td>
      <td class="mono">${escapeHtml(campaign.moneyUrl)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-button" type="button" data-edit-campaign="${campaign.id}" aria-label="编辑 ${escapeHtml(campaign.name)}">
            <svg><use href="#icon-edit"></use></svg>
          </button>
          <button class="icon-button danger-button" type="button" data-delete-campaign="${campaign.id}" aria-label="删除 ${escapeHtml(campaign.name)}">
            <svg><use href="#icon-trash"></use></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderLogs() {
  if (state.logs.length === 0) {
    elements.logsTable.innerHTML = emptyRow(6, '暂无日志');
    return;
  }

  elements.logsTable.innerHTML = state.logs.map((log) => `
    <tr>
      <td class="mono">${formatDate(log.createdAt)}</td>
      <td class="mono">${escapeHtml(shortId(log.campaignId))}</td>
      <td class="mono">${escapeHtml(log.ipAddress)}</td>
      <td><span class="pill is-${escapeHtml(log.verdict)}">${escapeHtml(formatVerdict(log.verdict))}</span></td>
      <td><span class="pill is-${escapeHtml(log.action)}">${escapeHtml(formatAction(log.action))}</span></td>
      <td class="mono">${log.confidence ?? 0}</td>
    </tr>
  `).join('');
}

function editCampaign(campaignId) {
  const campaign = state.campaigns.find((item) => item.id === campaignId);

  if (!campaign) {
    return;
  }

  state.editingCampaignId = campaign.id;
  elements.campaignId.value = campaign.id;
  elements.campaignName.value = campaign.name;
  elements.campaignSafeUrl.value = campaign.safeUrl;
  elements.campaignMoneyUrl.value = campaign.moneyUrl;
  elements.campaignMode.value = campaign.redirectMode;
  elements.saveCampaignButton.textContent = '更新活动';
  elements.campaignName.focus();
}

async function deleteCampaign(campaignId) {
  await api(`/api/v1/campaigns/${campaignId}`, { method: 'DELETE' });
  showSuccessModal('活动已删除，已从分流表移除。');
  await refreshAll();
}

function resetCampaignForm() {
  state.editingCampaignId = null;
  elements.campaignForm.reset();
  elements.campaignId.value = '';
  elements.campaignMode.value = 'redirect';
  elements.saveCampaignButton.textContent = '保存活动';
}

function emptyOverview() {
  return {
    campaignCount: 0,
    totalVisits: 0,
    verdicts: { human: 0, bot: 0, suspicious: 0 },
    actions: { money: 0, safe: 0, block: 0 }
  };
}

function setText(selector, value) {
  document.querySelector(selector).textContent = String(value ?? 0);
}

function emptyRow(colspan, label) {
  return `<tr><td class="empty-row" colspan="${colspan}">${label}</td></tr>`;
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function shortId(value) {
  return value ? value.slice(0, 8) : '-';
}

function formatRedirectMode(value) {
  return REDIRECT_MODE_LABELS[value] || value || '-';
}

function formatVerdict(value) {
  return VERDICT_LABELS[value] || value || '-';
}

function formatAction(value) {
  return ACTION_LABELS[value] || value || '-';
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove('is-visible');
  }, 3200);
}

function showSuccessModal(message) {
  elements.successMessage.textContent = message;
  elements.successModal.hidden = false;
}

function closeSuccessModal() {
  elements.successModal.hidden = true;
}

function campaignInitial(name) {
  const text = String(name || 'C').trim();
  return text.slice(0, 2).toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
