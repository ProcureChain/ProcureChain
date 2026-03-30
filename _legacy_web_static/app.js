const el = {
  baseUrl: document.getElementById('baseUrl'),
  tenantId: document.getElementById('tenantId'),
  companyId: document.getElementById('companyId'),
  userId: document.getElementById('userId'),
  roles: document.getElementById('roles'),
  subcategoryId: document.getElementById('subcategoryId'),
  supplierName: document.getElementById('supplierName'),
  exportType: document.getElementById('exportType'),
  exportFormat: document.getElementById('exportFormat'),
  log: document.getElementById('log'),
  apiStatus: document.getElementById('apiStatus'),
  lastUpdated: document.getElementById('lastUpdated'),
};

const state = {
  lastPrId: null,
  lastSupplierId: null,
  lastRfqId: null,
  lastAwardId: null,
};

function now() {
  return new Date().toISOString();
}

function appendLog(message, data) {
  const block = [`[${now()}] ${message}`];
  if (data !== undefined) {
    block.push(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
  el.log.textContent = `${block.join('\n')}\n\n${el.log.textContent}`;
  el.lastUpdated.textContent = `last updated: ${new Date().toLocaleTimeString()}`;
}

function getConfig() {
  return {
    baseUrl: el.baseUrl.value.trim().replace(/\/$/, ''),
    tenantId: el.tenantId.value.trim(),
    companyId: el.companyId.value.trim(),
    userId: el.userId.value.trim() || 'dev-user',
    roles: el.roles.value.trim() || 'PROCUREMENT_MANAGER',
  };
}

function saveConfig() {
  localStorage.setItem('procurechain.frontend.config', JSON.stringify(getConfig()));
  appendLog('Saved config to localStorage');
}

function loadConfig() {
  const raw = localStorage.getItem('procurechain.frontend.config');
  if (!raw) return;
  try {
    const cfg = JSON.parse(raw);
    if (cfg.baseUrl) el.baseUrl.value = cfg.baseUrl;
    if (cfg.tenantId) el.tenantId.value = cfg.tenantId;
    if (cfg.companyId) el.companyId.value = cfg.companyId;
    if (cfg.userId) el.userId.value = cfg.userId;
    if (cfg.roles) el.roles.value = cfg.roles;
  } catch {
    appendLog('Failed to parse saved config, using defaults');
  }
}

async function api(method, path, body, headers = {}) {
  const cfg = getConfig();
  const reqHeaders = {
    'content-type': 'application/json',
    'x-tenant-id': cfg.tenantId,
    'x-company-id': cfg.companyId,
    'x-user-id': cfg.userId,
    'x-user-roles': cfg.roles,
    ...headers,
  };

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: reqHeaders,
    body: body == null ? undefined : JSON.stringify(body),
  });

  let payload;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  appendLog(`${method} ${path} -> ${res.status}`, payload);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${payload?.message ?? 'request failed'}`);
  }

  return payload;
}

async function checkHealth() {
  try {
    const res = await fetch(`${getConfig().baseUrl}/health`);
    const payload = await res.json();
    el.apiStatus.textContent = res.ok ? 'API: online' : 'API: degraded';
    el.apiStatus.style.borderColor = res.ok ? 'var(--ok)' : 'var(--danger)';
    appendLog('Health check', payload);
  } catch (err) {
    el.apiStatus.textContent = 'API: offline';
    el.apiStatus.style.borderColor = 'var(--danger)';
    appendLog('Health check failed', String(err));
  }
}

async function setStrictPolicy() {
  await api('PUT', '/policies/procurement', {
    lowThreshold: 1000,
    midThreshold: 5000,
    lowMethod: 'LOW_VALUE_QUOTATION',
    midMethod: 'LIMITED_TENDER',
    highMethod: 'OPEN_TENDER',
    emergencyEnabled: true,
    requireEmergencyJustification: true,
  });
}

async function runFlow() {
  const subcategoryId = el.subcategoryId.value.trim();
  const supplierName = el.supplierName.value.trim() || 'Frontend Supplier';

  const pr = await api('POST', '/pr', {
    title: `Frontend PR ${Date.now()}`,
    subcategoryId,
    currency: 'ZAR',
    metadata: { serviceBlend: 'ops-60-tech-40' },
  });
  state.lastPrId = pr.id;

  await api('POST', `/pr/${pr.id}/lines`, {
    description: 'Frontend line item',
    quantity: 2,
    unitPrice: 1500,
  });

  await api('POST', `/pr/${pr.id}/submit`, {});
  await api('POST', `/pr/${pr.id}/status`, { status: 'UNDER_REVIEW' });
  await api('POST', `/pr/${pr.id}/status`, { status: 'APPROVED' });

  const supplier = await api('POST', '/suppliers', {
    name: supplierName,
    country: 'ZA',
  });
  state.lastSupplierId = supplier.id;

  const rfq = await api('POST', '/rfqs', {
    prId: pr.id,
    title: `Frontend RFQ ${Date.now()}`,
    procurementMethod: 'LIMITED_TENDER',
    metadata: { hybridAllocation: 'ops-60-tech-40' },
  });
  state.lastRfqId = rfq.id;

  await api('POST', `/rfqs/${rfq.id}/suppliers`, { supplierIds: [supplier.id] });
  await api('POST', `/rfqs/${rfq.id}/release`, {});
  await api('POST', `/rfqs/${rfq.id}/open`, {});

  const award = await api(
    'POST',
    `/rfqs/${rfq.id}/award`,
    { supplierId: supplier.id, overrideReason: 'Frontend best value' },
    { 'x-user-roles': 'PROCUREMENT_MANAGER' },
  );

  state.lastAwardId = award?.award?.id ?? null;
  appendLog('Flow complete', state);
}

async function generateExport() {
  const type = el.exportType.value;
  const format = el.exportFormat.value;
  await api('POST', `/governance/exports/${type}`, { format });
}

function wire() {
  document.getElementById('btnHealth').addEventListener('click', checkHealth);
  document.getElementById('btnSaveConfig').addEventListener('click', saveConfig);
  document.getElementById('btnRunFlow').addEventListener('click', () =>
    runFlow().catch((err) => appendLog('Flow failed', String(err))),
  );

  document.getElementById('btnGetPolicy').addEventListener('click', () =>
    api('GET', '/policies/procurement').catch((err) => appendLog('Error', String(err))),
  );
  document.getElementById('btnSetPolicy').addEventListener('click', () =>
    setStrictPolicy().catch((err) => appendLog('Error', String(err))),
  );
  document.getElementById('btnListSod').addEventListener('click', () =>
    api('GET', '/policies/sod').catch((err) => appendLog('Error', String(err))),
  );
  document.getElementById('btnGetRetention').addEventListener('click', () =>
    api('GET', '/governance/retention/policy').catch((err) => appendLog('Error', String(err))),
  );
  document.getElementById('btnRunRetention').addEventListener('click', () =>
    api('POST', '/governance/retention/run', { dryRun: true }).catch((err) =>
      appendLog('Error', String(err)),
    ),
  );
  document.getElementById('btnAuditEvidence').addEventListener('click', () =>
    api('GET', '/governance/audit/evidence?limit=500').catch((err) => appendLog('Error', String(err))),
  );
  document.getElementById('btnExport').addEventListener('click', () =>
    generateExport().catch((err) => appendLog('Error', String(err))),
  );
}

loadConfig();
wire();
checkHealth();
appendLog('Frontend initialized', { config: getConfig() });
