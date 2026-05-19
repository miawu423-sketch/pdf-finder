# Paper PDF Finder

在任何论文页面一键提取本文 PDF 下载链接。

## 安装

访问 https://miawu423-sketch.github.io/pdf-finder/ 按照页面指引安装书签。

## 工作原理

用户书签里只存储一行加载器代码：

```javascript
javascript:void((function(){var s=document.createElement('script');s.src='https://miawu423-sketch.github.io/pdf-finder/pdf-finder.js?v='+Date.now();document.body.appendChild(s)})())
```

每次点击时从 GitHub Pages 拉取最新的 `pdf-finder.js`，保证所有用户始终使用最新版本。

## 文件结构

```
pdf-finder-gh/
├── index.html        # 安装引导页面
├── pdf-finder.js     # 核心提取逻辑（远程加载）
└── README.md         # 本文件
```

## 部署步骤

1. 在 GitHub 创建仓库 `pdf-finder`
2. 将本目录内容推送到 `main` 分支
3. Settings → Pages → Source 选 `main` 分支根目录
4. 等待部署完成，获取 `https://YOUR_USERNAME.github.io/pdf-finder/` URL
5. 修改 `index.html` 中的 `SCRIPT_URL` 为实际 URL

## 迭代更新

只需修改 `pdf-finder.js` 并推送即可，所有用户下次点击书签自动使用新版本。

## 支持的出版商

| 出版商 | 提取方式 | 备注 |
|--------|----------|------|
| Springer / Nature | meta + link | OA 可用 |
| Elsevier / ScienceDirect | meta + PII 过滤 | 自动排除推荐文章 |
| Wiley | meta + link | epdf 在线阅读器 |
| ACM | meta + link | 已全面 OA |
| IEEE | 需先登录 | 登录后再运行 |
| MDPI / Frontiers | meta + link | 全 OA |
| arXiv | meta + link | 全免费 |
