---
title: "Markdown 内容渲染示例"
date: 2026-03-12 21:20:00
updated: 2026-03-13 15:49:20
slug: markdown-rich-demo
path: 2026/03/12/markdown-rich-demo
summary: "这篇文章集中测试 Markdown 在博客里的图片、动图、数学公式、化学公式、表格和代码块渲染效果。"
tags:
  - Markdown
  - 数学公式
  - 化学符号
cover: /media/posts/2026-03-12-markdown-rich-demo/cover.gif
cover_alt: "Markdown demo cover"
body_format: html
template_path: 2026/03/12/markdown-rich-demo/index.html
---

<p>这篇文章专门用来检查博客里的 Markdown 内容渲染。</p><h2 id="图片"><a href="#图片" class="headerlink" title="图片"></a>图片</h2><figure class="image-bubble"><div class="img-lightbox"><div class="overlay"></div><img src="/img/img-loading.png" data-original="/img/markdown-demo-figure.svg" alt="静态图片示例" title="静态图片示例" loading="lazy"></div><div class="image-caption">静态图片示例</div></figure><h2 id="动图"><a href="#动图" class="headerlink" title="动图"></a>动图</h2><figure class="image-bubble"><div class="img-lightbox"><div class="overlay"></div><img src="/img/img-loading.png" data-original="/img/markdown-demo-motion.svg" alt="动图示例" title="动图示例" loading="lazy"></div><div class="image-caption">动图示例</div></figure><h2 id="数学公式"><a href="#数学公式" class="headerlink" title="数学公式"></a>数学公式</h2><p>行内公式：$E &#x3D; mc^2$</p><p>块级公式：</p><p>$$<br>\int_0^1 x^2 , dx &#x3D; \frac{1}{3}<br>$$</p><h2 id="化学式"><a href="#化学式" class="headerlink" title="化学式"></a>化学式</h2><p>行内化学式：$\ce{H2O + CO2 -&gt; H2CO3}$</p><p>块级化学反应式：</p><p>$$<br>\ce{2H2 + O2 -&gt; 2H2O}<br>$$</p><h2 id="表格与代码"><a href="#表格与代码" class="headerlink" title="表格与代码"></a>表格与代码</h2><table><thead><tr><th>类型</th><th>示例</th></tr></thead><tbody><tr><td>图片</td><td><code>![alt](url)</code></td></tr><tr><td>行内公式</td><td><code>$a^2 + b^2 = c^2$</code></td></tr><tr><td>化学式</td><td><code>$\ce&#123;NaCl&#125;$</code></td></tr></tbody></table><figure class="highlight js"><table><tr><td class="gutter"><pre><span class="line">1</span><br><span class="line">2</span><br></pre></td><td class="code"><pre><span class="line"><span class="keyword">const</span> blogMode = <span class="string">&#x27;author-like&#x27;</span>;</span><br><span class="line"><span class="variable language_">console</span>.<span class="title function_">log</span>(<span class="string">`Current mode: <span class="subst">$&#123;blogMode&#125;</span>`</span>);</span><br></pre></td></tr></table></figure>
