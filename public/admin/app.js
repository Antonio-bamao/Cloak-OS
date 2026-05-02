const TOKEN_KEY = 'cloak-admin-token';

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

const VIEW_LABELS = {
  overview: {
    title: '总览',
    subtitle: '查看当前斗篷分流、访问判定和活动状态'
  },
  campaigns: {
    title: '活动',
    subtitle: '维护分流活动、安全页和收益页配置'
  },
  logs: {
    title: '访问日志',
    subtitle: '查询当前访问判定、跳转动作和 IP 记录'
  },
  settings: {
    title: '系统设置',
    subtitle: '查看运行配置、检测阈值和 Bot IP 来源'
  }
};

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  activeView: 'overview',
  overview: null,
  settings: null,
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
  errorBanner: document.querySelector('#error-banner'),
  errorMessage: document.querySelector('#error-message'),
  retryError: document.querySelector('#retry-error'),
  workspaceTitle: document.querySelector('#workspace-title'),
  workspaceSubtitle: document.querySelector('#workspace-subtitle'),
  viewPanels: Array.from(document.querySelectorAll('[data-view]')),
  navItems: Array.from(document.querySelectorAll('[data-view-link]')),
  statusVisits: document.querySelector('#status-visits'),
  repositoryBadge: document.querySelector('#repository-badge'),
  settingsDriver: document.querySelector('#settings-driver'),
  settingsServer: document.querySelector('#settings-server'),
  settingsRepository: document.querySelector('#settings-repository'),
  settingsThresholds: document.querySelector('#settings-thresholds'),
  settingsBotCount: document.querySelector('#settings-bot-count'),
  settingsBotSource: document.querySelector('#settings-bot-source'),
  settingsBotIps: document.querySelector('#settings-bot-ips'),
  settingsNotes: document.querySelector('#settings-notes'),
  reloadBotIps: document.querySelector('#reload-bot-ips'),
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
initNavigation();

elements.tokenForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.token = elements.tokenInput.value.trim();
  localStorage.setItem(TOKEN_KEY, state.token);
  await refreshAll('令牌已保存');
});

elements.refreshButton.addEventListener('click', () => refreshAll('数据已刷新'));
elements.retryError.addEventListener('click', () => refreshAll('已重新加载'));
elements.reloadBotIps.addEventListener('click', reloadBotIps);

elements.logFilters.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    hideErrorBanner();
    state.filters = {
      verdict: elements.filterVerdict.value,
      action: elements.filterAction.value,
      ipAddress: elements.filterIp.value.trim()
    };
    await loadLogs();
  } catch (error) {
    handleUiError(error);
  }
});

elements.campaignForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    hideErrorBanner();
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
  } catch (error) {
    handleUiError(error);
  }
});

elements.resetCampaignForm.addEventListener('click', resetCampaignForm);
elements.modalClose.addEventListener('click', closeSuccessModal);
elements.modalOk.addEventListener('click', closeSuccessModal);
elements.successModal.addEventListener('click', (event) => {
  if (event.target === elements.successModal) {
    closeSuccessModal();
  }
});

window.addEventListener('hashchange', () => {
  setActiveView(viewFromHash(window.location.hash, state.activeView));
});

elements.navItems.forEach((item) => {
  item.addEventListener('click', (event) => {
    const view = item.dataset.viewLink;

    if (!view) {
      return;
    }

    event.preventDefault();
    window.location.hash = view;
    setActiveView(view);
  });
});

document.addEventListener('click', async (event) => {
  const editButton = event.target.closest('[data-edit-campaign]');
  const deleteButton = event.target.closest('[data-delete-campaign]');
  const clearFiltersButton = event.target.closest('[data-clear-filters]');

  if (editButton) {
    editCampaign(editButton.dataset.editCampaign);
  }

  if (deleteButton) {
    try {
      hideErrorBanner();
      await deleteCampaign(deleteButton.dataset.deleteCampaign);
    } catch (error) {
      handleUiError(error);
    }
  }

  if (clearFiltersButton) {
    try {
      hideErrorBanner();
      await clearLogFilters();
    } catch (error) {
      handleUiError(error);
    }
  }
});

refreshAll();

function initNavigation() {
  setActiveView(viewFromHash(window.location.hash));
}

function viewFromHash(hash, fallback = 'overview') {
  const id = hash.replace(/^#/, '');

  if (id === 'analytics-panel') {
    return 'overview';
  }

  if (Object.hasOwn(VIEW_LABELS, id)) {
    return id;
  }

  return fallback;
}

function setActiveView(view) {
  const nextView = Object.hasOwn(VIEW_LABELS, view) ? view : 'overview';
  state.activeView = nextView;

  for (const panel of elements.viewPanels) {
    const isActive = panel.dataset.view === nextView;
    panel.hidden = !isActive;
    panel.classList.toggle('is-active', isActive);
  }

  for (const item of elements.navItems) {
    item.classList.remove('is-active');
  }

  elements.navItems.find((item) => item.dataset.viewLink === nextView)?.classList.add('is-active');

  elements.workspaceTitle.textContent = VIEW_LABELS[nextView].title;
  elements.workspaceSubtitle.textContent = VIEW_LABELS[nextView].subtitle;
}

async function refreshAll(message) {
  try {
    hideErrorBanner();
    await Promise.all([loadOverview(), loadCampaigns(), loadLogs(), loadSettings()]);
    if (message) {
      showToast(message);
    }
  } catch (error) {
    handleUiError(error);
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

async function loadSettings() {
  const response = await api('/api/v1/settings');
  state.settings = response.data;
  renderSettings();
}

async function reloadBotIps() {
  try {
    hideErrorBanner();
    const response = await api('/api/v1/settings/bot-ips/reload', {
      method: 'POST'
    });
    state.settings = {
      ...state.settings,
      detection: {
        ...state.settings?.detection,
        botIpCount: response.data.botIpCount,
        botIps: response.data.botIps,
        botIpSource: response.data.botIpSource
      }
    };
    renderSettings();
    showSuccessModal('Bot IP 名单已重载，新的检测名单已生效。');
  } catch (error) {
    handleUiError(error);
  }
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
  elements.donutChart.style.background = `conic-gradient(from -30deg, #34d399 0 ${humanEnd}%, #fb7185 ${humanEnd}% ${botEnd}%, #f59e0b ${botEnd}% ${suspiciousEnd}%, rgba(205, 213, 209, 0.16) ${suspiciousEnd}% 100%)`;
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

function renderSettings() {
  const settings = state.settings;

  if (!settings) {
    return;
  }

  const driverLabel = formatRepositoryDriver(settings.repository?.driver);
  elements.repositoryBadge.textContent = driverLabel;
  elements.settingsDriver.textContent = driverLabel;
  elements.settingsServer.textContent = `${settings.server?.host ?? '-'}:${settings.server?.port ?? '-'}`;
  elements.settingsRepository.textContent = settings.repository?.databaseConfigured
    ? `${driverLabel} / 已配置数据库`
    : `${driverLabel} / 未配置数据库`;
  elements.settingsThresholds.textContent = `可疑 ${settings.detection?.suspiciousThreshold ?? '-'} / 机器人 ${settings.detection?.botThreshold ?? '-'}`;
  elements.settingsBotCount.textContent = String(settings.detection?.botIpCount ?? 0);
  elements.settingsBotSource.textContent = formatBotIpSource(settings.detection?.botIpSource);
  elements.settingsBotIps.textContent = settings.detection?.botIps?.length
    ? settings.detection.botIps.join(', ')
    : '未配置';
  elements.settingsNotes.innerHTML = (settings.notes ?? [])
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join('');
}

function formatBotIpSource(source) {
  if (!source || source.type === 'env') {
    return '环境变量';
  }

  if (source.type === 'file') {
    return source.filePath ? `文件 / ${source.filePath}` : '文件';
  }

  return source.type;
}

function renderCampaigns() {
  if (state.campaigns.length === 0) {
    elements.campaignsTable.innerHTML = emptyRow(
      5,
      emptyState({
        title: '暂无活动',
        detail: '创建第一个活动后，这里会显示安全页、收益页和跳转模式。',
        action: '新建活动',
        href: '#campaign-form-title'
      })
    );
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
      <td class="mono url-cell" title="${escapeHtml(campaign.safeUrl)}">${escapeHtml(campaign.safeUrl)}</td>
      <td class="mono url-cell" title="${escapeHtml(campaign.moneyUrl)}">${escapeHtml(campaign.moneyUrl)}</td>
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
    elements.logsTable.innerHTML = emptyRow(
      6,
      emptyState({
        title: hasActiveFilters() ? '暂无匹配记录' : '暂无日志',
        detail: hasActiveFilters()
          ? '当前筛选条件没有命中访问记录。'
          : '公网入口产生访问后，这里会显示判定、动作和置信度。',
        action: hasActiveFilters() ? '清空筛选' : '',
        button: hasActiveFilters() ? 'data-clear-filters="true"' : ''
      })
    );
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

async function clearLogFilters() {
  elements.filterVerdict.value = '';
  elements.filterAction.value = '';
  elements.filterIp.value = '';
  state.filters = {
    verdict: '',
    action: '',
    ipAddress: ''
  };
  await loadLogs();
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

function emptyState({ title, detail, action, href, button }) {
  const actionMarkup = action
    ? href
      ? `<a class="empty-action" href="${href}">${action}</a>`
      : `<button class="empty-action" type="button" ${button}>${action}</button>`
    : '';

  return `
    <div class="empty-state">
      <span class="empty-mark"><svg><use href="#icon-search"></use></svg></span>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(detail)}</p>
      ${actionMarkup}
    </div>
  `;
}

function hasActiveFilters() {
  return Object.values(state.filters).some(Boolean);
}

function renderErrorBanner(message) {
  elements.errorMessage.textContent = message || '请检查管理令牌或服务状态后重试。';
  elements.errorBanner.hidden = false;
}

function hideErrorBanner() {
  elements.errorBanner.hidden = true;
}

function handleUiError(error) {
  const message = error?.message || '请求失败';
  renderErrorBanner(message);
  showToast(message);
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

function formatRepositoryDriver(value) {
  if (value === 'postgres') {
    return 'PostgreSQL 模式';
  }

  if (value === 'memory') {
    return '本地模式';
  }

  return value || '-';
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
