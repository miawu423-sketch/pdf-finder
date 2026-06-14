// Publish Time Extractor v1 - Remote Script
// 多层提取：meta 标签 → JSON-LD → 内联script + 全文扫描
// 支持 SPA 延迟重试

(function() {
  'use strict';

  if (document.getElementById('__pub_time')) {
    document.getElementById('__pub_time').remove();
    return;
  }

  var results = [];
  var retried = false;

  // ====== 工具函数 ======
  function formatDate(d) {
    // 强制转换为北京时间 (UTC+8)
    var offset = 8 * 60; // 8小时 = 480分钟
    var localOffset = d.getTimezoneOffset(); // 本地时区与UTC的差值（分钟）
    var beijingTime = new Date(d.getTime() + (offset + localOffset) * 60000);
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var date = beijingTime.getFullYear() + '/' + pad(beijingTime.getMonth()+1) + '/' + pad(beijingTime.getDate());
    var h = beijingTime.getHours(), mi = beijingTime.getMinutes(), s = beijingTime.getSeconds();
    if (h === 0 && mi === 0 && s === 0) return date;
    return date + ' ' + pad(h) + ':' + pad(mi) + ':' + pad(s);
  }

  function parseTime(str) {
    var d = new Date(str);
    if (!isNaN(d.getTime())) return formatDate(d);
    var m = str.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) {
      var rest = str.replace(m[0], '').trim();
      var timeMatch = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (timeMatch) d = new Date(+m[1], +m[2]-1, +m[3], +timeMatch[1], +timeMatch[2], +(timeMatch[3]||0));
      else d = new Date(+m[1], +m[2]-1, +m[3]);
      if (!isNaN(d.getTime())) return formatDate(d);
    }
    return null;
  }

  function dedup() {
    var seen = {}, unique = [];
    results.forEach(function(r) {
      var key = r.label + '|' + r.raw;
      if (!seen[key]) { seen[key] = true; unique.push(r); }
    });
    results = unique;
  }

  // ====== 第 1 层：meta 标签 ======
  function extractMeta() {
    var metaSelectors = [
      { sel: 'meta[property="article:published_time"]', label: 'article:published_time' },
      { sel: 'meta[property="article:modified_time"]', label: 'article:modified_time' },
      { sel: 'meta[name="publishdate"]', label: 'publishdate' },
      { sel: 'meta[name="publish_date"]', label: 'publish_date' },
      { sel: 'meta[name="pubdate"]', label: 'pubdate' },
      { sel: 'meta[name="PubDate"]', label: 'PubDate' },
      { sel: 'meta[name="date"]', label: 'date' },
      { sel: 'meta[name="dc.date"]', label: 'dc.date' },
      { sel: 'meta[name="dc.date.issued"]', label: 'dc.date.issued' },
      { sel: 'meta[name="citation_publication_date"]', label: 'citation_publication_date' },
      { sel: 'meta[name="citation_online_date"]', label: 'citation_online_date' },
      { sel: 'meta[name="citation_date"]', label: 'citation_date' },
      { sel: 'meta[itemprop="datePublished"]', label: 'itemprop:datePublished' },
      { sel: 'meta[itemprop="dateModified"]', label: 'itemprop:dateModified' },
      { sel: 'meta[name="article.published"]', label: 'article.published' },
      { sel: 'meta[name="sailthru.date"]', label: 'sailthru.date' },
      { sel: 'meta[name="article_date_original"]', label: 'article_date_original' },
      { sel: 'meta[name="og:updated_time"]', label: 'og:updated_time' },
      { sel: 'meta[property="og:updated_time"]', label: 'og:updated_time' },
      { sel: 'meta[name="last-modified"]', label: 'last-modified' },
      { sel: 'meta[http-equiv="last-modified"]', label: 'http-equiv:last-modified' },
      { sel: 'meta[name="weibo:article:create_at"]', label: 'weibo:article:create_at' },
      { sel: 'meta[name="created"]', label: 'created' },
      { sel: 'meta[name="pub_date"]', label: 'pub_date' }
    ];

    document.querySelectorAll('meta[name][content]').forEach(function(el) {
      var name = el.getAttribute('name');
      var content = el.getAttribute('content');
      if (!name || !content) return;
      if (/date|time|publish|pubdate/i.test(name)) {
        if (/\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}/.test(content) || /\d{8}/.test(content)) {
          var alreadyKnown = metaSelectors.some(function(m) { return m.sel === 'meta[name="' + name + '"]'; });
          if (!alreadyKnown) metaSelectors.push({ sel: 'meta[name="' + name + '"]', label: name });
        }
      }
    });

    metaSelectors.forEach(function(m) {
      var el = document.querySelector(m.sel);
      if (el) {
        var val = el.getAttribute('content');
        if (val && val.trim()) {
          results.push({ source: 'meta', label: m.label, raw: val.trim(), parsed: parseTime(val.trim()) });
        }
      }
    });
  }

  // ====== 第 2 层：JSON-LD ======
  function extractJsonLd() {
    function walk(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(walk); return; }
      if (obj.datePublished) results.push({ source: 'json-ld', label: 'datePublished', raw: String(obj.datePublished), parsed: parseTime(String(obj.datePublished)) });
      if (obj.dateModified) results.push({ source: 'json-ld', label: 'dateModified', raw: String(obj.dateModified), parsed: parseTime(String(obj.dateModified)) });
      if (obj.dateCreated) results.push({ source: 'json-ld', label: 'dateCreated', raw: String(obj.dateCreated), parsed: parseTime(String(obj.dateCreated)) });
      if (obj['@graph']) walk(obj['@graph']);
      if (obj.mainEntity) walk(obj.mainEntity);
    }
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s) {
      try { walk(JSON.parse(s.textContent)); } catch(e) {}
    });
  }

  // ====== 第 3 层：内联 script + 全文扫描 ======
  function extractScript(text) {
    if (!text || text.length < 10) return;

    // ASP.NET /Date(milliseconds+tz)/
    var re = /\/Date\((\d{10,13})([+-]\d{4})?\)\//g, m;
    while ((m = re.exec(text)) !== null) {
      var ms = +m[1]; if (m[1].length === 10) ms *= 1000;
      var dt = new Date(ms);
      if (!isNaN(dt.getTime()) && dt.getFullYear() >= 2000 && dt.getFullYear() <= 2100) {
        var ctx = text.substring(Math.max(0, m.index - 300), m.index);
        var vm = ctx.match(/(\w+(?:Time|time|Date|date|Publish|publish|Create|create))\s*[=:]/);
        results.push({ source: 'script', label: vm ? vm[1] : 'inline /Date/', raw: m[0], parsed: formatDate(dt) });
      }
    }

    // 时间戳变量（publishTime: 1762972985000）
    var tr = /\b(publishTime|createTime|pubTime|pubtime|create_time|publish_date|publishTime|createtime)\b\s*[=:]\s*["']?(\d{10,13})["']?/gi, tm;
    while ((tm = tr.exec(text)) !== null) {
      var v = +tm[2]; if (tm[2].length === 10) v *= 1000;
      var d2 = new Date(v);
      if (!isNaN(d2.getTime()) && d2.getFullYear() >= 2000 && d2.getFullYear() <= 2100) {
        results.push({ source: 'script', label: tm[1], raw: tm[2], parsed: formatDate(d2) });
      }
    }

    // ISO 字符串（"publishTime":"2025-11-13 08:00:00"）
    var ir = /\b(publishTime|createTime|pubTime|pubtime|create_time|publish_date)\b\s*[=:]\s*"([^"]{10,30})"/gi, im;
    while ((im = ir.exec(text)) !== null) {
      var pt = parseTime(im[2]);
      if (pt) results.push({ source: 'script', label: im[1], raw: im[2], parsed: pt });
    }
  }

  // ====== 执行全部提取 ======
  function extractAll() {
    extractMeta();
    extractJsonLd();
    document.querySelectorAll('script:not([src])').forEach(function(s) { extractScript(s.textContent); });
    try { var fullHTML = document.documentElement.outerHTML || ''; if (fullHTML) extractScript(fullHTML); } catch(e) {}
    dedup();
  }

  extractAll();

  // ====== 渲染 ======
  var d = document.createElement('div');
  d.id = '__pub_time';
  d.style.cssText = 'position:fixed;top:0;right:0;width:420px;max-height:80vh;z-index:2147483647;font:14px system-ui,-apple-system,sans-serif;color:#1d1d1f;';
  var sh = d.attachShadow({ mode: 'open' });

  var css = [
    '*{margin:0;padding:0;box-sizing:border-box}:host{all:initial}',
    '.P{background:#fff;border-radius:0 0 0 12px;box-shadow:0 4px 32px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:80vh;overflow:hidden}',
    '.H{background:#1d1d1f;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}',
    '.H h2{font:500 13px/1.4 system-ui}',
    '.X{background:rgba(255,255,255,.2);border:0;color:#fff;width:24px;height:24px;border-radius:50%;font:16px/1 sans-serif;cursor:pointer}',
    '.X:hover{background:rgba(255,255,255,.35)}',
    '.B{overflow-y:auto;padding:12px;flex:1}',
    '.I{padding:10px 12px;margin:6px 0;background:#f8f8fa;border:1px solid #e8e8ed;border-radius:8px}',
    '.I.primary{background:#f0faf4;border-color:#34c759}',
    '.IH{display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap}',
    '.T{display:inline-block;padding:2px 7px;border-radius:4px;font:500 11px/1.6 system-ui;color:#fff}',
    '.Tm{background:#34c759}.Tj{background:#0071e3}.Ts{background:#ff9f0a}',
    '.label{font:12px system-ui;color:#86868b}',
    '.time{font:500 15px/1.4 "SF Mono",Menlo,Consolas,monospace;color:#1d1d1f;margin:4px 0}',
    '.raw{font:11px/1.4 "SF Mono",Menlo,Consolas,monospace;color:#86868b;word-break:break-all}',
    '.A{display:flex;gap:6px;margin-top:8px}',
    '.b{font:12px system-ui;padding:4px 12px;border-radius:6px;border:1px solid #d2d2d7;background:#fff;cursor:pointer;color:#1d1d1f}',
    '.b:hover{background:#f0f0f0}.bp{background:#0071e3;color:#fff;border-color:#0071e3}.bp:hover{background:#0077ed}',
    '.E{text-align:center;padding:24px 16px;color:#86868b;font-size:13px;line-height:1.8}',
    '.divider{font-size:11px;color:#999;padding:8px 0 4px;border-top:1px dashed #e8e8ed;margin-top:8px}',
    '.E .trying{font-size:11px;color:#ff9f0a;margin-top:8px}'
  ].join('');

  function getBestIndex() {
    for (var i = 0; i < results.length; i++)
      if (/published|pubdate|publish_date|publishdate|citation_publication/i.test(results[i].label)) return i;
    return results.length > 0 ? 0 : -1;
  }

  function renderPanel() {
    var bestIdx = getBestIndex();
    var divs = [
      { source: 'meta', label: 'Meta \u6807\u7b7e' },
      { source: 'json-ld', label: 'JSON-LD \u7ed3\u6784\u5316\u6570\u636e' },
      { source: 'script', label: '\u5185\u8054\u811a\u672c (script)' }
    ];

    var h = '<style>' + css + '</style><div class="P"><div class="H"><h2>\u53d1\u5e03\u65f6\u95f4\u63d0\u53d6 \u2014 ' +
      (results.length ? '\u627e\u5230 ' + results.length + ' \u4e2a' : '\u672a\u627e\u5230') +
      '</h2><button class="X" id="cls">\u00d7</button></div><div class="B">';

    if (!results.length) {
      h += '<div class="E">\u672a\u627e\u5230\u53d1\u5e03\u65f6\u95f4<br><br>\u53ef\u80fd\u7684\u539f\u56e0\uff1a<br>\u2022 \u8be5\u9875\u9762\u672a\u5728\u6e90\u7801\u4e2d\u6807\u6ce8\u65f6\u95f4<br>\u2022 \u65f6\u95f4\u7531 JS \u52a8\u6001\u52a0\u8f7d<br>\u2022 \u975e\u6587\u7ae0\u7c7b\u9875\u9762';
      if (!retried) h += '<div class="trying">\u6b63\u5728\u5c1d\u8bd5\u5ef6\u8fdf\u626b\u63cf\u2026</div>';
      h += '</div>';
    }

    var prevSource = '';
    results.forEach(function(r, i) {
      if (r.source !== prevSource && i > 0) {
        var lbl = divs.filter(function(d) { return d.source === r.source; })[0];
        h += '<div class="divider">' + (lbl ? lbl.label : r.source) + '</div>';
      }
      prevSource = r.source;
      var cls = 'I' + (i === bestIdx ? ' primary' : '');
      var tagCls = r.source === 'meta' ? 'Tm' : (r.source === 'json-ld' ? 'Tj' : 'Ts');
      h += '<div class="' + cls + '"><div class="IH">';
      h += '<span class="T ' + tagCls + '">' + r.source + '</span>';
      h += '<span class="label">' + r.label + '</span></div>';
      if (r.parsed) h += '<div class="time">' + r.parsed + '</div>';
      h += '<div class="raw">\u539f\u59cb\u503c: ' + r.raw.replace(/</g, '&lt;') + '</div>';
      h += '<div class="A"><button class="b bp" data-c="' + i + '">\u590d\u5236\u65f6\u95f4</button>';
      h += '<button class="b" data-r="' + i + '">\u590d\u5236\u539f\u59cb\u503c</button></div></div>';
    });
    h += '</div></div>';
    return h;
  }

  function bindEvents() {
    sh.getElementById('cls').onclick = function() { d.remove(); if (window.__pub_time_timer) clearInterval(window.__pub_time_timer); };
    sh.querySelectorAll('[data-c]').forEach(function(btn) {
      btn.onclick = function() {
        var r = results[+this.getAttribute('data-c')];
        var text = r.parsed || r.raw;
        navigator.clipboard.writeText(text).then(function() {
          btn.textContent = '\u5df2\u590d\u5236!';
          setTimeout(function() { btn.textContent = '\u590d\u5236\u65f6\u95f4'; }, 1500);
        }).catch(function() { prompt('\u590d\u5236:', text); });
      };
    });
    sh.querySelectorAll('[data-r]').forEach(function(btn) {
      btn.onclick = function() {
        var raw = results[+this.getAttribute('data-r')].raw;
        navigator.clipboard.writeText(raw).then(function() {
          btn.textContent = '\u5df2\u590d\u5236!';
          setTimeout(function() { btn.textContent = '\u590d\u5236\u539f\u59cb\u503c'; }, 1500);
        }).catch(function() { prompt('\u590d\u5236:', raw); });
      };
    });
  }

  function updatePanel() {
    sh.innerHTML = renderPanel();
    bindEvents();
  }

  updatePanel();
  document.body.appendChild(d);

  // 自动复制最可能的发布时间
  var bestIdx = getBestIndex();
  if (bestIdx >= 0 && results[bestIdx].parsed) {
    navigator.clipboard.writeText(results[bestIdx].parsed).catch(function() {});
  }

  // SPA 延迟重试：如果首次没找到，每 1.5s 重试一次，最多 3 次
  if (results.length === 0) {
    var retryCount = 0;
    window.__pub_time_timer = setInterval(function() {
      retryCount++;
      extractMeta();
      document.querySelectorAll('script:not([src])').forEach(function(s) { extractScript(s.textContent); });
      dedup();
      if (results.length > 0 || retryCount >= 3) {
        clearInterval(window.__pub_time_timer);
        retried = true;
        updatePanel();
        if (results.length > 0 && results[getBestIndex()] && results[getBestIndex()].parsed) {
          navigator.clipboard.writeText(results[getBestIndex()].parsed).catch(function() {});
        }
      }
    }, 1500);
  }
})();
