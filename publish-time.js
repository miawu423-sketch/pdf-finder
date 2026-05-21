// Publish Time Extractor v1 - Remote Script
// 从页面 meta 标签和 JSON-LD 中提取发布时间

(function() {
  'use strict';

  // 如果已存在面板，点击则关闭
  if (document.getElementById('__pub_time')) {
    document.getElementById('__pub_time').remove();
    return;
  }

  var results = [];

  // === 第 1 层：meta 标签 ===
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

  // 补充：通用扫描所有 meta 标签，匹配 name 中含 date/time/publish 的
  document.querySelectorAll('meta[name][content]').forEach(function(el) {
    var name = el.getAttribute('name');
    var content = el.getAttribute('content');
    if (!name || !content) return;
    var nameLower = name.toLowerCase();
    if (/date|time|publish|pubdate/.test(nameLower)) {
      // 检查 content 是否像日期（含数字和分隔符）
      if (/\d{4}[\-\/\.]\d{1,2}[\-\/\.]\d{1,2}/.test(content) || /\d{8}/.test(content)) {
        var alreadyFound = metaSelectors.some(function(m) {
          return m.sel === 'meta[name="' + name + '"]';
        });
        if (!alreadyFound) {
          metaSelectors.push({ sel: 'meta[name="' + name + '"]', label: name });
        }
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

  // === 第 2 层：JSON-LD ===
  document.querySelectorAll('script[type="application/ld+json"]').forEach(function(script) {
    try {
      var data = JSON.parse(script.textContent);
      extractFromJsonLd(data);
    } catch (e) {}
  });

  function extractFromJsonLd(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      obj.forEach(function(item) { extractFromJsonLd(item); });
      return;
    }
    if (obj.datePublished) {
      results.push({ source: 'json-ld', label: 'datePublished', raw: String(obj.datePublished), parsed: parseTime(String(obj.datePublished)) });
    }
    if (obj.dateModified) {
      results.push({ source: 'json-ld', label: 'dateModified', raw: String(obj.dateModified), parsed: parseTime(String(obj.dateModified)) });
    }
    if (obj.dateCreated) {
      results.push({ source: 'json-ld', label: 'dateCreated', raw: String(obj.dateCreated), parsed: parseTime(String(obj.dateCreated)) });
    }
    // 递归查找嵌套对象
    if (obj['@graph']) extractFromJsonLd(obj['@graph']);
    if (obj.mainEntity) extractFromJsonLd(obj.mainEntity);
  }

  // === 时间解析 ===
  function parseTime(str) {
    // 尝试直接 Date.parse
    var d = new Date(str);
    if (!isNaN(d.getTime())) {
      return formatDate(d);
    }
    // 处理 2025/03/15 格式
    var m = str.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (m) {
      var rest = str.replace(m[0], '').trim();
      var timeMatch = rest.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (timeMatch) {
        d = new Date(+m[1], +m[2]-1, +m[3], +timeMatch[1], +timeMatch[2], +(timeMatch[3]||0));
      } else {
        d = new Date(+m[1], +m[2]-1, +m[3]);
      }
      if (!isNaN(d.getTime())) return formatDate(d);
    }
    return null;
  }

  function formatDate(d) {
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var date = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
    var h = d.getHours(), mi = d.getMinutes(), s = d.getSeconds();
    if (h === 0 && mi === 0 && s === 0) return date;
    return date + ' ' + pad(h) + ':' + pad(mi) + ':' + pad(s);
  }

  // === 去重 ===
  var seen = {};
  var unique = [];
  results.forEach(function(r) {
    var key = r.label + '|' + r.raw;
    if (!seen[key]) {
      seen[key] = true;
      unique.push(r);
    }
  });
  results = unique;

  // === 渲染面板 ===
  var d = document.createElement('div');
  d.id = '__pub_time';
  d.style.cssText = 'position:fixed;top:0;right:0;width:420px;max-height:80vh;z-index:2147483647;font:14px system-ui,-apple-system,sans-serif;color:#1d1d1f;';

  var sh = d.attachShadow({ mode: 'open' });

  var css = [
    '*{margin:0;padding:0;box-sizing:border-box}',
    ':host{all:initial}',
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
    '.Tm{background:#34c759}',
    '.Tj{background:#0071e3}',
    '.label{font:12px system-ui;color:#86868b}',
    '.time{font:500 15px/1.4 "SF Mono",Menlo,Consolas,monospace;color:#1d1d1f;margin:4px 0}',
    '.raw{font:11px/1.4 "SF Mono",Menlo,Consolas,monospace;color:#86868b;word-break:break-all}',
    '.A{display:flex;gap:6px;margin-top:8px}',
    '.b{font:12px system-ui;padding:4px 12px;border-radius:6px;border:1px solid #d2d2d7;background:#fff;cursor:pointer;color:#1d1d1f}',
    '.b:hover{background:#f0f0f0}',
    '.bp{background:#0071e3;color:#fff;border-color:#0071e3}',
    '.bp:hover{background:#0077ed}',
    '.E{text-align:center;padding:24px 16px;color:#86868b;font-size:13px;line-height:1.8}',
    '.divider{font-size:11px;color:#999;padding:8px 0 4px;border-top:1px dashed #e8e8ed;margin-top:8px}'
  ].join('');

  // 找到最可能的发布时间（优先 published 而非 modified）
  var publishIdx = -1;
  for (var i = 0; i < results.length; i++) {
    if (/published|pubdate|publish_date|publishdate|citation_publication/.test(results[i].label)) {
      publishIdx = i;
      break;
    }
  }
  if (publishIdx === -1 && results.length > 0) publishIdx = 0;

  var h = '<style>' + css + '</style><div class="P"><div class="H"><h2>\u53d1\u5e03\u65f6\u95f4\u63d0\u53d6 \u2014 ' +
    (results.length ? '\u627e\u5230 ' + results.length + ' \u4e2a' : '\u672a\u627e\u5230') +
    '</h2><button class="X" id="cls">\u00d7</button></div><div class="B">';

  if (!results.length) {
    h += '<div class="E">\u672a\u627e\u5230\u53d1\u5e03\u65f6\u95f4<br><br>\u53ef\u80fd\u7684\u539f\u56e0\uff1a<br>\u2022 \u8be5\u9875\u9762\u672a\u5728\u6e90\u7801\u4e2d\u6807\u6ce8\u65f6\u95f4<br>\u2022 \u65f6\u95f4\u7531 JS \u52a8\u6001\u52a0\u8f7d<br>\u2022 \u975e\u6587\u7ae0\u7c7b\u9875\u9762</div>';
  }

  var prevSource = '';
  results.forEach(function(r, i) {
    if (r.source !== prevSource && i > 0) {
      h += '<div class="divider">' + (r.source === 'json-ld' ? 'JSON-LD \u7ed3\u6784\u5316\u6570\u636e' : 'Meta \u6807\u7b7e') + '</div>';
    }
    prevSource = r.source;

    var cls = 'I';
    if (i === publishIdx) cls += ' primary';

    h += '<div class="' + cls + '"><div class="IH">';
    h += '<span class="T ' + (r.source === 'meta' ? 'Tm' : 'Tj') + '">' + r.source + '</span>';
    h += '<span class="label">' + r.label + '</span></div>';
    if (r.parsed) {
      h += '<div class="time">' + r.parsed + '</div>';
    }
    h += '<div class="raw">\u539f\u59cb\u503c: ' + r.raw.replace(/</g, '&lt;') + '</div>';
    h += '<div class="A"><button class="b bp" data-c="' + i + '">\u590d\u5236\u65f6\u95f4</button>';
    h += '<button class="b" data-r="' + i + '">\u590d\u5236\u539f\u59cb\u503c</button></div></div>';
  });

  h += '</div></div>';
  sh.innerHTML = h;

  // 事件绑定
  sh.getElementById('cls').onclick = function() { d.remove(); };

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

  document.body.appendChild(d);

  // 如果只找到一个 published 时间，自动复制
  if (publishIdx >= 0 && results[publishIdx].parsed) {
    navigator.clipboard.writeText(results[publishIdx].parsed).catch(function() {});
  }
})();
