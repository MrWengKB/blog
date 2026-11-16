/**
 * 喵喵喵老先生的博客 · 管理后台
 *
 * 这是一个独立的 Apps Script 项目（不要贴进 Sheet 里现有的那个脚本）。
 * 部署为网页应用时：执行身份选“我”，访问权限选“只有我自己”。
 * 项目设置 → 脚本属性 里需要添加：GITHUB_TOKEN = 你的 GitHub 细粒度令牌
 */
const SHEET_ID = '1g43so237pbjMp22epIdLBQygIXgRDE8CDshRT-Mkplo';
const OWNER_EMAIL = 'wengkaibin@gmail.com';
const GITHUB_REPO = 'MrWengKB/blog';
const COL = { time: 1, email: 2, title: 3, body: 4 }; // 1 开始的列号

function doGet() {
  checkOwner_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('博客管理')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ---------- 给网页调用的函数 ----------

function listPosts() {
  checkOwner_();
  const rows = sheet_().getDataRange().getValues();
  const posts = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const t = r[COL.time - 1];
    if (!(t instanceof Date)) continue;
    if (String(r[COL.email - 1]).trim().toLowerCase() !== OWNER_EMAIL) continue;
    if (!r[COL.title - 1] && !r[COL.body - 1]) continue;
    posts.push({
      key: t.getTime(),
      time: t.toISOString(),
      title: String(r[COL.title - 1]),
      body: String(r[COL.body - 1])
    });
  }
  posts.sort(function (a, b) { return b.key - a.key; });
  return posts;
}

// post = { key: 数字或 null, title, body }；key 为空时发表新文章
function savePost(post) {
  checkOwner_();
  const title = String(post.title || '').trim();
  const body = String(post.body || '');
  if (!title && !body.trim()) throw new Error('标题和内容不能都是空的');

  return withLock_(function () {
    const sh = sheet_();
    let key;
    if (post.key) {
      const row = findRow_(sh, post.key);
      sh.getRange(row, COL.title, 1, 2).setValues([[title, body]]);
      key = post.key;
    } else {
      const now = new Date();
      now.setMilliseconds(0);
      sh.appendRow([now, OWNER_EMAIL, title, body]);
      key = now.getTime();
    }
    return { key: key, warning: notify_() };
  });
}

function deletePost(key) {
  checkOwner_();
  return withLock_(function () {
    const sh = sheet_();
    const row = findRow_(sh, key);
    // 只清空内容、保留空行，避免打乱表单之后写入的位置
    sh.getRange(row, 1, 1, COL.body).clearContent();
    return { warning: notify_() };
  });
}

// ---------- 内部工具 ----------

function sheet_() {
  return SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
}

function findRow_(sh, key) {
  const times = sh.getRange(2, COL.time, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < times.length; i++) {
    const t = times[i][0];
    if (t instanceof Date && t.getTime() === Number(key)) return i + 2;
  }
  throw new Error('找不到这篇文章，可能已经被删除或修改。请刷新列表后再试。');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function checkOwner_() {
  const me = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (me && me !== OWNER_EMAIL) throw new Error('没有权限');
}

// 通知 GitHub 重新生成网站；失败时不影响已保存的内容，只返回提示
function notify_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return '已保存，但脚本属性里没有 GITHUB_TOKEN，网站要等每天的自动同步才会更新。';
  try {
    const res = UrlFetchApp.fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
      payload: JSON.stringify({ event_type: 'new-post' }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 204) return '';
    return '已保存，但通知 GitHub 失败（' + res.getResponseCode() + '），网站要等每天的自动同步才会更新。';
  } catch (e) {
    return '已保存，但通知 GitHub 失败，网站要等每天的自动同步才会更新。';
  }
}
