import { InputHandler } from './InputHandler';
import { ParticleSystem } from './ParticleSystem';

export interface Projectile {
  x: number;
  y: number;
  speed: number;
}

export class Player {
  public x: number;
  public y: number;
  public width: number = 50;
  public height: number = 50;
  public speed: number = 0.5;
  public projectiles: Projectile[] = [];
  public jammed: boolean = false;
  private shootCooldown: number = 0;
  private jamCooldown: number = 0;
  private readonly SHOOT_DELAY: number = 250;
  private readonly FEVER_SHOOT_DELAY: number = 100;
  private readonly JAM_DURATION: number = 1500;
  private tilt: number = 0;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.x = canvasWidth / 2;
    this.y = canvasHeight - 80;
  }

  jam() {
    this.jammed = true;
    this.jamCooldown = this.JAM_DURATION;
  }

  update(delta: number, input: InputHandler, canvasWidth: number, particleSystem?: ParticleSystem, isFever: boolean = false) {
    let moveDir = 0;
    // Movement
    if (input.getLeft()) {
      this.x -= this.speed * delta;
      moveDir = -1;
    }
    if (input.getRight()) {
      this.x += this.speed * delta;
      moveDir = 1;
    }

    // Mobile touch movement
    if (input.touchX !== null) {
      const diff = input.touchX - this.x;
      if (Math.abs(diff) > 5) {
        moveDir = Math.sign(diff);
        this.x += moveDir * this.speed * delta;
      }
    }

    // Tilt interpolation
    this.tilt += (moveDir * 0.2 - this.tilt) * 0.1 * (delta / 16);

    // Bounds check
    this.x = Math.max(this.width / 2, Math.min(canvasWidth - this.width / 2, this.x));

    // Shooting
    if (this.shootCooldown > 0) {
      this.shootCooldown -= delta;
    }
    if (this.jamCooldown > 0) {
      this.jamCooldown -= delta;
      if (this.jamCooldown <= 0) {
        this.jammed = false;
      }
    }

    const currentShootDelay = isFever ? this.FEVER_SHOOT_DELAY : this.SHOOT_DELAY;

    if ((input.getShoot() || input.isTouching) && this.shootCooldown <= 0 && !this.jammed) {
      this.projectiles.push({
        x: this.x,
        y: this.y - 20,
        speed: 0.8
      });
      this.shootCooldown = currentShootDelay;
      return true; // Fired
    }

    // Engine trails
    if (particleSystem) {
      particleSystem.emitTrail(this.x - 10, this.y + 20, isFever ? '#f0f' : '#0ff');
      particleSystem.emitTrail(this.x + 10, this.y + 20, isFever ? '#f0f' : '#0ff');
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.y -= p.speed * delta;
      if (p.y < -20) {
        this.projectiles.splice(i, 1);
      }
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, isFever: boolean = false) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt);
    
    // Outer glow
    const mainColor = this.jammed ? '#f00' : (isFever ? '#f0f' : '#0ff');
    ctx.shadowBlur = isFever ? 25 : 15;
    ctx.shadowColor = mainColor;
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = isFever ? 4 : 3;
    ctx.lineCap = 'round';

    // The ㅎ shape
    // Top horizontal stroke
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.lineTo(15, -20);
    ctx.stroke();

    // Middle horizontal stroke
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.lineTo(20, -10);
    ctx.stroke();

    // The circle (ㅇ)
    ctx.beginPath();
    ctx.arc(0, 10, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Engine trails
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.jammed ? '#700' : '#f0f';
    ctx.fillStyle = this.jammed ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(-10, 25, 4, 0, Math.PI * 2);
    ctx.arc(10, 25, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Draw projectiles
    ctx.fillStyle = '#ff0';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0';
    for (const p of this.projectiles) {
      ctx.fillRect(p.x - 2, p.y - 10, 4, 15);
    }
  }

  resize(canvasWidth: number, canvasHeight: number) {
    this.y = canvasHeight - 80;
    this.x = Math.min(this.x, canvasWidth - this.width / 2);
  }
}
