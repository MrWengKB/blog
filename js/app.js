(function () {
  "use strict";

  var app = document.getElementById("app");
  var CACHE_KEY = "meow-blog-posts";
  var SITE_TITLE = "喵喵喵老先生的博客";
  var posts = null;

  document.getElementById("year").textContent = new Date().getFullYear();

  // 单个换行也保留为换行，适合表单里直接分段书写
  marked.setOptions({ gfm: true, breaks: true });

  // ---------- 工具函数 ----------
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatDate(value) {
    var d = new Date(value);
    if (isNaN(d)) return "";
    return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
  }

  function isoDate(value) {
    var d = new Date(value);
    return isNaN(d) ? "" : d.toISOString();
  }

  function renderMarkdown(text) {
    return DOMPurify.sanitize(marked.parse(String(text || "")));
  }

  function makeExcerpt(text) {
    var plain = String(text || "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // 去掉图片
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")   // 链接只留文字
      .replace(/[#>*_`~|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return plain.length > 90 ? plain.slice(0, 90) + "…" : plain;
  }

  // ---------- 本地缓存：先显示上次的内容，再静默更新 ----------
  function readCache() {
    try {
      var v = localStorage.getItem(CACHE_KEY);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* 忽略 */ }
  }

  // ---------- 页面渲染 ----------
  function renderMessage(html) {
    app.innerHTML = '<p class="message">' + html + "</p>";
  }

  function renderList() {
    document.title = SITE_TITLE;
    if (!posts.length) {
      renderMessage("还没有文章。用表单写下第一篇吧。");
      return;
    }
    var items = posts.map(function (p) {
      return '<li class="post-item">' +
        '<time datetime="' + isoDate(p.time) + '">' + formatDate(p.time) + "</time>" +
        '<h2><a href="#p-' + encodeURIComponent(p.id) + '">' + escapeHtml(p.title || "无题") + "</a></h2>" +
        "<p>" + escapeHtml(makeExcerpt(p.body)) + "</p>" +
        "</li>";
    }).join("");
    app.innerHTML = '<ul class="post-list">' + items + "</ul>";
  }

  function renderPost(id) {
    var post = posts.filter(function (p) { return String(p.id) === id; })[0];
    if (!post) {
      document.title = SITE_TITLE;
      app.innerHTML = '<a class="back" href="#">‹ 返回文章列表</a>' +
        '<p class="message">找不到这篇文章，它可能已被删除。</p>';
      return;
    }
    var title = post.title || "无题";
    document.title = title + " - " + SITE_TITLE;
    app.innerHTML =
      '<a class="back" href="#">‹ 返回文章列表</a>' +
      "<article>" +
        '<header class="post-header">' +
          "<h2>" + escapeHtml(title) + "</h2>" +
          '<time datetime="' + isoDate(post.time) + '">' + formatDate(post.time) + "</time>" +
        "</header>" +
        '<div class="post-body">' + renderMarkdown(post.body) + "</div>" +
      "</article>" +
      '<footer class="post-footer"><a class="back" href="#">‹ 返回文章列表</a></footer>';
  }

  function route(scrollTop) {
    if (!posts) return;
    var match = location.hash.match(/^#p-(.+)$/);
    if (match) renderPost(decodeURIComponent(match[1]));
    else renderList();
    if (scrollTop) window.scrollTo(0, 0);
  }

  // ---------- 读取数据 ----------
  function load() {
    var url = window.BLOG_CONFIG && window.BLOG_CONFIG.apiUrl;
    if (!url || url.indexOf("在这里") !== -1) {
      renderMessage("还没有设置文章来源：请在 <code>js/config.js</code> 里填入 Apps Script 网页应用的网址。");
      return;
    }

    var cached = readCache();
    if (cached) {
      posts = cached;
      route(false);
    } else {
      renderMessage("正在加载文章…");
    }

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) throw new Error("返回的数据格式不正确");
        data.sort(function (a, b) { return new Date(b.time) - new Date(a.time); });
        var changed = JSON.stringify(data) !== JSON.stringify(cached);
        posts = data;
        writeCache(data);
        if (changed) route(false);
      })
      .catch(function (err) {
        console.error(err);
        if (!cached) {
          renderMessage("文章没有加载出来。请检查网络后刷新页面；如果一直这样，请确认 Apps Script 已部署且访问权限为“任何人”。");
        }
      });
  }

  window.addEventListener("hashchange", function () { route(true); });
  load();
})();
