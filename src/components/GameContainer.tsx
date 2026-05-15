import React, { useRef, useEffect, useState } from 'react';
import { useGameLoop } from '../hooks/useGameLoop';
import { Starfield } from '../engine/Starfield';
import { InputHandler } from '../engine/InputHandler';
import { Player } from '../engine/Player';
import { WaveManager } from '../engine/WaveManager';
import { PhonemePlayer } from '../engine/PhonemePlayer';
import { ParticleSystem } from '../engine/ParticleSystem';
import { SoundEngine } from '../engine/SoundEngine';

const GameState = {
  START: 0,
  BRIEFING: 1,
  PLAYING: 2,
  PAUSED: 3,
  WAVE_CLEAR: 4,
  GAME_OVER: 5,
} as const;
type GameState = typeof GameState[keyof typeof GameState];

interface FloatingText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

const GameContainer: React.FC<{ onDrill: () => void }> = ({ onDrill }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(3);
  const [state, setState] = useState<GameState>(GameState.START);
  const [briefingTimer, setBriefingTimer] = useState(3);
  const [combo, setCombo] = useState(0);
  const [isFever, setIsFever] = useState(false);
  
  const prevStateRef = useRef<GameState>(GameState.START);
  const starfieldRef = useRef<Starfield | null>(null);
  const playerRef = useRef<Player | null>(null);
  const inputRef = useRef<InputHandler | null>(null);
  const waveManagerRef = useRef<WaveManager | null>(null);
  const phonemePlayerRef = useRef<PhonemePlayer | null>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const globalTimeRef = useRef<number>(0);
  const shakeRef = useRef(0);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  useEffect(() => {
    inputRef.current = new InputHandler();
    starfieldRef.current = new Starfield(window.innerWidth, window.innerHeight);
    playerRef.current = new Player(window.innerWidth, window.innerHeight);
    waveManagerRef.current = new WaveManager(window.innerWidth);
    phonemePlayerRef.current = new PhonemePlayer();
    particleSystemRef.current = new ParticleSystem();

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setDimensions({ width: w, height: h });
      starfieldRef.current?.resize(w, h);
      playerRef.current?.resize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Start or Restart with Space/Enter
      if ((state === GameState.START || state === GameState.GAME_OVER) && 
          (e.code === 'Space' || e.code === 'Enter' || e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        if (state === GameState.START) handleStart();
        else handleRestart();
      }
      
      // P → pause toggle
      if (e.code === 'KeyP' && (state === GameState.PLAYING || state === GameState.PAUSED || state === GameState.BRIEFING)) {
        e.preventDefault();
        handleTogglePause();
      }

      // Q or Esc → go to landing from any active state
      if ((e.key === 'q' || e.key === 'Q' || e.key === 'Escape') && state !== GameState.START) {
        e.preventDefault();
        handleGoToStart();
      }

      if (e.code === 'KeyL' && state === GameState.PLAYING) {
        handleListenAgain();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state]);

  useEffect(() => {
    if (state === GameState.BRIEFING) {
      phonemePlayerRef.current?.play(waveManagerRef.current?.targetCharacter || '');
      const timer = setInterval(() => {
        setBriefingTimer(t => {
          if (t <= 1) {
            clearInterval(timer);
            setState(GameState.PLAYING);
            return 3;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [state]);

  useGameLoop((delta) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (state !== GameState.PAUSED) {
      globalTimeRef.current += delta;
      if (shakeRef.current > 0) {
        shakeRef.current -= delta * 0.05;
      }

      // Update
      if (starfieldRef.current) starfieldRef.current.update(delta);
      if (particleSystemRef.current) particleSystemRef.current.update(delta);

      // Update floating texts
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y -= delta * 0.05;
        ft.life -= delta / 1000;
        if (ft.life <= 0) floatingTextsRef.current.splice(i, 1);
      }

    if (state === GameState.PLAYING) {
      if (inputRef.current && playerRef.current) {
        const fired = playerRef.current.update(delta, inputRef.current, canvas.width, particleSystemRef.current || undefined, isFever);
        if (fired) SoundEngine.getInstance().playPew();
        
        // Check player collision with enemy fire
        if (waveManagerRef.current && waveManagerRef.current.checkPlayerCollision(playerRef.current.x, playerRef.current.y)) {
          setLives(l => {
            if (l <= 1) {
              setState(GameState.GAME_OVER);
              return 0;
            }
            return l - 1;
          });
          setCombo(0);
          setIsFever(false);
          shakeRef.current = 15;
          SoundEngine.getInstance().playBoom();
          particleSystemRef.current?.emit(playerRef.current.x, playerRef.current.y, '#f00', 30);
        }
      }

      if (waveManagerRef.current && playerRef.current) {
        waveManagerRef.current.update(delta, globalTimeRef.current, canvas.width, canvas.height, playerRef.current.x);
        const result = waveManagerRef.current.checkBulletCollisions(playerRef.current.projectiles);
        
        if (result.enemiesDestroyed > 0) {
          result.hitEnemies.forEach(e => {
            particleSystemRef.current?.emit(e.x, e.y, e.color, 15);
            SoundEngine.getInstance().playBoom();
            shakeRef.current = 5;
          });

          if (result.hitTarget) {
            const points = result.enemiesDestroyed * 100 * (combo + 1);
            setScore(s => s + points);
            setCombo(c => {
              const newCombo = c + result.enemiesDestroyed;
              if (newCombo >= 5) setIsFever(true);
              return newCombo;
            });
            
            floatingTextsRef.current.push({
              x: result.hitEnemies[0].x,
              y: result.hitEnemies[0].y,
              text: `+${points}`,
              life: 1.0,
              color: '#fbbf24'
            });

            phonemePlayerRef.current?.play(waveManagerRef.current.targetCharacter);
            SoundEngine.getInstance().playSuccess();
          }
          if (result.hitDistractor) {
            playerRef.current.jam();
            setScore(s => Math.max(0, s - 50));
            setCombo(0);
            setIsFever(false);
            SoundEngine.getInstance().playJam();
            
            floatingTextsRef.current.push({
              x: result.hitEnemies[0].x,
              y: result.hitEnemies[0].y,
              text: 'JAMMED!',
              life: 1.0,
              color: '#f00'
            });
          }
        }
        
        // Check if wave clear
        if (waveManagerRef.current.enemies.filter(e => e.alive && e.isTarget).length === 0) {
          setState(GameState.WAVE_CLEAR);
          setScore(s => s + 500);
          setCombo(0);
          setIsFever(false);
          setTimeout(() => {
            setWave(w => w + 1);
            if (waveManagerRef.current) {
              waveManagerRef.current.currentWave++;
              waveManagerRef.current.spawnWave(canvas.width);
            }
            setState(GameState.BRIEFING);
          }, 2000);
        }
      }
    }
  }

    // Draw
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shakeRef.current > 0 && state !== GameState.PAUSED) {
      ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
    }

    starfieldRef.current?.draw(ctx);
    particleSystemRef.current?.draw(ctx);

    if (state === GameState.PLAYING || state === GameState.WAVE_CLEAR || state === GameState.PAUSED) {
      waveManagerRef.current?.draw(ctx);
      playerRef.current?.draw(ctx, isFever);
    }

    // Floating Texts
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Courier New"';
    for (const ft of floatingTextsRef.current) {
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.life;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1.0;
    ctx.restore();

    // UI Overlay
    if (state !== GameState.START && state !== GameState.GAME_OVER) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0ff';
      ctx.font = 'bold 20px "Courier New"';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE: ${score}`, 20, 40);
      ctx.fillText(`LIVES: ${'❤'.repeat(lives)}`, 20, 70);
      ctx.fillText(`WAVE: ${wave}`, 20, 100);
      
      if (combo > 1) {
        ctx.fillStyle = isFever ? '#f0f' : '#fbbf24';
        ctx.font = 'bold 30px "Courier New"';
        ctx.fillText(`${combo}X COMBO`, 20, 140);
        if (isFever) {
          ctx.font = 'bold 20px "Courier New"';
          ctx.fillText('FEVER MODE!', 20, 170);
        }
      }
    }

    if (state === GameState.PLAYING || state === GameState.PAUSED) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 20px "Courier New"';
      ctx.fillText(`FIND THE SOUND`, canvas.width / 2, 40);
      if (playerRef.current?.jammed) {
        ctx.fillStyle = '#f00';
        ctx.font = 'bold 24px "Courier New"';
        ctx.fillText('WEAPON JAMMED!', canvas.width / 2, canvas.height / 2);
      }
    }
  });

  const handleTogglePause = () => {
    setState(s => {
      if (s === GameState.PAUSED) return prevStateRef.current;
      prevStateRef.current = s;
      return GameState.PAUSED;
    });
  };

  const handleGoToStart = () => {
    setScore(0);
    setWave(1);
    setLives(3);
    setCombo(0);
    setIsFever(false);
    if (waveManagerRef.current) {
      waveManagerRef.current.currentWave = 1;
      waveManagerRef.current.spawnWave(dimensions.width);
    }
    playerRef.current = new Player(dimensions.width, dimensions.height);
    setState(GameState.START);
  };

  const handleStart = () => {
    setState(GameState.BRIEFING);
  };

  const handleListenAgain = () => {
    if (waveManagerRef.current) {
      phonemePlayerRef.current?.play(waveManagerRef.current.targetCharacter);
    }
  };

  const handleRestart = () => {
    setScore(0);
    setWave(1);
    setLives(3);
    if (waveManagerRef.current) {
      waveManagerRef.current.currentWave = 1;
      waveManagerRef.current.spawnWave(dimensions.width);
    }
    setState(GameState.BRIEFING);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
      />
      
      {state === GameState.START && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <h1 style={titleStyle}>GAELLAREUGEU</h1>
            <p style={{ fontSize: '11px', color: '#0ff', letterSpacing: '3px', opacity: 0.5, marginTop: '-14px', marginBottom: '28px' }}>v0.1.10</p>
            <p style={{ ...pStyle, color: '#555', fontSize: '14px' }}>Listen to the sound. Shoot the matching character.</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '20px' }}>
              <button onClick={handleStart} style={buttonStyle}>SHOOT</button>
              <button onClick={onDrill} style={{ ...buttonStyle, borderColor: '#f0f', color: '#f0f', boxShadow: '0 0 20px rgba(255,0,255,0.25)' }}>DRILL</button>
            </div>
            <p style={{ fontSize: '11px', color: '#333', letterSpacing: '3px' }}>SPACE · ENTER TO START</p>
          </div>
        </div>
      )}

      {state === GameState.BRIEFING && (
        <div style={overlayStyle}>
          <div style={{ ...panelStyle, borderColor: 'rgba(251,191,36,0.15)' }}>
            <p style={{ fontSize: '10px', letterSpacing: '5px', color: '#555', marginBottom: '16px' }}>TARGET PHONEME</p>
            <div style={{ fontSize: '100px', lineHeight: 1, color: '#fff', fontFamily: '"Inter", "Apple SD Gothic Neo", sans-serif', marginBottom: '16px' }}>
              {waveManagerRef.current?.targetCharacter}
            </div>
            <p style={{ fontSize: '11px', letterSpacing: '4px', color: '#fbbf24', marginTop: '8px' }}>
              READY IN {briefingTimer}
            </p>
          </div>
        </div>
      )}

      {state === GameState.WAVE_CLEAR && (
        <div style={overlayStyle}>
          <div style={{ ...panelStyle, borderColor: 'rgba(74,222,128,0.2)' }}>
            <p style={{ fontSize: '11px', letterSpacing: '5px', color: '#4ade80', marginBottom: '10px' }}>WAVE CLEAR</p>
            <p style={{ fontSize: '28px', color: '#fff', letterSpacing: '2px', margin: '0 0 12px' }}>WAVE {wave - 1}</p>
            <p style={{ fontSize: '13px', color: '#fbbf24', letterSpacing: '2px' }}>+500 PTS</p>
          </div>
        </div>
      )}

      {state === GameState.GAME_OVER && (
        <div style={overlayStyle}>
          <div style={{ ...panelStyle, borderColor: 'rgba(248,113,113,0.2)' }}>
            <p style={{ fontSize: '11px', letterSpacing: '5px', color: '#f87171', marginBottom: '16px' }}>MISSION FAILED</p>
            <p style={{ fontSize: '64px', color: '#fbbf24', lineHeight: 1, marginBottom: '6px', textShadow: '0 0 20px rgba(251,191,36,0.4)' }}>{score}</p>
            <p style={{ fontSize: '11px', letterSpacing: '4px', color: '#444', marginBottom: '32px' }}>FINAL SCORE</p>
            <button onClick={handleRestart} style={{ ...buttonStyle, borderColor: 'rgba(248,113,113,0.6)', color: '#f87171', boxShadow: 'none' }}>RETRY</button>
          </div>
        </div>
      )}

      {state === GameState.PAUSED && (
        <div style={overlayStyle}>
          <div style={panelStyle}>
            <p style={{ fontSize: '32px', color: '#0ff', letterSpacing: '10px', textShadow: '0 0 20px rgba(0,255,255,0.4)', margin: '0 0 12px' }}>PAUSED</p>
            <p style={{ fontSize: '11px', color: '#333', letterSpacing: '3px' }}>P TO RESUME · Q/ESC TO QUIT</p>
          </div>
        </div>
      )}

      {state === GameState.PLAYING && (
        <button
          onClick={handleListenAgain}
          style={{
            position: 'absolute', bottom: '24px', right: '24px',
            padding: '8px 18px',
            background: 'rgba(0,255,255,0.05)',
            border: '1px solid rgba(0,255,255,0.2)',
            color: 'rgba(0,255,255,0.6)',
            borderRadius: '6px', cursor: 'pointer',
            fontFamily: '"Courier New", monospace',
            fontSize: '12px', letterSpacing: '2px',
            pointerEvents: 'auto',
          }}
        >
          ▶ LISTEN (L)
        </button>
      )}
    </div>
  );
};

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%', left: '50%',
  transform: 'translate(-50%, -50%)',
  textAlign: 'center',
  color: '#fff',
  fontFamily: '"Courier New", Courier, monospace',
  width: '100%',
  pointerEvents: 'none',
};

const panelStyle: React.CSSProperties = {
  display: 'inline-block',
  background: 'rgba(0,0,0,0.88)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '14px',
  padding: '44px 60px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '52px',
  color: '#0ff',
  textShadow: '0 0 30px rgba(0,255,255,0.5)',
  letterSpacing: '4px',
  marginBottom: '8px',
};

const pStyle: React.CSSProperties = {
  fontSize: '16px',
  marginBottom: '24px',
  color: '#888',
};

const buttonStyle: React.CSSProperties = {
  padding: '14px 36px',
  fontSize: '18px',
  background: 'transparent',
  border: '1px solid rgba(0,255,255,0.5)',
  color: '#0ff',
  borderRadius: '8px',
  cursor: 'pointer',
  fontFamily: '"Courier New", monospace',
  letterSpacing: '3px',
  boxShadow: '0 0 20px rgba(0,255,255,0.15)',
  pointerEvents: 'auto',
};

export default GameContainer;
