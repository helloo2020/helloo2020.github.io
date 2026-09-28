import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DEFAULT_IMAGES, resolveImages, readGrantedImage, imageReferences, decodeRef } from './local-images.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const blog = path.resolve(here, '../..');
const posts = path.join(blog, '_posts');
const host = '127.0.0.1';
const port = Number(process.env.ARTICLE_STUDIO_PORT || 4174);
const MAX_BODY = 16 * 1024 * 1024;
const allowedExt = new Map([['image/png', '.png'], ['image/jpeg', '.jpg'], ['image/webp', '.webp'], ['image/gif', '.gif']]);

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function requestBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > MAX_BODY) { reject(new Error('文件总大小超过 16 MB')); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('请求格式错误')); } });
    req.on('error', reject);
  });
}
function runGit(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('git', args, { cwd: blog, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', x => out += x);
    p.stderr.on('data', x => err += x);
    p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `Git 命令失败 (${code})`)));
  });
}
function slugify(s) {
  return s.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}
function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00`)); }
function yamlString(value) { return JSON.stringify(String(value)); }
function normalizeImageLinks(markdown, imageMap) {
  return markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)|!\[\[([^\]]+)\]\]/g, (all, alt, url, wiki) => {
    const raw = (url || wiki).split('|')[0].trim().replace(/^<|>$/g, '');
    const key = decodeRef(raw).replace(/^\.\//, '');
    const target = imageMap.get(key) || imageMap.get(path.basename(key));
    return target ? `![${alt || path.basename(key)}](${target})` : all;
  });
}
async function savePost(data) {
  const title = String(data.title || '').trim();
  const body = String(data.markdown || '').trim();
  const date = String(data.date || '');
  if (!title || title.length > 150 || !body || body.length > 300000 || !validDate(date)) throw new Error('请填写有效的标题、日期和正文');
  const slug = slugify(title);
  if (!slug) throw new Error('标题无法用于文件名');
  const filename = `${date}-${slug}.md`;
  const filepath = path.join(posts, filename);
  try { await fs.access(filepath); throw new Error('博客中已有同名文章，请修改标题或日期'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const style = ['sage', 'classic', 'modern', 'literary', 'warm', 'minimal'].includes(data.style) ? data.style : 'sage';
  const tags = Array.isArray(data.tags) ? data.tags.map(x => String(x).trim()).filter(Boolean).slice(0, 8) : [];
  const imageMap = new Map();
  const fontSize = [14,16,18,20,22].includes(Number(data.fontSize)) ? Number(data.fontSize) : 16;
  const bodyRefs = imageReferences(body);
  const incomingAssets = Array.isArray(data.assets) ? [...data.assets] : [];
  for (const local of (Array.isArray(data.localImages) ? data.localImages : [])) {
    if (!bodyRefs.includes(local.ref)) continue;
    const image = await readGrantedImage(local.id);
    incomingAssets.push({ name: local.ref, type: image.type, data: image.bytes.toString('base64') });
  }
  const assetPaths = [];
  const assetDir = path.join(blog, 'img', 'article-studio', `${date}-${slug}`);
  for (const [i, asset] of incomingAssets.entries()) {
    if (i >= 30) throw new Error('单篇最多导入 30 张图片');
    const ext = allowedExt.get(asset.type);
    if (!ext || typeof asset.data !== 'string' || typeof asset.name !== 'string') throw new Error('图片格式不支持');
    const bytes = Buffer.from(asset.data, 'base64');
    if (bytes.length > 5 * 1024 * 1024 || bytes.length === 0) throw new Error('单张图片不能超过 5 MB');
    const base = slugify(path.basename(asset.name, path.extname(asset.name))) || `image-${i + 1}`;
    const name = `${String(i + 1).padStart(2, '0')}-${base}${ext}`;
    const webPath = `/img/article-studio/${date}-${slug}/${name}`;
    imageMap.set(asset.name.replace(/^\.\//, ''), webPath);
    imageMap.set(path.basename(asset.name), webPath);
    assetPaths.push({ file: path.join(assetDir, name), bytes });
  }
  const missingLocal = bodyRefs.filter(ref => !/^https?:\/\//i.test(ref) && !ref.startsWith('/img/') && !imageMap.has(ref.replace(/^\.\//, '')) && !imageMap.has(path.basename(ref)));
  if (missingLocal.length) throw new Error(`这些本地图片尚未添加：${missingLocal.slice(0, 3).join('、')}`);
  const normalized = normalizeImageLinks(body, imageMap);
  const qrPath = data.qrImageName ? imageMap.get(String(data.qrImageName)) : null;
  const footer = data.footer ? `\n\n---\n\n**关于我**  \n旅行、跑步、看书，也喜欢 AI 和数码  \n🌍 30+ 国家 · 🏅 半马 1h36 ｜ 全马 3h58  \n[主页 scond.me](https://scond.me)\n${data.wechatName ? `\n欢迎关注：${String(data.wechatName).trim().slice(0, 60)}\n` : ''}${qrPath ? `\n![公众号二维码](${qrPath})\n` : ''}` : '';
  const frontmatter = [
    '---', 'layout: post', `title: ${yamlString(title)}`, `date: ${date}`, 'author: Scond', `article_style: ${style}`, `article_font_size: ${fontSize}`, 'article_studio: true',
    'tags:', ...tags.map(t => `  - ${yamlString(t)}`), '---', ''
  ].join('\n');
  await fs.mkdir(posts, { recursive: true });
  if (assetPaths.length) await fs.mkdir(assetDir, { recursive: true });
  try {
    for (const asset of assetPaths) await fs.writeFile(asset.file, asset.bytes, { flag: 'wx' });
    await fs.writeFile(filepath, `${frontmatter}${normalized}${footer}\n`, { flag: 'wx' });
  } catch (e) {
    await Promise.all(assetPaths.map(x => fs.rm(x.file, { force: true })));
    throw e;
  }
  return { filename, assets: assetPaths.map(x => path.relative(blog, x.file)), previewUrl: `https://blog.scond.me/${date.replace(/-/g, '/')}/${encodeURIComponent(slug)}/` };
}
async function publishPost(filename) {
  if (typeof filename !== 'string' || path.basename(filename) !== filename || !/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(filename)) throw new Error('文章文件名无效');
  const rel = `_posts/${filename}`;
  const content = await fs.readFile(path.join(posts, filename), 'utf8');
  if (!/^---\n[\s\S]*?article_studio: true\n[\s\S]*?---\n/.test(content)) throw new Error('只能发布由排版工具保存的文章');
  const branch = await runGit(['branch', '--show-current']);
  if (branch !== 'master') throw new Error('请在博客 master 分支发布');
  const remote = await runGit(['remote', 'get-url', 'origin']);
  if (!/github\.com[:/]helloo2020\/helloo2020\.github\.io(?:\.git)?$/.test(remote)) throw new Error('博客远端地址与预期不符，已停止发布');
  await runGit(['fetch', 'origin', 'master']);
  const ahead = Number(await runGit(['rev-list', '--count', 'origin/master..HEAD']));
  const behind = Number(await runGit(['rev-list', '--count', 'HEAD..origin/master']));
  if (behind) throw new Error('远端有新的提交，请先同步博客仓库再发布');
  const assetDir = `img/article-studio/${filename.slice(0, -3)}`;
  const postSubject = `post: ${filename.slice(11, -3)}`;
  let hasPendingPostCommit = false;
  if (ahead) {
    const commits = (await runGit(['log', '--format=%H%x09%s', 'origin/master..HEAD'])).split('\n').filter(Boolean).map(line => { const [sha, ...subject] = line.split('\t'); return { sha, subject: subject.join('\t') }; });
    const allowedSetupFile = file => ['.gitignore', 'AGENTS.md', 'README.md', '打开文章排版工具.command', '_config.yml', '_includes/head.html', '_layouts/post.html', 'css/main.css'].includes(file) || file.startsWith('tools/article-studio/') || file.startsWith('.ai/');
    hasPendingPostCommit = commits[0]?.subject === postSubject;
    for (const commit of commits) {
      const files = (await runGit(['-c', 'core.quotePath=false', 'diff-tree', '--no-commit-id', '--name-only', '-r', commit.sha])).split('\n').filter(Boolean);
      const setup = (commit.subject === 'feat: add local article studio' || commit.subject.startsWith('studio: ')) && files.every(allowedSetupFile);
      const retry = hasPendingPostCommit && commit.subject === postSubject && files.every(file => file === rel || file.startsWith(`${assetDir}/`));
      if (!setup && !retry) throw new Error('本地已有其他未推送提交，为避免连带发布，请先处理 Git 同步');
    }
  }
  const changed = await runGit(['status', '--porcelain', '--', rel]);
  if (changed && !changed.startsWith('?? ')) throw new Error('这篇文章已有未提交修改，请先检查文件');
  if (!changed && !hasPendingPostCommit) throw new Error('这篇文章已经发布或由其他方式提交');
  try {
    if (changed) {
      const assets = (await fs.readdir(path.join(blog, assetDir)).catch(() => [])).map(x => `${assetDir}/${x}`);
      const paths = [rel, ...assets];
      await runGit(['add', '--', ...paths]);
      await runGit(['commit', '-m', postSubject, '--only', '--', ...paths]);
    }
    await runGit(['push', 'origin', 'master']);
  } catch (e) { throw new Error(`发布未完成：${e.message}。请检查本地 Git 状态。`); }
  return { message: '已推送到博客仓库，GitHub Pages 更新需要一点时间。' };
}
function sameOrigin(req) {
  const origin = req.headers.origin;
  return !origin || origin === `http://${host}:${port}` || origin === 'http://127.0.0.1:5173';
}
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
http.createServer(async (req, res) => {
  try {
    if (!sameOrigin(req)) return json(res, 403, { error: '只接受本地页面请求' });
    if (req.url === '/api/config' && req.method === 'GET') return json(res, 200, { imageDirectory: DEFAULT_IMAGES });
    if (req.url === '/api/resolve-images' && req.method === 'POST') {
      const data = await requestBody(req);
      return json(res, 200, await resolveImages(data.markdown, data.directory));
    }
    if (req.url?.startsWith('/api/local-image?') && req.method === 'GET') {
      const image = await readGrantedImage(new URL(req.url, `http://${host}:${port}`).searchParams.get('id'));
      res.writeHead(200, { 'content-type': image.type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      return res.end(image.bytes);
    }
    if (req.url === '/api/health' && req.method === 'GET') return json(res, 200, { app: 'scond-article-studio' });
    if (req.url === '/api/save' && req.method === 'POST') return json(res, 200, await savePost(await requestBody(req)));
    if (req.url === '/api/publish' && req.method === 'POST') return json(res, 200, await publishPost((await requestBody(req)).filename));
    if (req.url?.startsWith('/api/')) return json(res, 404, { error: '接口不存在' });
    if (req.method !== 'GET') return json(res, 405, { error: '方法不支持' });
    const root = path.join(here, 'public');
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    const requested = path.resolve(root, `.${pathname}`);
    const file = requested.startsWith(root + path.sep) && (await fs.stat(requested).catch(() => null))?.isFile() ? requested : path.join(root, 'index.html');
    const bytes = await fs.readFile(file);
    res.writeHead(200, { 'content-type': `${mime[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    res.end(bytes);
  } catch (e) { json(res, 400, { error: e.message || '操作失败' }); }
}).on('error', error => {
  if (error.code === 'EADDRINUSE') console.error(`${port} 端口已被占用，请关闭占用端口的程序后重试。`);
  else console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
}).listen(port, host, () => console.log(`文章排版工作台：http://${host}:${port}`));
