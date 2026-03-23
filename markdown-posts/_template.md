---
title: "Markdown 发文模板说明"
date: 2026-03-24 00:00:00
updated: 2026-03-24 00:00:00
slug: template-guide
draft: true
---

# Markdown 发文模板说明

以后新增文章，优先从下面两个模板里复制：

1. `D:\blog\Minmin0101.github.io\markdown-posts\_template-with-toc.md`
   适合长文、教程、评测、总结这类需要右侧目录的文章。
2. `D:\blog\Minmin0101.github.io\markdown-posts\_template-no-toc.md`
   适合普通随笔、生活记录、短中篇分享，不显示右侧目录。

这两个模板都已经包含：

- 封面图
- 普通图片
- SVG
- GIF
- 视频
- 数学公式
- 化学公式
- 化学结构式图片
- 表格
- 脚注
- 定义列表
- 引用
- 折叠块
- 多语言代码块

模板默认素材目录：

- `D:\blog\Minmin0101.github.io\img\posts\_template-assets`
- `D:\blog\Minmin0101.github.io\media\posts\_template-assets`

你真正发文时，最推荐的做法是：

1. 复制一个模板文件
2. 把文件名改成 `YYYY-MM-DD-your-slug.md`
3. 把 front matter 里的标题、时间、摘要、标签、封面路径改掉
4. 把正文里的示例内容删掉，换成你自己的文章
5. 把图片和视频放到你自己的文章目录里
6. 运行 `D:\blog\Minmin0101.github.io\build-markdown-posts.bat`

如果你懒得立刻整理素材目录，也可以先直接用模板里的默认素材路径，页面同样能正常显示。
