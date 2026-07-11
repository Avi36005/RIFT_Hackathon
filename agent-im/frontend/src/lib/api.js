const API_BASE = 'http://localhost:8001';

export async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = errText;
    try {
      const parsed = JSON.parse(errText);
      errMsg = parsed.detail || parsed.message || errText;
    } catch (_) {}
    throw new Error(errMsg || `HTTP Error ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Registry
  registerAgent: (screenName, publicKey, owner = 'system') =>
    request('/agents/register', {
      method: 'POST',
      body: JSON.stringify({ screen_name: screenName, public_key: publicKey, owner }),
    }),
  listAgents: () => request('/agents'),
  getAgent: (screenName) => request(`/agents/${screenName}`),

  // Handshake
  initiateHandshake: (fromScreenName, toScreenName) =>
    request('/handshake/initiate', {
      method: 'POST',
      body: JSON.stringify({ from_screen_name: fromScreenName, to_screen_name: toScreenName }),
    }),
  respondHandshake: (challengeId, signature) =>
    request('/handshake/respond', {
      method: 'POST',
      body: JSON.stringify({ challenge_id: challengeId, signature }),
    }),
  getHandshake: (challengeId) => request(`/handshake/${challengeId}`),

  // Buddies
  addBuddy: (agent, buddy) =>
    request('/buddies/add', {
      method: 'POST',
      body: JSON.stringify({ agent, buddy }),
    }),
  getBuddies: (screenName) => request(`/buddies?screen_name=${encodeURIComponent(screenName)}`),

  // Presence
  setPresence: (screenName, status, awayMessage = null) =>
    request('/presence', {
      method: 'POST',
      body: JSON.stringify({ screen_name: screenName, status, away_message: awayMessage }),
    }),
  getPresence: (screenName) => request(`/presence/${screenName}`),

  // Moderation
  warnAgent: (reporter, subject, reason, weight = 10) =>
    request('/moderation/warn', {
      method: 'POST',
      body: JSON.stringify({ reporter, subject, reason, weight }),
    }),
  getModeration: (screenName) => request(`/moderation/${screenName}`),

  // Deals
  startDeal: (initiator, counterparty, scenario = 'buy_api_access') =>
    request('/deals/start', {
      method: 'POST',
      body: JSON.stringify({ initiator, counterparty, scenario }),
    }),
  getDeal: (dealId) => request(`/deals/${dealId}`),
  listDeals: () => request('/deals'),

  // Seed & Demo
  seedDemo: () => request('/seed', { method: 'POST' }),
  resetDemo: () => request('/seed/reset', { method: 'POST' }),
  runDemoVerify: (fromName, toName, imposter = false) =>
    request(`/demo/verify?from_name=${encodeURIComponent(fromName)}&to_name=${encodeURIComponent(toName)}&imposter=${imposter}`, {
      method: 'POST',
    }),
  runFullDemo: () => request('/demo/run', { method: 'POST' }),
};
