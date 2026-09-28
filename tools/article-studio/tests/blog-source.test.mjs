import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBlogSource, formatBlogSource } from '../public/blog-source.js';

test('moves an existing blog attribution out of article body', () => {
  const source = {
    account: 'Scond',
    publishedAt: '2026-09-25T17:29',
    url: 'https://mp.weixin.qq.com/s/iN0eO_5WpdBDWMl_60yWcA'
  };
  const markdown = `${formatBlogSource(source)}\n\n正文第一段。`;
  assert.deepEqual(extractBlogSource(markdown), { body: '正文第一段。', source });
});

test('does not remove a source-like paragraph without a valid link', () => {
  const markdown = '> 公众号：Scond　|　发布时间：2026-09-25 17:29\n\n正文第一段。';
  assert.deepEqual(extractBlogSource(markdown), { body: markdown, source: null });
});
