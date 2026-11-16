/**
 * 贴到 Google Sheet 的“扩展程序 → Apps Script”里（整段替换旧代码）。
 * 列顺序：时间戳 | 电子邮件地址 | 标题 | 内容（文章由管理后台写入）
 *
 * 另外需要在“项目设置 → 脚本属性”里添加：
 *   GITHUB_TOKEN = 你在 GitHub 生成的细粒度令牌
 */
const OWNER_EMAIL = 'wengkaibin@gmail.com';
const COL = { time: 0, email: 1, title: 2, body: 3 }; // 列号从 0 开始
const CACHE_SECONDS = 300;                            // 缓存 5 分钟
const GITHUB_REPO = 'MrWengKB/blog';

function doGet(e) {
  // 带 ?fresh=1 时跳过缓存（GitHub Actions 同步文章时使用）
  const fresh = e && e.parameter && e.parameter.fresh;
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const hit = cache.get('posts');
    if (hit) return json_(hit);
  }

  const rows = SpreadsheetApp.getActive().getSheets()[0].getDataRange().getValues();
  const posts = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (String(r[COL.email]).trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) continue;
    if (!r[COL.title] && !r[COL.body]) continue;
    posts.push({
      id: i + 1, // 行号作为文章编号
      time: r[COL.time],
      title: String(r[COL.title]),
      body: String(r[COL.body])
    });
  }

  const out = JSON.stringify(posts);
  if (out.length < 90000) cache.put('posts', out, CACHE_SECONDS);
  return json_(out);
}

// 直接在 Sheet 里改了文章后，可以手动运行这个函数，让网站立刻更新
function notifyGitHub() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('脚本属性里还没有 GITHUB_TOKEN');
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify({ event_type: 'new-post' }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 204) {
    throw new Error('通知 GitHub 失败：' + res.getResponseCode() + ' ' + res.getContentText());
  }
}

function clearCache() {
  CacheService.getScriptCache().remove('posts');
}

function json_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
