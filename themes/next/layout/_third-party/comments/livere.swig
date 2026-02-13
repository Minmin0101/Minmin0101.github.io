{% if theme.livere_uid %}
  <!-- 来必力新版评论组件（替换为你的 client-id） -->
  <livere-comment client-id="2XZ7bdnUiuhl0r4a4AhE"></livere-comment>
  <script type="module" src="https://www.livere.org/livere-widget.js"></script>
  <!-- 适配样式，避免评论区错位 -->
  <style>
    livere-comment {
      display: block;
      margin: 20px 0;
      width: 100%;
    }
  </style>
{% endif %}