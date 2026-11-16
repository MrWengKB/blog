(function () {
  "use strict";

  var app = document.getElementById("app");
  var CACHE_KEY = "meow-blog-posts";
  var SITE_TITLE = "喵喵喵老先生的博客";
  var PAGE_SIZE = 5;
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

  function pageHref(n) { return n > 1 ? "#page-" + n : "#"; }

  function renderList(page) {
    if (!posts.length) {
      document.title = SITE_TITLE;
      renderMessage("还没有文章。用表单写下第一篇吧。");
      return;
    }
    var total = Math.ceil(posts.length / PAGE_SIZE);
    page = Math.min(Math.max(page || 1, 1), total);
    document.title = page > 1 ? "第 " + page + " 页 - " + SITE_TITLE : SITE_TITLE;

    // 只渲染当前页的五篇全文，其余文章不渲染
    var start = (page - 1) * PAGE_SIZE;
    var items = posts.slice(start, start + PAGE_SIZE).map(function (p) {
      return '<li class="post-item">' +
        '<time datetime="' + isoDate(p.time) + '">' + formatDate(p.time) + "</time>" +
        '<h2><a href="#p-' + encodeURIComponent(p.id) + '">' + escapeHtml(p.title || "无题") + "</a></h2>" +
        '<div class="post-body">' + renderMarkdown(p.body) + "</div>" +
        "</li>";
    }).join("");

    var pager = "";
    if (total > 1) {
      pager = '<nav class="pager" aria-label="翻页">' +
        (page > 1 ? '<a class="pager-prev" href="' + pageHref(page - 1) + '">‹ 较新的文章</a>' : "<span></span>") +
        '<span class="pager-count">' + page + " / " + total + "</span>" +
        (page < total ? '<a class="pager-next" href="' + pageHref(page + 1) + '">较旧的文章 ›</a>' : "<span></span>") +
        "</nav>";
    }
    app.innerHTML = '<ul class="post-list">' + items + "</ul>" + pager;
  }

  function renderPost(id) {
    var post = posts.filter(function (p) { return String(p.id) === id; })[0];
    if (!post) {
      document.title = SITE_TITLE;
      app.innerHTML = '<a class="back" href="#">‹ 返回文章列表</a>' +
        '<p class="message">找不到这篇文章，它可能已被删除。</p>';
      return;
    }
    var back = '<a class="back" href="' + pageHref(Math.floor(posts.indexOf(post) / PAGE_SIZE) + 1) + '">‹ 返回文章列表</a>';
    var title = post.title || "无题";
    document.title = title + " - " + SITE_TITLE;
    app.innerHTML =
      back +
      "<article>" +
        '<header class="post-header">' +
          "<h2>" + escapeHtml(title) + "</h2>" +
          '<time datetime="' + isoDate(post.time) + '">' + formatDate(post.time) + "</time>" +
        "</header>" +
        '<div class="post-body">' + renderMarkdown(post.body) + "</div>" +
      "</article>" +
      '<footer class="post-footer">' + back + "</footer>";
  }

  function route(scrollTop) {
    if (!posts) return;
    var match = location.hash.match(/^#p-(.+)$/);
    var pageMatch = location.hash.match(/^#page-(\d+)$/);
    if (match) renderPost(decodeURIComponent(match[1]));
    else renderList(pageMatch ? parseInt(pageMatch[1], 10) : 1);
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
