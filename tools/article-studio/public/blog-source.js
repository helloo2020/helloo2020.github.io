const sourceLine = /^>\s*公众号[：:]\s*(.+?)(?:\s*[|｜]\s*发布时间[：:]\s*(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?))?\s*$/;
const sourceLink = /^\[(?:原文公众号链接|原文链接)\]\((https:\/\/mp\.weixin\.qq\.com\/s(?:\/|\?)[^\s)]+)\)\s*$/;

export function extractBlogSource(markdown) {
  const lines = String(markdown).replace(/^\uFEFF/, '').split(/\r?\n/);
  let start = 0;
  while (start < lines.length && !lines[start].trim()) start++;
  const info = lines[start]?.match(sourceLine);
  if (!info) return { body: markdown, source: null };
  let linkLine = start + 1;
  while (linkLine < lines.length && !lines[linkLine].trim()) linkLine++;
  const link = lines[linkLine]?.match(sourceLink);
  if (!link) return { body: markdown, source: null };
  const body = lines.slice(linkLine + 1).join('\n').replace(/^\s+/, '');
  return {
    body,
    source: { account: info[1].trim(), publishedAt: info[2]?.replace(' ', 'T') || '', url: link[1] }
  };
}

export function formatBlogSource({ account, publishedAt, url }) {
  if (!url) return '';
  const name = account || 'Scond';
  const time = publishedAt ? `　|　发布时间：${publishedAt.replace('T', ' ')}` : '';
  return `> 公众号：${name}${time}\n\n[原文公众号链接](${url})`;
}

export function sourceFromMeta(meta) {
  const url = String(meta.source_url || '');
  if (!/^https:\/\/mp\.weixin\.qq\.com\/s(?:\/|\?)[^\s<>]*$/.test(url)) return null;
  return {
    account: String(meta.source_account || 'Scond'),
    publishedAt: String(meta.source_published_at || ''),
    url
  };
}
