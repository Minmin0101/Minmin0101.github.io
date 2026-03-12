// fluid.js - 流体背景核心代码
class FluidSimulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.initVariables();
    this.animate();
    
    // 监听窗口大小变化
    window.addEventListener('resize', () => this.resize());
    // 监听鼠标交互
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initVariables() {
    this.particles = [];
    this.particleCount = Math.floor((this.canvas.width * this.canvas.height) / 1500);
    this.mouse = { x: this.canvas.width / 2, y: this.canvas.height / 2, radius: 150 };
    
    // 创建粒子
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 2 + 0.1,
        speedX: Math.random() * 0.5 - 0.25,
        speedY: Math.random() * 0.5 - 0.25,
        color: `rgba(${Math.floor(Math.random() * 50 + 200)}, ${Math.floor(Math.random() * 50 + 200)}, ${Math.floor(Math.random() * 50 + 255)}, 0.8)`
      });
    }
  }

  onMouseMove(e) {
    this.mouse.x = e.x;
    this.mouse.y = e.y;
  }

  drawParticles() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.particles.forEach(particle => {
      // 粒子跟随鼠标的流体效果
      let dx = this.mouse.x - particle.x;
      let dy = this.mouse.y - particle.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      let forceDirectionX = dx / distance;
      let forceDirectionY = dy / distance;
      let force = (this.mouse.radius - distance) / this.mouse.radius;
      let directionX = forceDirectionX * force * particle.speedX * 10;
      let directionY = forceDirectionY * force * particle.speedY * 10;

      if (distance < this.mouse.radius) {
        particle.x -= directionX;
        particle.y -= directionY;
      } else {
        particle.x += particle.speedX;
        particle.y += particle.speedY;
      }

      // 粒子边界回弹
      if (particle.x < 0 || particle.x > this.canvas.width) particle.speedX *= -1;
      if (particle.y < 0 || particle.y > this.canvas.height) particle.speedY *= -1;

      // 绘制粒子
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fillStyle = particle.color;
      this.ctx.fill();
      
      // 绘制粒子间连线（流体感）
      this.particles.forEach(particle2 => {
        let dx2 = particle.x - particle2.x;
        let dy2 = particle.y - particle2.y;
        let distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        if (distance2 < 80) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = `rgba(220, 220, 255, ${1 - distance2/80})`;
          this.ctx.lineWidth = 0.2;
          this.ctx.moveTo(particle.x, particle.y);
          this.ctx.lineTo(particle2.x, particle2.y);
          this.ctx.stroke();
        }
      });
    });
  }

  animate() {
    this.drawParticles();
    requestAnimationFrame(() => this.animate());
  }
}

// 页面加载完成后初始化
window.addEventListener('load', () => {
  const fluidBg = document.getElementById('fluid-bg');
  if (fluidBg) {
    // 替换div为canvas（核心！之前的div无法渲染WebGL/2D动画）
    const canvas = document.createElement('canvas');
    canvas.id = 'fluid-canvas';
    canvas.className = 'fluid-background';
    fluidBg.parentNode.replaceChild(canvas, fluidBg);
    
    // 初始化流体动画
    new FluidSimulation(canvas);
  }
});