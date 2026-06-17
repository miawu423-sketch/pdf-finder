// Publish Time Extractor v2 - Remote Script
// 7-layer extraction ported from Python PublishTimeExtractor
// meta → json-ld → script-vars → time-tag → data-attr → class-id → regex
// SPA delayed retry support

(function() {
  'use strict';

  if (document.getElementById('__pub_time')) {
    document.getElementById('__pub_time').remove();
    if (window.__pub_time_timer) clearInterval(window.__pub_time_timer);
    return;
  }

  var results = [];
  var retried = false;
  var MODIFIED_UNTRUSTED_DOMAINS = ['toutiao.com','toutiaocdn.com','toutiaoimg.com',
    'baijiahao.baidu.com','mbd.baidu.com','dy.163.com','yidianzixun.com',
    'k.sina.cn','k.sina.com.cn','ifeng.com'];

  function isModifiedUntrusted() {
    var h = location.hostname.replace(/^www\./,'');
    return MODIFIED_UNTRUSTED_DOMAINS.some(function(d){return h.indexOf(d)!==-1;});
  }
  var skipModified = isModifiedUntrusted();

  // ====== Utils ======
  function pad(n){return n<10?'0'+n:''+n;}
  function fmtBeijing(d){
    var offset=8*60, localOffset=d.getTimezoneOffset();
    var bt=new Date(d.getTime()+(offset+localOffset)*60000);
    var date=bt.getFullYear()+'/'+pad(bt.getMonth()+1)+'/'+pad(bt.getDate());
    var h=bt.getHours(),mi=bt.getMinutes(),s=bt.getSeconds();
    if(h===0&&mi===0&&s===0)return date;
    return date+' '+pad(h)+':'+pad(mi)+':'+pad(s);
  }
  function nowYear(){return new Date().getFullYear();}
  function looksLikeDate(str){return /(?:20|19)\d{2}[-\/年\.]\d{1,2}[-\/月\.]\d{1,2}/.test(str)||/\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}\s+\d{1,2}:\d{2}/.test(str);}

  function parseTime(str){
    if(!str||str.length>50)return null;
    str=str.trim();
    // ASP.NET /Date(ms+tz)/
    var am=/^\/Date\((\d{10,13})([+-]\d{4})?\)\/$/;
    var ama=am.exec(str);
    if(ama){var ts=+ama[1];if(ama[1].length===10)ts*=1000;var dt=new Date(ts);return isNaN(dt.getTime())?null:fmtBeijing(dt);}
    // RFC 2822: Sun, 09 Mar 2025 22:21:38 +0900
    var rm=/^[A-Z][a-z]{2},\s/;
    if(rm.test(str)){var d2=new Date(str);if(!isNaN(d2.getTime()))return fmtBeijing(d2);}
    // 2-digit year: 26-05-22 → 2026-05-22
    if(/^\d{2}-/.test(str))str='20'+str;
    // Dot-separated: 2026.06.14
    var dm=str.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if(dm){str=dm[1]+'-'+pad(+dm[2])+'-'+pad(+dm[3])+(str.replace(dm[0],'').match(/(\d{2}:\d{2}(?::\d{2})?)/)||[''])[0];}
    // DD-MM-YYYY (European): 15-06-2026
    var em=str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if(em&&+em[1]>12){str=em[3]+'-'+em[2]+'-'+em[1];}
    // Chinese spaces: "2026 年 6 月 14 日" → "2026年6月14日"
    str=str.replace(/(\d)\s+年\s*(\d)/,'$1年$2').replace(/(\d)\s+月\s*(\d)/,'$1月$2').replace(/(\d)\s+日/,'$1日');
    // Chinese brackets: "（最近更新时间：2026年6月）"
    var bm=str.match(/(\d{4}年\d{1,2}月(?:\d{1,2}日)?)/);
    if(bm&&/[（(]/.test(str))str=bm[1];
    // Xinhua: 202605/2313:03:30 → 2026-05-23 13:03:30
    var xm=str.match(/^(\d{4})(\d{2})\/(\d{2})(\d{2}:\d{2}:\d{2})$/);
    if(xm)str=xm[1]+'-'+xm[2]+'-'+xm[3]+' '+xm[4];
    // Timestamps (10 or 13 digits)
    if(/^\d{10}$/.test(str)){var d3=new Date(+str*1000);return isNaN(d3.getTime())?null:fmtBeijing(d3);}
    if(/^\d{13}$/.test(str)){var d4=new Date(+str);return isNaN(d4.getTime())?null:fmtBeijing(d4);}
    // No-year MM-DD HH:MM → add current year
    var ny=str.match(/^(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/);
    if(ny)str=nowYear()+'-'+ny[1]+'-'+ny[2]+' '+ny[3]+':00';
    // Z suffix → +00:00
    str=str.replace(/(\d{2}:\d{2}:\d{2})Z$/,'$1+00:00').replace(/(\d{2}:\d{2}:\d{2}\.\d+)Z$/,'$1+00:00');
    // Fix missing space: 2026-05-1213:00 → 2026-05-12 13:00
    str=str.replace(/(\d{4}-\d{2}-\d{2})(\d{2}:\d{2})/,'$1 $2').replace(/(\d{4}\/\d{2}\/\d{2})(\d{2}:\d{2})/,'$1 $2');

    var formats=[/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}/,
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/,/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/,/^\d{4}-\d{2}-\d{2}$/,/^\d{4}\/\d{2}\/\d{2}$/,
      /^\d{4}年\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}:\d{2}/,/^\d{4}年\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}/,/^\d{4}年\d{1,2}月\d{1,2}日/];
    var d=new Date(str);if(!isNaN(d.getTime()))return fmtBeijing(d);

    // Regex fallback
    var r=str.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日]?\s*(\d{1,2})?[：:]?(\d{1,2})?[：:]?(\d{1,2})?/);
    if(!r){r=str.match(/(\d{4})[-/年](\d{1,2})月?$/);if(r){try{var d5=new Date(+r[1],+r[2]-1,1);return isNaN(d5.getTime())?null:fmtBeijing(d5).replace(/ \d{2}:\d{2}:\d{2}/,' 00:00:00');}catch(e){}}}
    if(r){
      var y=+r[1],mo=+r[2],da=+r[3],h=+(r[4]||0),mi=+(r[5]||0),s=+(r[6]||0);
      if(mo===0||da===0)return null;
      try{var d6=new Date(y,mo-1,da,h,mi,s);return isNaN(d6.getTime())?null:fmtBeijing(d6);}catch(e){return null;}
    }
    return null;
  }

  function dedup(){
    var seen={},unique=[];
    results.forEach(function(r){var k=r.label+'|'+r.raw;if(!seen[k]){seen[k]=true;unique.push(r);}});
    results=unique;
  }

  function addResult(source,label,raw,parsed,isPrimary){
    if(!raw)return;raw=(''+raw).trim();if(!raw)return;
    var pr=parsed||parseTime(raw);
    results.push({source:source,label:label,raw:raw,parsed:pr,primary:!!isPrimary});
  }

  // ====== Layer 1: Meta (prefers modified, unless blacklisted) ======
  function extractMeta(){
    if(!skipModified){
      ['article:modified_time','og:updated_time','last-modified','lastmod','dateModified'].forEach(function(p){
        var m=document.querySelector('meta[property="'+p+'"],meta[name="'+p+'"],meta[itemprop="'+p+'"]');
        if(m&&m.getAttribute('content')){addResult('meta','modified:'+p,m.getAttribute('content'));return;}
      });
    }
    ['article:published_time','article:published','publishdate','date','pubdate','datePublished','publication_date',
     'og:published_time','dc.date.issued','citation_publication_date','citation_online_date',
     'article.published','sailthru.date','weibo:article:create_at'].forEach(function(p){
      var m=document.querySelector('meta[property="'+p+'"],meta[name="'+p+'"],meta[itemprop="'+p+'"]');
      if(m&&m.getAttribute('content')){addResult('meta','published:'+p,m.getAttribute('content'));return;}
    });
    // Generic meta scan
    document.querySelectorAll('meta[name][content]').forEach(function(el){
      var n=el.getAttribute('name'),c=el.getAttribute('content');
      if(n&&c&&/date|time|publish|pubdate|created|modified/i.test(n)&&looksLikeDate(c)){
        addResult('meta',n,c);
      }
    });
  }

  // ====== Layer 2: JSON-LD (prefers modified, unless blacklisted) ======
  function extractJsonLd(){
    var seenKeys={};
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){
      try{walkJsonLd(JSON.parse(s.textContent));}catch(e){}
    });
    function walkJsonLd(obj){
      if(!obj||typeof obj!=='object')return;
      if(Array.isArray(obj)){obj.forEach(walkJsonLd);return;}
      if(!skipModified){
        ['dateModified','lastModified','modifiedDate'].forEach(function(f){
          if(obj[f]){addResult('json-ld','modified:'+f,String(obj[f]));}
        });
      }
      ['datePublished','publishDate','dateCreated','uploadDate'].forEach(function(f){
        if(obj[f]){addResult('json-ld','published:'+f,String(obj[f]));}
      });
      if(obj['@graph'])walkJsonLd(obj['@graph']);
      if(obj.mainEntity)walkJsonLd(obj.mainEntity);
    }
  }

  // ====== Layer 3: Script variables ======
  function extractScriptVars(text){
    if(!text||text.length<10)return;
    // /Date(ms+tz)/
    var re=/\/Date\((\d{10,13})([+-]\d{4})?\)\//g,m;
    while((m=re.exec(text))!==null){
      var ms=+m[1];if(m[1].length===10)ms*=1000;
      var dt=new Date(ms);
      if(!isNaN(dt.getTime())&&dt.getFullYear()>=2000&&dt.getFullYear()<=2100){
        var ctx=text.substring(Math.max(0,m.index-300),m.index);
        var vm=ctx.match(/(\w+(?:Time|time|Date|date|Publish|publish|Create|create))\s*[=:]/);
        addResult('script',vm?vm[1]:'inline /Date/',m[0],fmtBeijing(dt));
      }
    }
    // JSON-string fields (prefer modified)
    if(!skipModified){
      ['"updateTime"','"modifiedTime"','"update_time"','"modified_at"','"lastModified"'].forEach(function(p){
        var rm2=text.match(new RegExp(p+'\\s*:\\s*"([^"]{10,30})"'));
        if(rm2){addResult('script','modified:'+p.slice(1,-1),rm2[1]);}
      });
    }
    ['"created_at"','"publishTime"','"createTime"','"postDate"','"publish_time"'].forEach(function(p){
      var rm2=text.match(new RegExp(p+'\\s*:\\s*"([^"]{10,30})"'));
      if(rm2){addResult('script','published:'+p.slice(1,-1),rm2[1]);}
    });
    // Timestamp fields
    var tr=/\b(created_at|publishTime|createTime|timestamp)\b\s*[=:]\s*["']?(\d{10,13})["']?/g,tm;
    while((tm=tr.exec(text))!==null){
      var v=+tm[2];if(tm[2].length===10)v*=1000;
      var d2=new Date(v);
      if(!isNaN(d2.getTime())&&d2.getFullYear()>=2000&&d2.getFullYear()<=2100){
        addResult('script','timestamp:'+tm[1],tm[2],fmtBeijing(d2));
      }
    }
  }

  // ====== Layer 4: Time tags ======
  function extractTimeTags(){
    document.querySelectorAll('time[datetime]').forEach(function(t){
      var dt=t.getAttribute('datetime');
      if(dt){addResult('time-tag','<time datetime>',dt);}
    });
  }

  // ====== Layer 5: Data attributes ======
  function extractDataAttrs(){
    ['data-time','data-publish-time','data-pubtime','data-date','data-created','data-timestamp','data-publish','data-createtime'].forEach(function(attr){
      document.querySelectorAll('['+attr+']').forEach(function(el){
        var v=el.getAttribute(attr);
        if(v&&(looksLikeDate(v)||/^\d{10,13}$/.test(v))){addResult('data-attr',attr,v);}
      });
    });
  }

  // ====== Layer 6: Class/ID patterns ======
  function extractClassId(){
    var cidPat=/publish.*time|post.*time|date|time|create.*time|update.*time/i;
    var headText=document.body?document.body.innerText.substring(0,500):'';
    document.querySelectorAll('[class],[id]').forEach(function(el){
      var cls=el.className||'',id=el.id||'';
      if(cidPat.test(cls)||cidPat.test(id)){
        var t=el.textContent?el.textContent.trim().substring(0,60):'';
        if(looksLikeDate(t)){addResult('class-id',el.tagName.toLowerCase()+(id?'#'+id:''),t);}
      }
    });
  }

  // ====== Layer 7: Regex body text ======
  function extractRegexBody(){
    var bodyText=document.body?document.body.innerText:'';if(!bodyText)return;
    var headText=bodyText.substring(0,500);
    var yr=nowYear();

    // Keyword-protected → full text
    var kw=[
      [/(?:更新时间|最后更新|修改时间|最后修改)[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?\s+\d{1,2}:\d{2}(?::\d{2})?)/g,'regex-modified-full'],
      [/(?:更新时间|最后更新|修改时间)[：:\s]*(\d{2}-\d{2}\s+\d{2}:\d{2})/g,'regex-modified-noYear'],
      [/(?:发布时间|时间)[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?\s+\d{1,2}:\d{2}(?::\d{2})?)/g,'regex-published-full'],
      [/(?:发布时间|更新时间)[：:\s]*(\d{2}-\d{2}\s+\d{2}:\d{2})/g,'regex-published-noYear'],
      [/(?:发布于|发表于|创建于)[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?\s*\d{1,2}[：:]\d{2})/g,'regex-prefix-full'],
      [/(?:发布于|发表于|创建于)[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/g,'regex-prefix'],
      [/更新于[：:\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/g,'regex-prefix'],
    ];
    kw.forEach(function(p){var m;while((m=p[0].exec(bodyText))!==null)addResult('regex',p[1],m[1]);});

    // Bare date → header only (first 500 chars)
    var bare=[
      [/(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}[：:]\d{2}(?:[：:]\d{2})?)/g,'regex-cn-datetime'],
      [/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/g,'regex-standard'],
      [/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/g,'regex-standard'],
      [/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/g,'regex-standard'],
      [/(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2})/g,'regex-standard'],
      [/(\d{4}年\d{1,2}月\d{1,2}日)/g,'regex-cn-date'],
    ];
    bare.forEach(function(p){var m;while((m=p[0].exec(headText))!==null)addResult('regex',p[1],m[1]);});
  }

  // ====== Execute all ======
  function extractAll(){
    extractMeta();
    extractJsonLd();
    document.querySelectorAll('script:not([src])').forEach(function(s){extractScriptVars(s.textContent);});
    try{var fh=document.documentElement.outerHTML||'';if(fh)extractScriptVars(fh);}catch(e){}
    extractTimeTags();
    extractDataAttrs();
    extractClassId();
    extractRegexBody();
    dedup();
  }
  extractAll();

  // ====== Sort: modified → published → others ======
  results.sort(function(a,b){
    var sa=a.label.indexOf('modified')!==-1?0:(a.label.indexOf('published')!==-1?1:2);
    var sb=b.label.indexOf('modified')!==-1?0:(b.label.indexOf('published')!==-1?1:2);
    return sa-sb;
  });

  // ====== Render ======
  var d=document.createElement('div');d.id='__pub_time';
  d.style.cssText='position:fixed;top:0;right:0;width:420px;max-height:80vh;z-index:2147483647;font:14px system-ui,-apple-system,sans-serif;color:#1d1d1f;';
  var sh=d.attachShadow({mode:'open'});

  var css=[
    '*{margin:0;padding:0;box-sizing:border-box}:host{all:initial}',
    '.P{background:#fff;border-radius:0 0 0 12px;box-shadow:0 4px 32px rgba(0,0,0,.18);display:flex;flex-direction:column;max-height:80vh;overflow:hidden}',
    '.H{background:#1d1d1f;color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between}',
    '.H h2{font:500 13px/1.4 system-ui}',
    '.X{background:rgba(255,255,255,.2);border:0;color:#fff;width:24px;height:24px;border-radius:50%;font:16px/1 sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center}',
    '.X:hover{background:rgba(255,255,255,.35)}',
    '.B{overflow-y:auto;padding:12px;flex:1}',
    '.I{padding:10px 12px;margin:6px 0;background:#f8f8fa;border:1px solid #e8e8ed;border-radius:8px}',
    '.I.best{background:#f0faf4;border-color:#34c759}',
    '.IH{display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap}',
    '.T{display:inline-block;padding:2px 7px;border-radius:4px;font:500 11px/1.6 system-ui;color:#fff}',
    '.Tm{background:#34c759}.Tj{background:#0071e3}.Ts{background:#ff9f0a}.Tt{background:#7f5340}.Td{background:#0c447c}.Tci{background:#854f0b}.Tr{background:#72243e}',
    '.badge{display:inline-block;padding:1px 6px;border-radius:4px;font:500 10px/1.6 system-ui;border:1px solid #34c759;color:#34c759}',
    '.badge-mod{border-color:#0071e3;color:#0071e3}',
    '.label{font:12px system-ui;color:#86868b}',
    '.time{font:500 15px/1.4 "SF Mono",Menlo,monospace;color:#1d1d1f;margin:4px 0}',
    '.raw{font:11px/1.4 "SF Mono",Menlo,monospace;color:#86868b;word-break:break-all}',
    '.A{display:flex;gap:6px;margin-top:8px}',
    '.b{font:12px system-ui;padding:4px 12px;border-radius:6px;border:1px solid #d2d2d7;background:#fff;cursor:pointer;color:#1d1d1f}',
    '.b:hover{background:#f0f0f0}.bp{background:#0071e3;color:#fff;border-color:#0071e3}.bp:hover{background:#0077ed}',
    '.E{text-align:center;padding:24px 16px;color:#86868b;font-size:13px;line-height:1.8}',
    '.E .trying{font-size:11px;color:#ff9f0a;margin-top:8px}',
    '.divider{font-size:11px;color:#999;padding:8px 0 4px;border-top:1px dashed #e8e8ed;margin-top:8px}'
  ].join('');

  var srcNames={meta:'Meta',"json-ld":'JSON-LD',script:'内联脚本','time-tag':'Time标签','data-attr':'Data属性','class-id':'Class/ID',regex:'正则匹配'};
  var srcColors={meta:'Tm',"json-ld":'Tj',script:'Ts','time-tag':'Tt','data-attr':'Td','class-id':'Tci',regex:'Tr'};

  function getBestIdx(){
    for(var i=0;i<results.length;i++)if(results[i].label.indexOf('modified')!==-1)return i;
    for(var i=0;i<results.length;i++)if(results[i].label.indexOf('published')!==-1)return i;
    return results.length>0?0:-1;
  }

  function renderPanel(){
    var bi=getBestIdx(),h='<style>'+css+'</style><div class="P"><div class="H"><h2>发布时间提取 \u2014 '+
      (results.length?'找到 '+results.length+' 个':'未找到')+
      '</h2><button class="X" id="cls">\u00d7</button></div><div class="B">';
    if(!results.length){
      h+='<div class="E">未找到发布时间<br><br>可能的原因：<br>\u2022 页面未在源码中标注时间<br>\u2022 时间由 JS 动态加载<br>\u2022 非文章类页面';
      if(!retried)h+='<div class="trying">正在尝试延迟扫描\u2026</div>';h+='</div>';
    }
    var ps='';
    results.forEach(function(r,i){
      if(r.source!==ps&&i>0)h+='<div class="divider">'+(srcNames[r.source]||r.source)+'</div>';ps=r.source;
      var cls='I'+(i===bi?' best':''),sc=srcColors[r.source]||'Tm';
      h+='<div class="'+cls+'"><div class="IH"><span class="T '+sc+'">'+r.source+'</span>';
      if(i===bi)h+='<span class="badge'+(r.label.indexOf('modified')!==-1?' badge-mod':'')+'">'+
        (r.label.indexOf('modified')!==-1?'最可能(修改)':'最可能(发布)')+'</span>';
      h+='<span class="label">'+r.label+'</span></div>';
      if(r.parsed)h+='<div class="time">'+r.parsed+'</div>';
      h+='<div class="raw">原始值: '+r.raw.replace(/</g,'&lt;')+'</div>';
      h+='<div class="A"><button class="b bp" data-c="'+i+'">复制时间</button>';
      h+='<button class="b" data-r="'+i+'">复制原始值</button></div></div>';
    });
    h+='</div></div>';return h;
  }

  function bindEvents(){
    sh.getElementById('cls').onclick=function(){d.remove();if(window.__pub_time_timer)clearInterval(window.__pub_time_timer);};
    sh.querySelectorAll('[data-c]').forEach(function(btn){
      btn.onclick=function(){var t=(results[+this.getAttribute('data-c')].parsed||results[+this.getAttribute('data-c')].raw);
        navigator.clipboard.writeText(t).then(function(){btn.textContent='已复制!';setTimeout(function(){btn.textContent='复制时间';},1500);})
        .catch(function(){prompt('复制:',t);});};
    });
    sh.querySelectorAll('[data-r]').forEach(function(btn){
      btn.onclick=function(){var r=results[+this.getAttribute('data-r')].raw;
        navigator.clipboard.writeText(r).then(function(){btn.textContent='已复制!';setTimeout(function(){btn.textContent='复制原始值';},1500);})
        .catch(function(){prompt('复制:',r);});};
    });
  }

  function updatePanel(){sh.innerHTML=renderPanel();bindEvents();}
  updatePanel();document.body.appendChild(d);

  var bi=getBestIdx();
  if(bi>=0&&results[bi]&&results[bi].parsed){
    navigator.clipboard.writeText(results[bi].parsed).catch(function(){});
  }

  // SPA delayed retry: 1.5s intervals, max 3 times
  if(results.length===0){
    var rc=0;
    window.__pub_time_timer=setInterval(function(){
      rc++;extractAll();extractRegexBody();dedup();
      if(results.length>0||rc>=3){clearInterval(window.__pub_time_timer);retried=true;updatePanel();
        var bi2=getBestIdx();if(bi2>=0&&results[bi2]&&results[bi2].parsed)navigator.clipboard.writeText(results[bi2].parsed).catch(function(){});}
    },1500);
  }
})();
