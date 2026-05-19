// Paper PDF Finder v4 - Remote Script
// https://github.com/你的用户名/pdf-finder
// 使用者的书签只需加载这个文件，每次点击自动获取最新版本

(function() {
  'use strict';

  // 如果已存在面板，点击则关闭
  if (document.getElementById('__pdf_finder')) {
    document.getElementById('__pdf_finder').remove();
    return;
  }

  var L = [], S = {}, host = location.hostname.replace(/^www\./, '');

  // === 页面分析 ===
  var bodyText = (document.body ? document.body.innerText : '').substring(0, 5000);

  var isOA = !!(
    document.querySelector('[data-test=open-access],[class*=open-access],[class*=openaccess],a[href*=creativecommons],span.c-article-open-access,.oa-label,.open-access') ||
    /open\s*access/i.test(bodyText.substring(0, 500))
  );

  var hasPay = /buy\s*(this)?\s*article|subscription\s*content|log\s*in\s*via|purchase.*pdf|rent\s*this/i.test(bodyText);

  var hasFreePDF = !!document.querySelector(
    'a[data-article-pdf],a.c-pdf-download__link,[class*=pdf-download] a,a[href*="/pdf/"][data-track],.download-pdf a'
  );

  // === 提取当前文章标识符（仅 ScienceDirect 用） ===
  var pageId = '';
  var pm;
  if (pm = location.pathname.match(/\/pii\/(S\d+)/)) pageId = pm[1];

  // PII 过滤：只对 ScienceDirect 生效
  function isThisArticle(url) {
    if (!pageId) return true;
    if (pageId.match(/^S\d+/)) {
      var m2 = url.match(/pii\/(S\d+)/);
      if (m2) return m2[1] === pageId;
      return true;
    }
    return true;
  }

  // === 添加链接 ===
  function add(u, s, t, forceLocal) {
    u = u.trim();
    if (!u || S[u]) return;
    if (/\.(css|js|map|woff2?|ttf|eot|svg|png|jpe?g|gif)$/i.test(u)) return;
    S[u] = 1;

    var ext = false;
    try {
      var uh = new URL(u).hostname.replace(/^www\./, '');
      ext = (uh !== host);
    } catch (e) {}
    if (forceLocal) ext = false;

    var needSub = false;
    if (!isOA && hasPay && !hasFreePDF) needSub = true;

    L.push({ u: u, s: s, t: t || '', ext: ext, pay: needSub });
  }

  // === 1. meta citation_pdf_url（最可靠） ===
  document.querySelectorAll('meta[name="citation_pdf_url"]').forEach(function(m) {
    var c = m.getAttribute('content');
    if (c) {
      try { add(new URL(c, location.href).href, 'meta', '\u672c\u6587 PDF', true); } catch (e) {}
    }
  });

  // === 2. 页面链接扫描 ===
  document.querySelectorAll('a[href]').forEach(function(a) {
    var h = a.getAttribute('href');
    if (!h) return;
    if (/\.pdf|\/(pdf|epdf)\/|pdfft|pdfdirect/i.test(h)) {
      try {
        var full = new URL(h, location.href).href;
        if (!isThisArticle(full)) return;
        add(full, 'link', a.textContent.trim().slice(0, 40), false);
      } catch (e) {}
    }
  });

  // === 3. 内嵌对象 ===
  document.querySelectorAll('iframe[src],embed[src],object[data]').forEach(function(el) {
    var s = el.getAttribute('src') || el.getAttribute('data');
    if (s && /\.pdf/i.test(s)) {
      try { add(new URL(s, location.href).href, 'embed', el.tagName.toLowerCase(), false); } catch (e) {}
    }
  });

  // === 排序：meta 优先，外部链接靠后 ===
  L.sort(function(a, b) {
    if (a.s === 'meta' && b.s !== 'meta') return -1;
    if (b.s === 'meta' && a.s !== 'meta') return 1;
    if (a.ext && !b.ext) return 1;
    if (!a.ext && b.ext) return -1;
    return 0;
  });

  // 只有 1 条结果时，不标外部
  if (L.length === 1) L[0].ext = false;

  // === 渲染面板（Shadow DOM 隔离样式） ===
  var d = document.createElement('div');
  d.id = '__pdf_finder';
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
    '.I.main{background:#f0faf4;border-color:#34c759}',
    '.I.ext{opacity:0.55}',
    '.IH{display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap}',
    '.T{display:inline-block;padding:2px 7px;border-radius:4px;font:500 11px/1.6 system-ui;color:#fff}',
    '.Tm{background:#34c759}',
    '.Tl{background:#0071e3}',
    '.Tle{background:#999}',
    '.badge{display:inline-block;padding:1px 6px;border-radius:4px;font:500 10px/1.6 system-ui;border:1px solid #34c759;color:#34c759}',
    '.badge-ext{border-color:#999;color:#999}',
    '.badge-pay{border-color:#ffc107;color:#856404;background:#fff3cd}',
    '.D{font-size:11px;color:#86868b}',
    '.U{font:12px/1.4 "SF Mono",Menlo,Consolas,monospace;color:#0066cc;word-break:break-all;text-decoration:none;display:block;margin:4px 0}',
    '.U:hover{text-decoration:underline}',
    '.A{display:flex;gap:6px;margin-top:8px}',
    '.b{font:12px system-ui;padding:4px 12px;border-radius:6px;border:1px solid #d2d2d7;background:#fff;cursor:pointer;color:#1d1d1f}',
    '.b:hover{background:#f0f0f0}',
    '.bp{background:#0071e3;color:#fff;border-color:#0071e3}',
    '.bp:hover{background:#0077ed}',
    '.E{text-align:center;padding:24px 16px;color:#86868b;font-size:13px;line-height:1.8}',
    '.sep{font-size:11px;color:#999;padding:8px 0 4px;border-top:1px dashed #e8e8ed;margin-top:8px}',
    '.warn{display:block;margin-top:6px;padding:5px 8px;background:#fff3cd;border:1px solid #ffc107;border-radius:4px;font-size:11px;color:#856404;line-height:1.5}'
  ].join('');

  var h = '<style>' + css + '</style><div class="P"><div class="H"><h2>PDF \u63d0\u53d6\u5668 \u2014 ' +
    (L.length ? '\u627e\u5230 ' + L.length + ' \u4e2a' : '\u672a\u627e\u5230') +
    '</h2><button class="X" id="cls">\u00d7</button></div><div class="B">';

  if (!L.length) {
    h += '<div class="E">\u672a\u627e\u5230 PDF \u94fe\u63a5<br><br>\u53ef\u80fd\u7684\u539f\u56e0\uff1a<br>\u2022 \u9700\u8981\u767b\u5f55\u673a\u6784\u8d26\u53f7\u540e\u624d\u80fd\u83b7\u53d6<br>\u2022 \u9875\u9762\u672a\u5b8c\u5168\u52a0\u8f7d\uff0c\u7a0d\u540e\u518d\u8bd5<br><br>\u515c\u5e95\u65b9\u6cd5\uff1a<br>F12 > Network > \u70b9\u51fb\u9875\u9762\u4e0a\u7684<br>Download PDF \u6309\u94ae > \u67e5\u770b\u8bf7\u6c42 URL</div>';
  }

  var prevExt = false;
  L.forEach(function(l, i) {
    if (l.ext && !prevExt && i > 0) {
      h += '<div class="sep">\u4ee5\u4e0b\u4e3a\u5916\u90e8\u6258\u7ba1\u94fe\u63a5</div>';
    }
    prevExt = l.ext;

    var cls = 'I';
    if ((l.s === 'meta' || L.length === 1) && !l.pay) cls += ' main';
    if (l.ext) cls += ' ext';

    h += '<div class="' + cls + '"><div class="IH">';
    h += '<span class="T ' + (l.s === 'meta' ? 'Tm' : (l.ext ? 'Tle' : 'Tl')) + '">' + l.s + '</span>';

    if ((l.s === 'meta' || L.length === 1) && !l.pay) h += '<span class="badge">\u672c\u6587</span>';
    if (l.pay) h += '<span class="badge badge-pay">\u53ef\u80fd\u9700\u8981\u8ba2\u9605</span>';
    if (l.ext) h += '<span class="badge badge-ext">\u5916\u90e8\u6258\u7ba1</span>';

    h += '<span class="D">' + l.t.replace(/</g, '&lt;') + '</span></div>';
    h += '<a class="U" href="' + l.u + '" target="_blank" rel="noopener">' + l.u.replace(/</g, '&lt;') + '</a>';

    if (l.pay) {
      h += '<div class="warn">\u26a0\ufe0f \u6b64\u6587\u7ae0\u53ef\u80fd\u9700\u8981\u8ba2\u9605\u6216\u4ed8\u8d39\uff0c\u70b9\u51fb\u540e\u53ef\u80fd\u8df3\u8f6c\u5230\u767b\u5f55\u9875</div>';
    }

    h += '<div class="A"><button class="b bp" data-u="' + i + '">\u590d\u5236</button>';
    h += '<button class="b" data-o="' + i + '">\u6253\u5f00</button></div></div>';
  });

  h += '</div></div>';
  sh.innerHTML = h;

  // === 事件绑定 ===
  sh.getElementById('cls').onclick = function() { d.remove(); };

  sh.querySelectorAll('[data-u]').forEach(function(btn) {
    btn.onclick = function() {
      var url = L[+this.getAttribute('data-u')].u;
      navigator.clipboard.writeText(url).then(function() {
        btn.textContent = '\u5df2\u590d\u5236!';
        setTimeout(function() { btn.textContent = '\u590d\u5236'; }, 1500);
      }).catch(function() {
        prompt('\u590d\u5236:', url);
      });
    };
  });

  sh.querySelectorAll('[data-o]').forEach(function(btn) {
    btn.onclick = function() {
      window.open(L[+this.getAttribute('data-o')].u, '_blank');
    };
  });

  document.body.appendChild(d);

  // === 自动复制（仅有 1 条免费 meta 时） ===
  var metas = L.filter(function(l) { return l.s === 'meta' && !l.pay; });
  if (metas.length === 1) {
    navigator.clipboard.writeText(metas[0].u).catch(function() {});
  }
})();
