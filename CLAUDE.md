# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**GAELLAREUGEU** — a Korean phoneme-learning shoot-'em-up game. The player hears a Hangeul character (consonant or vowel) spoken aloud and must shoot the matching enemy ship before enemy fire destroys them. No backend, no auth, no persistence.

Stack: React 19 + TypeScript, Vite, Canvas 2D API, Web Speech API, Web Audio API.

## Commands

```bash
npm run dev       # start dev server (localhost:5173)
npm run build     # type-check + Vite production build
npm run lint      # ESLint
npm run preview   # serve production build locally
```

No test runner is configured.

## Architecture

All game logic lives in `src/engine/` as plain TypeScript classes — zero framework dependencies. React only owns the canvas element, dimensions state, score/lives/wave HUD state, and overlay screens (START, BRIEFING, WAVE_CLEAR, GAME_OVER). The game loop is driven by `src/hooks/useGameLoop.ts` via `requestAnimationFrame`; it passes a capped `delta` (ms) to the render callback on every frame.

### Engine classes

| File | Role |
|------|------|
| `Player.ts` | Player ship position, movement (keyboard + touch), projectile list, jam state, fever-mode fire rate |
| `Enemy.ts` | Single enemy ship; state machine: `ENTERING → FORMATION → DIVING → RETURNING`; swirl/dive motion |
| `WaveManager.ts` | Spawns 4×3 formation of Hangeul characters; picks `targetCharacter`; manages formation movement, enemy diving, target-promotion shuffles, enemy fire, bullet collision detection |
| `InputHandler.ts` | Keyboard (`ArrowLeft/A`, `ArrowRight/D`, `Space`) + touch events |
| `PhonemePlayer.ts` | Wraps `window.speechSynthesis`; plays `targetCharacter` via `ko-KR` voice |
| `SoundEngine.ts` | Singleton; synthesises pew/boom/jam/success tones with Web Audio API oscillators |
| `Starfield.ts` | 200-star scrolling background |
| `ParticleSystem.ts` | Explosion, spark, and engine-trail particles |

### Game state flow

```
START → BRIEFING (3s countdown + phoneme played) → PLAYING
  → WAVE_CLEAR (2s) → BRIEFING (next wave)
  → GAME_OVER → BRIEFING (restart, wave resets to 1)
```

### Scoring & mechanics

- Shooting a **target** (gold, `isTarget = true`): `+100 × (combo + 1)` per enemy, combo increments
- Shooting a **distractor** (pink): `-50`, combo resets, weapon jammed for 1.5 s
- Wave clear bonus: `+500`
- Combo ≥ 5 triggers **Fever Mode** (faster fire rate, magenta visuals)
- Enemy fire hits player: loses 1 life; 0 lives → GAME_OVER

### Wave progression

- Waves 1–3: consonants only (`ㄱ–ㅎ`, first 5)
- Wave 4+: full consonant + vowel pool
- Dive frequency and enemy fire rate increase with `currentWave`
- Every 3 s a buried target swaps formation slots with a front-row distractor (`RETURNING` transition)
