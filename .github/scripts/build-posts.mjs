// 从 Apps Script 读取全部文章，重新生成 _posts/ 下的文件。
// 用法：node build-posts.mjs [本地 JSON 文件，测试用]
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const POSTS_DIR = "_posts";
const TZ = "Asia/Singapore";

function readApiUrl() {
  const cfg = fs.readFileSync("_config.yml", "utf8");
  const m = cfg.match(/^blog_api_url:\s*(\S+)/m);
  if (!m) throw new Error("_config.yml 里没有 blog_api_url");
  return m[1];
}

async function loadPosts() {
  if (process.argv[2]) return JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const url = readApiUrl() + "?fresh=1"; // 跳过 Apps Script 的缓存
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error("读取文章失败：HTTP " + res.status);
  return res.json();
}

// 把时间换成新加坡时间，例如 "2026-11-13 21:44:59 +0800"
function localParts(value) {
  const d = new Date(value);
  if (isNaN(d)) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(d).map((x) => [x.type, x.value])
  );
  return { day: `${p.year}-${p.month}-${p.day}`, full: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} +0800` };
}

marked.setOptions({ gfm: true, breaks: true }); // 表单里的单个换行也保留

const posts = await loadPosts();
if (!Array.isArray(posts) || posts.length === 0) {
  // 读到空数据时不动现有文章，避免网站被意外清空
  throw new Error("没有读到任何文章，保留现有文件不变");
}

fs.rmSync(POSTS_DIR, { recursive: true, force: true });
fs.mkdirSync(POSTS_DIR);

let written = 0;
for (const post of posts) {
  const t = localParts(post.time);
  if (!t) { console.warn("跳过时间无效的文章：", post.title); continue; }
  const html = marked.parse(String(post.body || ""))
    .replace(/\{%\s*endraw\s*%\}/g, "{&#37; endraw &#37;}"); // 防止正文提前结束 raw 区块
  const front = [
    "---",
    "layout: post",
    "title: " + JSON.stringify(String(post.title || "无题")),
    "date: " + t.full,
    "row: " + JSON.stringify(post.id),
    "---",
  ].join("\n");
  const file = path.join(POSTS_DIR, `${t.day}-${post.id}.html`);
  fs.writeFileSync(file, `${front}\n{% raw %}\n${html}{% endraw %}\n`);
  written++;
}
console.log(`已生成 ${written} 篇文章`);
