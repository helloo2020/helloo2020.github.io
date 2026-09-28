import { marked } from './vendor/marked.esm.js';

const $ = id => document.getElementById(id);
const themes = [
  ['sage', '山与生活', '清爽留白 · 自然舒适', '#edf4ed', '#5a795e'],
  ['classic', '经典雅致', '经典宋体 · 沉稳耐读', '#f7f0e5', '#896a3d'],
  ['modern', '现代简约', '无衬线体 · 简洁清晰', '#eaf3f7', '#2d5e72'],
  ['literary', '书卷墨香', '文艺气息 · 古朴典雅', '#f5edf4', '#735c78'],
  ['warm', '温暖阅读', '暖色调 · 舒适护眼', '#fbefdf', '#b27641'],
  ['minimal', '极简留白', '大字距 · 专注阅读', '#f1f3f1', '#414a43']
];
const state = { theme: 'sage', assets: new Map(), qr: null, saved: null, dirty: false };
const example = `有时候我会想，生活的意义是什么？\n\n可能不是轰轰烈烈的成就，而是那些细碎但真实的瞬间：一杯好喝的咖啡、一本翻到一半的书、傍晚吹来的风，以及忙碌之余还能保有的那一点热爱。\n\n## 热爱的力量\n\n热爱不是遥不可及的梦想，而是让平凡的日子也闪闪发光的小小火种。它可能很微小，但足以支撑我们走过许多睡前的时刻。\n\n> 生活或许不会一直温柔，但热爱可以让我们在风雨中，依然看见光。\n\n## 在日常中发现惊喜\n\n1. 保持好奇，尝试新事物\n2. 认真对待每一次小小的体验\n3. 记录生活中的美好瞬间\n4. 与喜欢的人分享\n\n愿我们都能在平凡的日子里，保持一点热爱，并在热爱中，成为更好的自己。`;
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function toast(message, error = false) { const el = $('toast'); el.textContent = message; el.classList.toggle('error', error); el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.hidden = true, 4500); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function normalizeObsidian(md) {
  return md.replace(/!\[\[([^\]]+)\]\]/g, (_, s) => { const [name, size] = s.split('|'); return `![${name}](${name})`; })
    .replace(/(?<!!)\[\[([^\]]+)\]\]/g, (_, s) => s.split('|').pop().replace(/\.md$/i, ''));
}
function safeUrl(value, image = false) {
  try { const url = new URL(value, location.href); return ['http:', 'https:'].includes(url.protocol) || (image && url.protocol === 'blob:') ? value : ''; } catch { return ''; }
}
function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const allowed = new Set('P BR H1 H2 H3 H4 H5 H6 STRONG EM B I U S DEL BLOCKQUOTE UL OL LI A IMG PRE CODE HR TABLE THEAD TBODY TR TH TD'.split(' '));
  const walk = node => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.COMMENT_NODE) child.remove();
      else if (child.nodeType === Node.ELEMENT_NODE) {
        if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM'].includes(child.tagName)) { child.remove(); continue; }
        if (!allowed.has(child.tagName)) { walk(child); child.replaceWith(...child.childNodes); continue; }
        const href = child.tagName === 'A' ? safeUrl(child.getAttribute('href') || '') : '';
        const src = child.tagName === 'IMG' ? safeUrl(child.getAttribute('src') || '', true) : '';
        const alt = child.tagName === 'IMG' ? child.getAttribute('alt') || '' : '';
        for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
        if (href) { child.setAttribute('href', href); child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener noreferrer'); }
        if (src) { child.setAttribute('src', src); child.setAttribute('alt', alt); }
        else if (child.tagName === 'IMG') { child.replaceWith(doc.createTextNode(`[图片：${alt}]`)); continue; }
        walk(child);
      }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
function renderThemes() {
  $('themes').innerHTML = themes.map(([id,name,description,bg,color]) => `<button class="theme-choice ${id === state.theme ? 'selected' : ''}" type="button" role="radio" aria-checked="${id === state.theme}" data-theme="${id}"><span class="theme-swatch" style="background:${bg};color:${color}">文</span><span class="theme-copy"><strong>${name}</strong><small>${description}</small></span><span class="check">✓</span></button>`).join('');
  $('themes').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { state.theme = button.dataset.theme; renderThemes(); render(); markDirty(); }));
}
function footerHtml() {
  const account = $('wechat-name').value.trim();
  const qr = state.qr ? `<img src="${URL.createObjectURL(state.qr)}" alt="公众号二维码">` : '';
  return `<strong>关于我</strong><p>旅行、跑步、看书，也喜欢 AI 和数码</p><p>🌍 30+ 国家<br>🏅 半马 1h36 ｜ 全马 3h58</p><p><a href="https://scond.me">主页 scond.me</a></p>${account ? `<p>欢迎关注：${escapeHtml(account)}</p>` : ''}${qr}`;
}
function render() {
  const title = $('title').value.trim() || '文章标题';
  const md = normalizeObsidian($('markdown').value);
  $('preview-heading').textContent = title;
  $('paper').className = `paper theme-${state.theme}${$('paper').classList.contains('mobile') ? ' mobile' : ''}`;
  $('preview-body').innerHTML = sanitize(marked.parse(md, { breaks: false, gfm: true }));
  $('preview-body').querySelectorAll('img').forEach(img => {
    const key = decodeURIComponent(img.getAttribute('src') || '').replace(/^\.\//, '');
    const file = state.assets.get(key) || state.assets.get(key.split('/').pop());
    if (file) img.src = URL.createObjectURL(file);
  });
  $('preview-footer').hidden = !$('footer').checked;
  $('footer-options').hidden = !$('footer').checked;
  if ($('footer').checked) $('preview-footer').innerHTML = footerHtml();
  $('word-count').textContent = `${md.replace(/\s/g,'').length} 字`;
  $('asset-count').textContent = state.assets.size ? `${state.assets.size} 张图片` : '未添加图片';
}
function markDirty() { if (state.saved) { state.saved = null; $('publish').disabled = true; $('status').textContent = '内容已修改，请重新保存'; } }
function parseFrontmatter(text, filename) {
  let body = text.replace(/^\uFEFF/, '');
  let meta = {};
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (match) {
    body = body.slice(match[0].length);
    for (const line of match[1].split(/\r?\n/)) {
      const found = line.match(/^([\w-]+):\s*(.*)$/);
      if (found) meta[found[1]] = found[2].replace(/^['"]|['"]$/g, '');
    }
  }
  const heading = body.match(/^#\s+(.+)\r?\n/);
  $('title').value = meta.title || (heading ? heading[1] : filename.replace(/\.md$/i, ''));
  if (heading) body = body.slice(heading[0].length);
  $('markdown').value = body.trim();
  if (meta.date && /^\d{4}-\d{2}-\d{2}$/.test(meta.date)) $('date').value = meta.date;
  markDirty(); render();
}
async function filesToPayload() {
  const files = [...new Set([...state.assets.values(), ...(state.qr ? [state.qr] : [])])];
  return Promise.all(files.map(async file => ({ name: file.name, type: file.type, data: (await toDataUrl(file)).split(',')[1] })));
}
function toDataUrl(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); }); }
async function api(route, data) {
  const response = await fetch(`/api/${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '操作失败');
  return result;
}
async function save() {
  if (!$('title').value.trim() || !$('markdown').value.trim()) return toast('请先填写标题和正文', true);
  $('save').disabled = true;
  try {
    const result = await api('save', { title: $('title').value, markdown: normalizeObsidian($('markdown').value), date: $('date').value, tags: $('tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean), style: state.theme, footer: $('footer').checked, wechatName: $('wechat-name').value, qrImageName: state.qr?.name, assets: await filesToPayload() });
    state.saved = result; $('publish').disabled = false;
    $('status').textContent = `已保存：${result.filename}`;
    toast('文章已保存到本地博客仓库');
  } catch (e) { toast(e.message, true); } finally { $('save').disabled = false; }
}
async function publish() {
  if (!state.saved) return;
  if (!confirm(`即将提交并推送「${$('title').value}」到 GitHub，网站会公开展示这篇文章。首次使用时还会同步工具的安装改动。继续吗？`)) return;
  $('publish').disabled = true;
  try { const result = await api('publish', { filename: state.saved.filename }); $('status').textContent = '已推送到线上博客'; toast(result.message); }
  catch (e) { $('publish').disabled = false; toast(e.message, true); }
}
function inlineCopyHtml() {
  const clone = $('paper').cloneNode(true);
  clone.removeAttribute('id'); clone.className = '';
  const sourceNodes = [$('paper'), ...$('paper').querySelectorAll('*')];
  const targetNodes = [clone, ...clone.querySelectorAll('*')];
  sourceNodes.forEach((source, i) => {
    const target = targetNodes[i]; if (!target) return;
    const computed = getComputedStyle(source);
    const props = ['color','background-color','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','margin-top','margin-bottom','padding-top','padding-right','padding-bottom','padding-left','border-left','border-top','border-bottom','border-radius','max-width','width','height','display','text-decoration'];
    target.setAttribute('style', props.map(p => `${p}:${computed.getPropertyValue(p)}`).join(';'));
    target.removeAttribute('class'); target.removeAttribute('hidden'); target.removeAttribute('id');
  });
  clone.querySelectorAll('img').forEach(img => { if (img.src.startsWith('blob:')) img.replaceWith(document.createTextNode(`[图片：${img.alt || '请在公众号后台上传'}]`)); });
  if (!$('footer').checked) clone.querySelector('.article-footer')?.remove();
  return clone.outerHTML;
}
async function copy() {
  if (!$('markdown').value.trim()) return toast('请先输入正文', true);
  const html = inlineCopyHtml();
  const plain = `${$('title').value}\n\n${$('markdown').value}`;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], {type:'text/html'}), 'text/plain': new Blob([plain], {type:'text/plain'}) })]);
    toast('已复制富文本，可粘贴到公众号后台；请检查图片和版式');
  } catch (e) { toast('浏览器未允许富文本复制，请使用本地地址打开并允许剪贴板权限', true); }
}
$('date').value = localDate(); $('title').value = '在平凡的日子里，保持一点热爱'; $('markdown').value = example;
renderThemes(); render();
for (const id of ['title','markdown','date','tags','wechat-name']) $(id).addEventListener('input', () => { markDirty(); render(); });
$('footer').addEventListener('change', () => { markDirty(); render(); });
$('md-file').addEventListener('change', async e => { const file = e.target.files[0]; if (file) { parseFrontmatter(await file.text(), file.name); toast(`已导入 ${file.name}`); } });
$('assets').addEventListener('change', e => { for (const file of e.target.files) state.assets.set(file.name, file); markDirty(); render(); });
$('qr').addEventListener('change', e => { state.qr = e.target.files[0] || null; markDirty(); render(); });
$('save').addEventListener('click', save); $('publish').addEventListener('click', publish); $('copy').addEventListener('click', copy);
$('desktop-view').addEventListener('click', () => { $('paper').classList.remove('mobile'); $('desktop-view').classList.add('active'); $('mobile-view').classList.remove('active'); });
$('mobile-view').addEventListener('click', () => { $('paper').classList.add('mobile'); $('mobile-view').classList.add('active'); $('desktop-view').classList.remove('active'); });
