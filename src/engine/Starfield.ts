export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
}

export class Starfield {
  private stars: Star[] = [];
  private width: number = 0;
  private height: number = 0;

  constructor(width: number, height: number, count: number = 200) {
    this.width = width;
    this.height = height;
    this.init(count);
  }

  private init(count: number) {
    const colors = ['#ffffff', '#7dd3fc', '#f0abfc', '#a5f3fc'];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  update(delta: number) {
    for (const star of this.stars) {
      star.y += (star.speed * delta) / 16;
      if (star.y > this.height) {
        star.y = 0;
        star.x = Math.random() * this.width;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const star of this.stars) {
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}
