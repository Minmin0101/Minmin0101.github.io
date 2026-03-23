---
title: "把一段时光认真写下来"
date: 2026-03-24 20:00:00
updated: 2026-03-24 20:00:00
slug: your-long-post-slug
summary: "这里写博客首页卡片摘要。建议 50 到 120 字，尽量一句话说清这篇文章想写什么。"
tags:
  - 生活记录
  - 长文随笔
  - 图文笔记
cover: /img/posts/_template-assets/cover.jpg
cover_alt: "长文模板封面"
template_path: 2026/03/12/post-interaction-long-test/index.html
---

# 把一段时光认真写下来

> 使用方法：复制本文件一份，把文件名改成 `YYYY-MM-DD-your-slug.md`，再按需替换标题、时间、摘要、标签、封面和正文。

这是一份“带目录长文模板”。  
当你需要写教程、复盘、旅行长记、读书总结、年度总结这类内容时，直接从这份模板开始最省心，因为它已经带上了右侧目录、长文滚动结构和常用媒体示例。

<!-- more -->

## 1. 开场和文章背景

有些内容如果只是发在朋友圈，很快就会被新的信息淹没；可一旦认真写成文章，它就会留下更清楚的时间纹理。  
这一节通常适合交代写作背景、事情起因，或者告诉读者这篇文章准备解决什么问题。

### 1.1 一段引用

> 文字会替我们记住那些一度以为会永远记得、后来却慢慢变模糊的细节。

### 1.2 一个简单列表

- 先交代背景
- 再说明过程
- 最后总结收获

## 2. 图片与静态插图

如果你写的是旅行、生活记录、作品展示，这一节通常就会放静态图片。

### 2.1 普通封面图

![普通图片示例](/img/posts/_template-assets/figure-avatar.jpg)

### 2.2 SVG 插图

![SVG 图片示例](/img/posts/_template-assets/figure-vector.svg)

### 2.3 图注说明

你可以在图片下方继续补一段解释，告诉读者这张图是什么时候拍的、为什么放在这里、和正文有什么关系。

## 3. GIF、动图与视频

如果某段内容需要“展示动作”而不是“展示静态结果”，就很适合放 GIF 或视频。

### 3.1 GIF 动图

![GIF 动图示例](/media/posts/_template-assets/loader.gif)

### 3.2 视频嵌入

<video controls preload="metadata" playsinline poster="/img/posts/_template-assets/cover.jpg">
  <source src="/media/posts/_template-assets/flower.mp4" type="video/mp4">
  当前浏览器不支持 HTML5 视频播放。
</video>

### 3.3 视频补充说明

这一段可以用来写视频拍摄背景、画面里的关键信息，或者提醒读者在移动端也能直接播放。

## 4. 数学公式和理性表达

哪怕你平时不写纯技术文，偶尔也会需要用公式、统计表达或逻辑推导让文章更清楚。

### 4.1 行内公式

行内公式示例：$E = mc^2$、$F = ma$、$a^2 + b^2 = c^2$。

### 4.2 块级公式

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

$$
\sum_{n=1}^{10} n = 55
$$

### 4.3 矩阵和极限

$$
A =
\begin{bmatrix}
1 & 2 & 3 \\
0 & 1 & 4 \\
5 & 6 & 0
\end{bmatrix}
$$

$$
\lim_{x \to 0}\frac{\sin x}{x} = 1
$$

## 5. 化学公式与化学结构式

如果你以后要写学习笔记、实验记录、科普内容，这一节可以直接沿用。

### 5.1 行内化学式

行内化学式可以这样写：$\ce{H2O}$、$\ce{CO2}$、$\ce{NaCl}$。

### 5.2 反应式

$$
\ce{2H2 + O2 -> 2H2O}
$$

$$
\ce{CaCO3 ->[\Delta] CaO + CO2}
$$

### 5.3 化学结构式图片

![化学结构式示例](/img/posts/_template-assets/benzene-structure.svg)

## 6. 表格、脚注与定义列表

这一类内容很适合做整理、归纳和补充说明。

### 6.1 表格

| 类型 | 示例 | 用途 |
| --- | --- | --- |
| 图片 | `![alt](url)` | 展示静态内容 |
| 视频 | `<video>` | 展示过程和动作 |
| 数学公式 | `$E = mc^2$` | 表达规律和推导 |
| 化学公式 | `$\ce{H2O}$` | 表达物质和反应 |

### 6.2 定义列表

Markdown
: 你以后新增博客文章时最常用的编写格式。

Front matter
: Markdown 文件最上方的元信息区域，用来控制标题、时间、标签、封面和页面路径。

### 6.3 脚注

脚注适合放补充说明[^note-one]，不需要把所有解释都塞进正文里。  
第二条脚注也可以单独补充一个旁枝信息[^note-two]。

## 7. 代码块与命令片段

如果你写的是教程、记录排错过程，代码块通常会很常见。

### 7.1 JavaScript

```js
const cards = Array.from(document.querySelectorAll(".author-post-card"));

window.addEventListener("scroll", () => {
  const active = cards.find((card) => card.getBoundingClientRect().top >= 120);
  console.log("当前卡片:", active ? active.dataset.slug : "none");
});
```

### 7.2 Python

```python
from pathlib import Path

root = Path("D:/blog/Minmin0101.github.io")
markdown_dir = root / "markdown-posts"

for file in sorted(markdown_dir.glob("*.md")):
    print(file.name)
```

### 7.3 HTML

```html
<section class="article-note">
  <h2>这是一个提示区块</h2>
  <p>可以用来放总结、备注或注意事项。</p>
</section>
```

### 7.4 CSS

```css
.article-note {
  border-radius: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #f6fbff, #eef7ff);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}
```

### 7.5 JSON

```json
{
  "title": "把一段时光认真写下来",
  "features": ["image", "gif", "video", "math", "chemistry", "code"],
  "toc": true
}
```

### 7.6 Bash

```bash
cd D:/blog/Minmin0101.github.io
./build-markdown-posts.bat
git status
```

## 8. HTML 扩展、折叠块与结尾

原生 HTML 标签也能直接混进文章里，这一节适合放提示、附录和结尾。

### 8.1 折叠块

<details>
  <summary>点击展开额外补充</summary>
  <p>这里可以放版本记录、补充说明、引用来源或者不想打断正文节奏的小段信息。</p>
</details>

### 8.2 行内 HTML

你也可以在正文里混用 <mark>高亮文本</mark>、<sup>上标</sup>、<sub>下标</sub>、<kbd>Ctrl</kbd> + <kbd>S</kbd> 这类原生标签。

### 8.3 收尾段落

文章的最后一节，一般适合回到“这篇文章想留下什么”这个问题上。  
你可以总结一次经历、一段感受、一套方法，或者只是安静地把今天记下来。

[^note-one]: 这条脚注适合放补充解释、资料来源或旁注。
[^note-two]: 这条脚注适合放第二个补充点，测试多脚注显示是否正常。
