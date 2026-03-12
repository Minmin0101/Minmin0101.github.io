// wave-bg.js - 波浪交互背景（适配移动端+PC）
class WaveBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isMobile = /Mobile|Android|iOS/.test(navigator.userAgent);
    this.touchPos = { x: 0, y: 0 }; // 触摸/鼠标位置
    this.waves = []; // 波浪数组
    this.resize();
    
    // 初始化波浪
    this.initWaves();
    
    // 事件监听
    this.bindEvents();
    
    // 开始动画
    this.animate();
  }

  // 适配窗口大小（核心：适配移动端）
  resize() {
    // 适配移动端视口
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // 重新初始化波浪
    this.initWaves();
  }

  // 初始化波浪参数
  initWaves() {
    this.waves = [
      {
        y: this.canvas.height * 0.6,
        amplitude: 30, // 波幅
        speed: 0.02,   // 速度
        offset: 0,     // 偏移
        color: 'rgba(80, 160, 255, 0.2)' // 浅蓝
      },
      {
        y: this.canvas.height * 0.65,
        amplitude: 40,
        speed: 0.015,
        offset: Math.PI / 2,
        color: 'rgba(120, 100, 255, 0.25)' // 浅紫
      },
      {
        y: this.canvas.height * 0.7,
        amplitude: 50,
        speed: 0.01,
        offset: Math.PI,
        color: 'rgba(180, 80, 255, 0.15)' // 浅粉紫
      }
    ];
  }

  // 绑定交互事件（兼容鼠标+触摸）
  bindEvents() {
    // PC端鼠标移动
    window.addEventListener('mousemove', (e) => {
      this.touchPos.x = e.clientX / this.canvas.width;
      this.touchPos.y = e.clientY / this.canvas.height;
    });

    // 移动端触摸
    window.addEventListener('touchmove', (e) => {
      e.preventDefault(); // 阻止滚动冲突
      const touch = e.touches[0];
      this.touchPos.x = touch.clientX / this.canvas.width;
      this.touchPos.y = touch.clientY / this.canvas.height;
    });

    // 窗口大小变化
    window.addEventListener('resize', () => this.resize());
  }

  // 绘制波浪
  drawWaves() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.waves.forEach((wave, index) => {
      // 根据交互位置调整波浪高度（核心交互逻辑）
      const interactiveAmplitude = wave.amplitude + (this.touchPos.y * 80 - 40);
      const interactiveOffset = wave.offset + (this.touchPos.x * Math.PI * 2 - Math.PI);
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, wave.y);
      
      // 绘制波浪曲线
      for (let x = 0; x <= this.canvas.width; x += 5) {
        const y = wave.y + 
          Math.sin((x / this.canvas.width) * Math.PI * 4 + wave.offset + Date.now() * wave.speed + interactiveOffset) 
          * interactiveAmplitude;
        this.ctx.lineTo(x, y);
      }
      
      // 闭合路径，填充渐变
      this.ctx.lineTo(this.canvas.width, this.canvas.height);
      this.ctx.lineTo(0, this.canvas.height);
      this.ctx.closePath();
      
      // 填充波浪颜色
      this.ctx.fillStyle = wave.color;
      this.ctx.fill();
    });
  }

  // 动画循环
  animate() {
    this.drawWaves();
    requestAnimationFrame(() => this.animate());
  }
}

// 页面加载完成后初始化
window.addEventListener('load', () => {
  const bgContainer = document.getElementById('fluid-bg');
  if (bgContainer) {
    // 创建canvas替换原有div
    const canvas = document.createElement('canvas');
    canvas.id = 'wave-canvas';
    canvas.className = 'fluid-background';
    bgContainer.parentNode.replaceChild(canvas, bgContainer);
    
    // 初始化波浪背景
    new WaveBackground(canvas);
  }
});