export const EnemyState = {
  ENTERING: 0,
  FORMATION: 1,
  DIVING: 2,
  RETURNING: 3,
} as const;
export type EnemyState = typeof EnemyState[keyof typeof EnemyState];

export class Enemy {
  public x: number;
  public y: number;
  public width: number = 40;
  public height: number = 40;
  public character: string;
  public color: string;
  public isTarget: boolean = false;
  public alive: boolean = true;
  public state: EnemyState = EnemyState.ENTERING;
  public row: number;
  public col: number;
  
  private angle: number = 0;
  public startX: number;
  public startY: number;
  private diveProgress: number = 0;
  private diveSpeed: number = 0.002;
  private diveAnchorX: number = 0;

  constructor(x: number, y: number, character: string, color: string, row: number, col: number) {
    this.startX = x;
    this.startY = y;
    this.row = row;
    this.col = col;
    // Start off-screen for entrance
    this.x = x;
    this.y = -100 - Math.random() * 500;
    this.character = character;
    this.color = color;
    this.angle = Math.random() * Math.PI * 2;
  }

  dive(_playerX: number) {
    if (this.state === EnemyState.FORMATION) {
      this.state = EnemyState.DIVING;
      this.diveProgress = 0;
      this.diveAnchorX = this.x;
    }
  }

  update(delta: number, globalTime: number, formationX: number, formationY: number, spacingScale: number = 1, rowShift: number = 0) {
    if (!this.alive) return;

    switch (this.state) {
      case EnemyState.ENTERING:
        const targetY = (this.startY * spacingScale) + formationY;
        const targetX = (this.startX * spacingScale) + formationX + (this.row % 2 === 0 ? rowShift : -rowShift);
        this.y += (targetY - this.y) * 0.05;
        this.x += (targetX - this.x) * 0.05;
        if (Math.abs(this.y - targetY) < 1 && Math.abs(this.x - targetX) < 1) {
          this.state = EnemyState.FORMATION;
        }
        break;

      case EnemyState.FORMATION:
        // Swirling motion: each enemy has a unique phase based on its grid position
        const phaseOffset = (this.row * 0.8) + (this.col * 0.5);
        this.angle = (globalTime * 0.002) + phaseOffset;
        
        // Larger "swirl" radius (25x15 instead of 10x5)
        const swirlX = Math.sin(this.angle) * 25;
        const swirlY = Math.cos(this.angle) * 15;
        
        // Apply spacing scale and row shift
        const baseRowShift = this.row % 2 === 0 ? rowShift : -rowShift;
        this.x = (this.startX * spacingScale) + formationX + baseRowShift + swirlX;
        this.y = (this.startY * spacingScale) + formationY + swirlY;
        break;

      case EnemyState.DIVING:
        this.diveProgress += delta * this.diveSpeed;
        this.y += delta * 0.3;
        this.x = this.diveAnchorX + Math.sin(this.diveProgress * 10) * 100;
        
        if (this.y > 1000) { // Off bottom
          this.y = -100;
          this.state = EnemyState.RETURNING;
        }
        break;

      case EnemyState.RETURNING:
        const retTargetY = (this.startY * spacingScale) + formationY;
        const retTargetX = (this.startX * spacingScale) + formationX + (this.row % 2 === 0 ? rowShift : -rowShift);
        this.y += (retTargetY - this.y) * 0.05;
        this.x += (retTargetX - this.x) * 0.05;
        if (Math.abs(this.y - retTargetY) < 1) {
          this.state = EnemyState.FORMATION;
        }
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.state === EnemyState.DIVING) {
      ctx.rotate(Math.PI); // Flip when diving
    }

    // Ship body
    ctx.shadowBlur = this.state === EnemyState.DIVING ? 20 : 10;
    ctx.shadowColor = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.state === EnemyState.DIVING ? 3 : 2;
    
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(20, -10);
    ctx.lineTo(20, 10);
    ctx.lineTo(0, 20);
    ctx.lineTo(-20, 10);
    ctx.lineTo(-20, -10);
    ctx.closePath();
    ctx.stroke();

    // Hangeul Character
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.font = 'bold 24px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (this.state === EnemyState.DIVING) {
      ctx.scale(1, -1); // Keep character upright when ship is flipped
    }
    ctx.fillText(this.character, 0, 0);

    ctx.restore();
  }

  checkCollision(px: number, py: number): boolean {
    const dx = this.x - px;
    const dy = this.y - py;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 30; // Slightly larger for better feel
  }
}
