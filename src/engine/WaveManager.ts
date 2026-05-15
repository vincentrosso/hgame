import { Enemy, EnemyState } from './Enemy';
import { CONSONANTS, VOWELS } from './koreanChars';

export interface Projectile {
  x: number;
  y: number;
  speed: number;
}

export interface CollisionResult {
  hitTarget: boolean;
  hitDistractor: boolean;
  enemiesDestroyed: number;
  hitEnemies: Enemy[];
}

export class WaveManager {
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  public targetCharacter: string = '';
  public currentWave: number = 1;
  private formationX: number = 0;
  private formationY: number = 0;
  private formationDirection: number = 1;
  private shootTimer: number = 0;

  constructor(canvasWidth: number) {
    this.spawnWave(canvasWidth);
  }

  spawnWave(canvasWidth: number) {
    this.enemies = [];
    this.projectiles = [];
    const available = this.currentWave <= 3 ? VOWELS : [...CONSONANTS, ...VOWELS];
    this.targetCharacter = available[Math.floor(Math.random() * available.length)];

    // Smaller formation: 4 columns, 3 rows (12 total instead of 24)
    const cols = 4;
    const rows = 3;
    const spacingX = 100; // Increased spacing for better visibility
    const spacingY = 80;
    const startX = (canvasWidth - (cols - 1) * spacingX) / 2;
    const startY = 120;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Higher target probability (40% instead of 20%)
        const isTarget = Math.random() < 0.4;
        const char = isTarget ? this.targetCharacter : available[Math.floor(Math.random() * available.length)];
        const color = char === this.targetCharacter ? '#fbbf24' : '#ec4899';
        
        const enemy = new Enemy(startX + c * spacingX, startY + r * spacingY, char, color, r, c);
        enemy.isTarget = char === this.targetCharacter;
        this.enemies.push(enemy);
      }
    }
    
    if (!this.enemies.some(e => e.isTarget)) {
      const idx = Math.floor(Math.random() * this.enemies.length);
      this.enemies[idx].character = this.targetCharacter;
      this.enemies[idx].isTarget = true;
      this.enemies[idx].color = '#fbbf24';
    }
  }

  private diveTimer: number = 0;
  private shuffleTimer: number = 0;

  update(delta: number, globalTime: number, _canvasWidth: number, canvasHeight: number, playerX: number) {
    // Formation movement
    this.formationX += this.formationDirection * delta * 0.05;
    if (Math.abs(this.formationX) > 50) {
      this.formationDirection *= -1;
      this.formationY += 10;
    }

    if (this.formationY > 300) {
      this.formationY = 0;
    }

    // Advanced Formation Dynamics
    const spacingScale = 1 + Math.sin(globalTime * 0.001) * 0.05; // Pulse 5%
    const rowShift = Math.sin(globalTime * 0.0015) * 40; // Slide 40px

    // Update enemies
    for (const enemy of this.enemies) {
      if (enemy.alive) {
        enemy.update(delta, globalTime, this.formationX, this.formationY, spacingScale, rowShift);
      }
    }

    // Enemy diving - Prioritize back-row targets
    this.diveTimer += delta;
    if (this.diveTimer > Math.max(1000, 5000 - this.currentWave * 500)) {
      const formationEnemies = this.enemies.filter(e => e.alive && e.state === EnemyState.FORMATION);
      const buriedTargets = formationEnemies.filter(e => e.isTarget && e.row > 0);
      
      let diver: Enemy | null = null;
      if (buriedTargets.length > 0 && Math.random() < 0.6) {
        diver = buriedTargets[Math.floor(Math.random() * buriedTargets.length)];
      } else if (formationEnemies.length > 0) {
        diver = formationEnemies[Math.floor(Math.random() * formationEnemies.length)];
      }

      if (diver) {
        diver.dive(playerX);
      }
      this.diveTimer = 0;
    }

    // Target Promotion (Shuffle)
    this.shuffleTimer += delta;
    if (this.shuffleTimer > 3000) { // 3 seconds instead of 5
      const buriedTargets = this.enemies.filter(e => e.alive && e.isTarget && e.row > 0 && e.state === EnemyState.FORMATION);
      const frontDistractors = this.enemies.filter(e => e.alive && !e.isTarget && e.row === 0 && e.state === EnemyState.FORMATION);

      if (buriedTargets.length > 0 && frontDistractors.length > 0) {
        const target = buriedTargets[Math.floor(Math.random() * buriedTargets.length)];
        const front = frontDistractors[Math.floor(Math.random() * frontDistractors.length)];

        // Swap formation slots
        const tempX = target.startX;
        const tempY = target.startY;
        const tempRow = target.row;
        const tempCol = target.col;

        target.startX = front.startX;
        target.startY = front.startY;
        target.row = front.row;
        target.col = front.col;

        front.startX = tempX;
        front.startY = tempY;
        front.row = tempRow;
        front.col = tempCol;

        // Set to RETURNING so they fly to their new positions
        target.state = EnemyState.RETURNING;
        front.state = EnemyState.RETURNING;
      }
      this.shuffleTimer = 0;
    }

    // Enemy shooting
    this.shootTimer += delta;
    if (this.shootTimer > 2000 / (1 + this.currentWave * 0.1)) {
      const aliveEnemies = this.enemies.filter(e => e.alive);
      if (aliveEnemies.length > 0) {
        const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        this.projectiles.push({
          x: shooter.x,
          y: shooter.y + 20,
          speed: 0.3 + this.currentWave * 0.05
        });
      }
      this.shootTimer = 0;
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.y += (p.speed * delta);
      if (p.y > canvasHeight) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }

    // Draw enemy projectiles
    ctx.fillStyle = '#f0f';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f0f';
    for (const p of this.projectiles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  checkBulletCollisions(projectiles: any[]): CollisionResult {
    const result: CollisionResult = { hitTarget: false, hitDistractor: false, enemiesDestroyed: 0, hitEnemies: [] };
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      for (const enemy of this.enemies) {
        if (enemy.alive && enemy.checkCollision(p.x, p.y)) {
          enemy.alive = false;
          projectiles.splice(i, 1);
          result.enemiesDestroyed++;
          result.hitEnemies.push(enemy);
          if (enemy.isTarget) {
            result.hitTarget = true;
          } else {
            result.hitDistractor = true;
          }
          break;
        }
      }
    }
    return result;
  }

  checkPlayerCollision(playerX: number, playerY: number): boolean {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const dx = p.x - playerX;
      const dy = p.y - playerY;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        this.projectiles.splice(i, 1);
        return true;
      }
    }
    return false;
  }
}
