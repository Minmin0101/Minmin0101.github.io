---
title: "Markdown 全功能长文实验室"
date: 2026-03-23 23:40:00
updated: 2026-03-23 23:59:00
slug: markdown-all-features-lab
summary: "这是一篇专门用来回归测试 Markdown 全部常用显示能力的长文，包含目录、图片、SVG、GIF、视频、数学公式、化学公式、化学结构式、表格、脚注、定义列表、HTML 扩展和多语言代码块。"
tags:
  - Markdown
  - 长文测试
  - 多媒体
  - 数学公式
  - 化学符号
cover: /img/posts/2026-03-23-markdown-all-features-lab/cover.jpg
cover_alt: "Markdown 全功能长文实验室封面"
template_path: 2026/03/12/post-interaction-long-test/index.html
---

# Markdown 全功能长文实验室

这篇文章专门用来做站内 Markdown 全量回归测试。  
目标不是写一篇普通博客，而是尽可能把当前这套博客文章页能展示的内容形式都集中到一页里，方便后续改样式、调插件、修移动端时做一次性回归。

<!-- more -->

## 1. 目录与层级标题

如果右侧目录能正确显示这一节以及后面的二级、三级标题，说明文章目录生成、滚动定位和锚点跳转这三件事是通的。

### 1.1 小标题示例

这里用一段普通正文来确认标题层级下的段落间距是否正常，桌面端、移动端、iOS 端都应该保持舒服的阅读节奏。

### 1.2 行内样式示例

你可以在同一段里混用 **粗体**、*斜体*、`行内代码`、[站内链接](/blog/)、以及一个脚注引用[^first-note]。

## 2. 引用、列表与分隔线

> 记录不是为了证明什么，而是为了在回头看的时候，知道自己曾经认真生活过。

- 无序列表第一项
- 无序列表第二项
- 无序列表第三项

1. 有序列表第一项
2. 有序列表第二项
3. 有序列表第三项

- 嵌套列表示例
  - 第二层信息
  - 第二层补充

---

## 3. 图片与 SVG

这一节同时测试普通 JPG 图片和 SVG 图片。

### 3.1 普通图片

![静态图片测试](/img/posts/2026-03-23-markdown-all-features-lab/figure-avatar.jpg)

### 3.2 矢量图片

![矢量图片测试](/img/posts/2026-03-23-markdown-all-features-lab/figure-vector.svg)

## 4. GIF、动图与视频

### 4.1 GIF 动图

![GIF 动图测试](/media/posts/2026-03-23-markdown-all-features-lab/loader.gif)

### 4.2 HTML5 视频

<video controls preload="metadata" playsinline poster="/img/posts/2026-03-23-markdown-all-features-lab/figure-avatar.jpg">
  <source src="/media/posts/2026-03-23-markdown-all-features-lab/flower.mp4" type="video/mp4">
  当前浏览器不支持 HTML5 视频播放。
</video>

## 5. 表格、脚注、定义列表

### 5.1 表格

| 类型 | 示例 | 说明 |
| --- | --- | --- |
| 图片 | `![alt](url)` | 测试图片渲染 |
| 视频 | `<video>` | 测试多媒体布局 |
| 数学公式 | `$E = mc^2$` | 测试公式渲染 |
| 化学公式 | `$\ce{H2O}$` | 测试 mhchem |

### 5.2 定义列表

Markdown
: 当前博客新增文章的主要编写格式。

Front matter
: Markdown 文件头部的元信息区域，用来控制标题、时间、标签、封面等配置。

### 5.3 脚注

脚注最适合放补充说明[^second-note]，不会打断正文节奏。

## 6. 数学公式

### 6.1 行内公式

行内公式示例：$E = mc^2$、$a^2 + b^2 = c^2$、$F = ma$。

### 6.2 块级公式

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

$$
\sum_{n=1}^{10} n = 55
$$

### 6.3 矩阵与极限

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

## 7. 化学公式与化学结构式

### 7.1 行内化学式

行内化学式可以这样写：$\ce{H2O}$、$\ce{CO2}$、$\ce{NaCl}$。

### 7.2 反应式

$$
\ce{2H2 + O2 -> 2H2O}
$$

$$
\ce{CaCO3 ->[\Delta] CaO + CO2}
$$

### 7.3 化学结构式

下面这张 SVG 用来测试“化学结构式图片”这种内容是否能稳定显示：

![苯环结构式测试](/img/posts/2026-03-23-markdown-all-features-lab/benzene-structure.svg)

## 8. 代码块与多语言高亮

### 8.1 JavaScript

```js
const sections = Array.from(document.querySelectorAll("#post-content h2, #post-content h3"));

function activeHeading(scrollTop) {
  return sections.findLast((section) => section.offsetTop - 120 <= scrollTop);
}

window.addEventListener("scroll", () => {
  const current = activeHeading(window.scrollY);
  console.log("current heading:", current ? current.textContent : "none");
});
```

### 8.2 Python

```python
from pathlib import Path

root = Path("D:/blog/Minmin0101.github.io")
markdown_dir = root / "markdown-posts"

for file in sorted(markdown_dir.glob("*.md")):
    print(file.name)
```

### 8.3 HTML

```html
<section class="feature-card">
  <h2>Markdown 测试页</h2>
  <p>这个区块用来确认 HTML 代码块高亮是否正常。</p>
</section>
```

### 8.4 CSS

```css
.feature-card {
  border-radius: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #f6fbff, #eef7ff);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}
```

### 8.5 JSON

```json
{
  "title": "Markdown 全功能长文实验室",
  "features": ["image", "gif", "video", "math", "chemistry", "svg", "code"],
  "keep_for_regression": true
}
```

### 8.6 Bash

```bash
cd D:/blog/Minmin0101.github.io
./build-markdown-posts.bat
./build-gallery.bat
git status
```

## 9. HTML 扩展结构

### 9.1 Details 折叠块

<details>
  <summary>点击展开额外说明</summary>
  <p>这里测试的是 Markdown 正文中混用原生 HTML 结构时，样式和排版是否仍然稳定。</p>
</details>

### 9.2 行内 HTML

你也可以在正文里混用 <mark>高亮文本</mark>、<sup>上标</sup>、<sub>下标</sub> 和 <kbd>Ctrl</kbd> + <kbd>S</kbd> 这类原生标签。

## 10. 长段落滚动测试

当一篇文章真的很长时，读者很少会严格按顺序逐段往下看。更多时候，大家会先扫一眼目录，再按需要跳到某个段落。所以目录、回顶、卡片摘要、封面图这些功能，本质上都不是装饰，它们直接影响一篇长文是不是“愿意继续读下去”。

为了让这个测试页也能承担回归价值，这里刻意保留一段较长的连续文字，用来观察小屏滚动、目录高亮、图片延迟加载、视频区域高度、公式块换行、代码块横向滚动等细节是否稳定。如果后面你继续改博客主题，这篇文章就可以当作一站式检查页。

## 11. 缩写定义

HTML
: HyperText Markup Language

CSS
: Cascading Style Sheets

SVG
: Scalable Vector Graphics

## 12. 结语

如果这篇文章能在博客页卡片、文章详情页、右侧目录、移动端长页滚动和多媒体渲染里都保持稳定，就说明当前这套 Markdown 发文结构已经比较成熟了。

[^first-note]: 这条脚注主要测试脚注跳转和脚注区渲染。
[^second-note]: 这条脚注主要测试多个脚注同时存在时的编号与排版。
