import { all } from './util';

export type Prov = { id: string; name: string; kind: 'oai' | 'anthropic' | 'ollama'; base: string; model: string; link: string; free?: boolean; custom?: boolean };

// 20 nhà AI chạy qua internet (3 nhà chạy trên máy cá nhân như LM Studio, Ollama local, YourAI không dùng được từ Cloudflare nên không có ở đây).
export const CATALOG: Prov[] = [
  { id: 'openai', name: 'OpenAI', kind: 'oai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', link: 'platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic Claude', kind: 'anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-sonnet-5-5', link: 'console.anthropic.com' },
  { id: 'gemini', name: 'Google Gemini', kind: 'oai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.6-flash', link: 'aistudio.google.com/apikey', free: true },
  { id: 'deepseek', name: 'DeepSeek', kind: 'oai', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', link: 'platform.deepseek.com' },
  { id: 'groq', name: 'Groq', kind: 'oai', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-20b', link: 'console.groq.com/keys', free: true },
  { id: 'mistral', name: 'Mistral', kind: 'oai', base: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', link: 'console.mistral.ai' },
  { id: 'xai', name: 'xAI Grok', kind: 'oai', base: 'https://api.x.ai/v1', model: 'grok-4', link: 'console.x.ai' },
  { id: 'openrouter', name: 'OpenRouter (nhiều mô hình, có gói free)', kind: 'oai', base: 'https://openrouter.ai/api/v1', model: 'openrouter/free', link: 'openrouter.ai/keys', free: true },
  { id: 'perplexity', name: 'Perplexity (có tìm kiếm web)', kind: 'oai', base: 'https://api.perplexity.ai', model: 'sonar', link: 'perplexity.ai/settings/api' },
  { id: 'together', name: 'Together AI', kind: 'oai', base: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', link: 'api.together.ai' },
  { id: 'cerebras', name: 'Cerebras (rất nhanh, có gói free)', kind: 'oai', base: 'https://api.cerebras.ai/v1', model: 'llama-3.3-70b', link: 'cloud.cerebras.ai', free: true },
  { id: 'sambanova', name: 'SambaNova (có gói free)', kind: 'oai', base: 'https://api.sambanova.ai/v1', model: 'Meta-Llama-3.3-70B-Instruct', link: 'cloud.sambanova.ai', free: true },
  { id: 'fireworks', name: 'Fireworks AI', kind: 'oai', base: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', link: 'fireworks.ai' },
  { id: 'cohere', name: 'Cohere', kind: 'oai', base: 'https://api.cohere.ai/compatibility/v1', model: 'command-r-plus', link: 'dashboard.cohere.com' },
  { id: 'nvidia', name: 'NVIDIA NIM (có gói free)', kind: 'oai', base: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct', link: 'build.nvidia.com', free: true },
  { id: 'moonshot', name: 'Moonshot Kimi', kind: 'oai', base: 'https://api.moonshot.ai/v1', model: 'kimi-k2-0905-preview', link: 'platform.moonshot.ai' },
  { id: 'qwen', name: 'Alibaba Qwen (DashScope quốc tế)', kind: 'oai', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', link: 'modelstudio.console.alibabacloud.com' },
  { id: 'zhipu', name: 'Zhipu GLM', kind: 'oai', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', link: 'open.bigmodel.cn' },
  { id: 'ollamacloud', name: 'Ollama Cloud', kind: 'ollama', base: 'https://ollama.com', model: 'gpt-oss:120b', link: 'ollama.com/settings/keys' },
  { id: 'custom', name: 'Tùy chỉnh (tương thích OpenAI)', kind: 'oai', base: '', model: '', link: '', custom: true },
];

export async function loadSettings(db: any) {
  const m: Record<string, any> = {};
  (await all(db, 'SELECT * FROM ai_settings')).forEach((r) => (m[r.id] = r));
  return m;
}

// Khóa lấy từ trang "Cài đặt AI"; nếu trống thì lấy từ biến môi trường Cloudflare AI_KEY_<TÊN> (vd AI_KEY_OPENAI).
export const keyOf = (env: any, id: string, row: any) =>
  String(row?.api_key || env['AI_KEY_' + id.toUpperCase()] || '').trim();

const errMsg = (j: any, status: number, key: string) => {
  let m = j?.error?.message || (typeof j?.error === 'string' ? j.error : '') || j?.message || 'HTTP ' + status;
  m = String(m).slice(0, 180);
  return key ? m.split(key).join('***') : m;
};

async function callOne(p: Prov, key: string, model: string, base: string, system: string, user: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 45000);
  try {
    base = base.replace(/\/$/, '');
    if (p.kind === 'anthropic') {
      const r = await fetch(base + '/messages', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 3000, system, messages: [{ role: 'user', content: user }] }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errMsg(j, r.status, key));
      return (j.content || []).map((c: any) => c.text || '').join('');
    }
    if (p.kind === 'ollama') {
      const r = await fetch(base + '/api/chat', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errMsg(j, r.status, key));
      return j?.message?.content || '';
    }
    const send = (tok: string | null) =>
      fetch(base + '/chat/completions', {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], ...(tok ? { [tok]: 3000 } : {}) }),
      });
    let r = await send('max_tokens');
    let j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = errMsg(j, r.status, key);
      if (/max_completion_tokens/.test(m)) r = await send('max_completion_tokens');
      else if (/max_tokens/.test(m)) r = await send(null);
      else throw new Error(m);
      j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(errMsg(j, r.status, key));
    }
    return j?.choices?.[0]?.message?.content || '';
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('quá thời gian chờ');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// provider = 'auto' -> thử lần lượt các nhà đã bật (theo số ưu tiên nhỏ trước); hoặc chỉ định 1 nhà.
export async function ask(env: any, db: any, o: { system: string; user: string; provider?: string }) {
  const st = await loadSettings(db);
  const manual = o.provider && o.provider !== 'auto';
  const list = CATALOG.filter((p) => (manual ? p.id === o.provider : st[p.id]?.enabled && keyOf(env, p.id, st[p.id])))
    .sort((a, b) => (st[a.id]?.priority ?? 100) - (st[b.id]?.priority ?? 100));
  if (!list.length) throw new Error('Chưa bật nhà AI nào có API key. Vào "Cài đặt AI (API)" để nhập.');
  const errs: string[] = [];
  for (const p of list) {
    const s = st[p.id];
    const key = keyOf(env, p.id, s);
    if (!key) { errs.push(`${p.name}: chưa có API key`); continue; }
    const model = String(s?.model || p.model).trim();
    const base = p.custom ? String(s?.base || '').trim() : p.base;
    if (!base || !model) { errs.push(`${p.name}: thiếu địa chỉ hoặc model`); continue; }
    try {
      const text = (await callOne(p, key, model, base, o.system, o.user)).trim();
      if (!text) throw new Error('AI trả về nội dung trống');
      return { text, via: `${p.name} (${model})` };
    } catch (e: any) {
      errs.push(`${p.name}: ${e?.message || e}`);
    }
  }
  throw new Error(errs.join(' | '));
}
