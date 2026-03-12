---
title: Markdown 内容渲染示例
date: 2026-03-12 21:20:00
tags:
  - Markdown
  - 数学公式
  - 化学符号
categories:
  - 前端笔记
excerpt: 这篇文章用来验证图片、动图、数学公式和化学式在博客里的显示是否正常。
---

这篇文章专门用来检查博客里的 Markdown 内容渲染。

## 图片

![静态图片示例](/img/markdown-demo-figure.svg "静态图片示例")

## 动图

![动图示例](/img/markdown-demo-motion.svg "动图示例")

## 数学公式

行内公式：$E = mc^2$

块级公式：

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

## 化学式

行内化学式：$\ce{H2O + CO2 -> H2CO3}$

块级化学反应式：

$$
\ce{2H2 + O2 -> 2H2O}
$$

## 表格与代码

| 类型 | 示例 |
| --- | --- |
| 图片 | `![alt](url)` |
| 行内公式 | `$a^2 + b^2 = c^2$` |
| 化学式 | `$\ce{NaCl}$` |

```js
const blogMode = 'author-like';
console.log(`Current mode: ${blogMode}`);
```
