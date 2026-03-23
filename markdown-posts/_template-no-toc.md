---
title: "在普通日子里收集温柔证据"
date: 2026-03-24 21:00:00
updated: 2026-03-24 21:00:00
slug: your-regular-post-slug
summary: "这里写博客首页卡片摘要。适合一句话概括这篇文章的主题、心情或重点。"
tags:
  - 生活碎片
  - 图文记录
  - 日常分享
cover: /img/posts/_template-assets/cover.jpg
cover_alt: "普通文章模板封面"
---

# 在普通日子里收集温柔证据

> 使用方法：复制本文件一份，把文件名改成 `YYYY-MM-DD-your-slug.md`，然后修改 front matter 和正文内容。

这是一份“普通无目录模板”。  
它更适合随笔、生活记录、短中篇总结、日常分享。文章页不会显示右侧目录，但正文里的图片、视频、公式、代码和表格能力仍然都在。

<!-- more -->

## 1. 今天为什么值得写下来

有些时候，写文章不是因为发生了多么惊天动地的事，而是因为那天的光线、气味、心情和一句话，突然都让人想留下来。

> 生活里真正柔软的部分，常常不是大事件，而是那些“不写就会散掉”的片刻。

## 2. 图片与静态画面

### 2.1 普通图片

![普通图片示例](/img/posts/_template-assets/figure-avatar.jpg)

### 2.2 SVG 插图

![SVG 图片示例](/img/posts/_template-assets/figure-vector.svg)

这一节适合放你当天拍的照片、插图、截图或作品图。

## 3. 动图、GIF 与视频

### 3.1 GIF 动图

![GIF 动图示例](/media/posts/_template-assets/loader.gif)

### 3.2 视频

<video controls preload="metadata" playsinline poster="/img/posts/_template-assets/cover.jpg">
  <source src="/media/posts/_template-assets/flower.mp4" type="video/mp4">
  当前浏览器不支持 HTML5 视频播放。
</video>

这里可以写一段关于画面、声音、情绪或环境的小描述。

## 4. 公式与结构化表达

有时文章里也会出现一点理性表达，例如统计、推导或课堂记录。

行内公式：$E = mc^2$、$F = ma$、$a^2 + b^2 = c^2$。  
块级公式：

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

$$
\sum_{n=1}^{10} n = 55
$$

## 5. 化学公式与结构式

行内化学式：$\ce{H2O}$、$\ce{CO2}$、$\ce{NaCl}$。  
反应式：

$$
\ce{2H2 + O2 -> 2H2O}
$$

$$
\ce{Ag+ + Cl- -> AgCl v}
$$

化学结构式图片：

![化学结构式示例](/img/posts/_template-assets/benzene-structure.svg)

## 6. 表格、定义列表与脚注

| 项目 | 示例 | 说明 |
| --- | --- | --- |
| 图片 | `![alt](url)` | 常规图文展示 |
| 视频 | `<video>` | 播放过程内容 |
| 公式 | `$...$` | 表达规律与推导 |
| 代码 | ````` | 记录命令和片段 |

Markdown
: 以后你新增文章时最常用的编辑格式。

摘要
: 会显示在博客首页卡片和搜索结果里的简短介绍。

如果正文里有补充说明，可以放脚注[^soft-note]。  
如果还有第二条旁注，也可以继续加[^soft-note-2]。

## 7. 代码、命令与片段

```js
const mood = "quiet";
const weather = "light rain";

console.log(`今天的心情是 ${mood}，天气是 ${weather}。`);
```

```python
from datetime import datetime

print("build at:", datetime.now().isoformat())
```

```html
<figure class="memory-card">
  <img src="/img/posts/_template-assets/figure-avatar.jpg" alt="记忆卡片">
  <figcaption>一张会被写进文章里的照片</figcaption>
</figure>
```

```bash
cd D:/blog/Minmin0101.github.io
./build-markdown-posts.bat
git add .
git commit -m "feat: publish new post"
```

## 8. HTML 扩展和收尾

<details>
  <summary>点击展开补充说明</summary>
  <p>这里可以放当天没来得及展开写的细节，也可以用来记录后续补记。</p>
</details>

正文里也可以直接用 <mark>高亮</mark>、<sup>上标</sup>、<sub>下标</sub>、<kbd>Ctrl</kbd> + <kbd>P</kbd>。

文章的最后，你可以留下一个很轻的结尾：今天发生了什么、你理解了什么、你想把什么继续带到明天。  
这就已经是一篇完整的博客文章了。

[^soft-note]: 这条脚注适合放一个不想放进正文里的补充句子。
[^soft-note-2]: 这条脚注适合测试多条脚注同时出现时的排版效果。
