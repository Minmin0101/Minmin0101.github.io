window.addEventListener('load', () => {
  const canvas = document.getElementById('fluid-bg');
  if (canvas) {
    // 这里的初始化代码需要从 Simon 的 fluid.js 中复制
    initFluid(canvas);
  }
});