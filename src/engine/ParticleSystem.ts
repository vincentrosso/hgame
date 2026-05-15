export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type?: 'explosion' | 'trail' | 'spark';
}

export class ParticleSystem {
  private particles: Particle[] = [];

  emit(x: number, y: number, color: string, count: number = 10, type: 'explosion' | 'spark' = 'explosion') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = type === 'explosion' ? Math.random() * 4 + 1 : Math.random() * 2 + 1;
      const life = type === 'explosion' ? 1.0 : 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color,
        size: Math.random() * 3 + (type === 'explosion' ? 2 : 1),
        type
      });
    }
  }

  emitTrail(x: number, y: number, color: string) {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: Math.random() * 1 + 1,
      life: 0.4,
      maxLife: 0.4,
      color,
      size: Math.random() * 2 + 1,
      type: 'trail'
    });
  }

  update(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += (p.vx * delta) / 16;
      p.y += (p.vy * delta) / 16;
      
      if (p.type === 'trail') {
        p.life -= delta / 400;
      } else {
        p.life -= delta / 1000;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      
      if (p.type !== 'trail') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
