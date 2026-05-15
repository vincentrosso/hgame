export class InputHandler {
  public keys: Set<string> = new Set();
  public touchX: number | null = null;
  public isTouching: boolean = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    
    // Touch support for mobile
    window.addEventListener('touchstart', (e) => {
      this.isTouching = true;
      this.touchX = e.touches[0].clientX;
    });
    window.addEventListener('touchmove', (e) => {
      this.touchX = e.touches[0].clientX;
    });
    window.addEventListener('touchend', () => {
      this.isTouching = false;
      this.touchX = null;
    });
  }

  isPressed(code: string): boolean {
    return this.keys.has(code);
  }

  getLeft(): boolean {
    return this.isPressed('ArrowLeft') || this.isPressed('KeyA');
  }

  getRight(): boolean {
    return this.isPressed('ArrowRight') || this.isPressed('KeyD');
  }

  getShoot(): boolean {
    return this.isPressed('Space');
  }
}
