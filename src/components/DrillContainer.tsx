import React, { useState, useEffect, useRef } from 'react';
import { PhonemePlayer } from '../engine/PhonemePlayer';
import { SoundEngine } from '../engine/SoundEngine';
import { CONSONANTS, VOWELS, CHAR_LABELS, ALL_LABELS, LABEL_TO_CHAR } from '../engine/koreanChars';

type DrillPhase = 'LEVEL_SELECT' | 'COUNTDOWN' | 'QUESTION' | 'FEEDBACK' | 'RESULTS';

interface Question {
  target: string;
  choices: string[];
  answer: string;
}

interface LevelConfig {
  choices: number;
  sessionSeconds: number;
  questionSeconds: number | null;
  label: string;
  desc: string;
  soundMode: boolean;
  accent: string;
}

const LEVELS: LevelConfig[] = [
  { choices: 4, sessionSeconds: 90, questionSeconds: null, label: 'LEVEL 1', desc: '4 choices · 90s session',      soundMode: false, accent: '#0ff' },
  { choices: 6, sessionSeconds: 90, questionSeconds: 6,    label: 'LEVEL 2', desc: '6 choices · 6s per question',  soundMode: false, accent: '#0ff' },
  { choices: 8, sessionSeconds: 90, questionSeconds: 4,    label: 'LEVEL 3', desc: '8 choices · 4s per question',  soundMode: false, accent: '#0ff' },
  { choices: 6, sessionSeconds: 90, questionSeconds: null, label: 'SOUND',   desc: 'see char · pick phoneme',      soundMode: true,  accent: '#f0f' },
];

const FEEDBACK_MS = 700;
const POOL_EXPAND_AT = 10;

function makeListenQuestion(pool: string[], numChoices: number, exclude?: string): Question {
  const candidates = exclude ? pool.filter(c => c !== exclude) : pool;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const others = pool.filter(c => c !== target);
  const distractors: string[] = [];
  const used = new Set<string>([target]);
  while (distractors.length < Math.min(numChoices - 1, others.length)) {
    const pick = others[Math.floor(Math.random() * others.length)];
    if (!used.has(pick)) { used.add(pick); distractors.push(pick); }
  }
  return { target, choices: [target, ...distractors].sort(() => Math.random() - 0.5), answer: target };
}

function makeSoundQuestion(pool: string[], exclude?: string): Question {
  const candidates = exclude ? pool.filter(c => c !== exclude) : pool;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const answer = CHAR_LABELS[target];
  const otherLabels = ALL_LABELS.filter(l => l !== answer);
  const distractors: string[] = [];
  const used = new Set<string>([answer]);
  while (distractors.length < Math.min(5, otherLabels.length)) {
    const pick = otherLabels[Math.floor(Math.random() * otherLabels.length)];
    if (!used.has(pick)) { used.add(pick); distractors.push(pick); }
  }
  return { target, choices: [answer, ...distractors].sort(() => Math.random() - 0.5), answer };
}

function nextQuestion(pool: string[], level: LevelConfig, exclude?: string): Question {
  return level.soundMode
    ? makeSoundQuestion(pool, exclude)
    : makeListenQuestion(pool, level.choices, exclude);
}

const DrillContainer: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [phase, setPhase] = useState<DrillPhase>('LEVEL_SELECT');
  const [levelIdx, setLevelIdx] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  const phoneme = useRef(new PhonemePlayer());
  const lastTargetRef = useRef<string | undefined>(undefined);
  const correctRef = useRef(0);
  const timeLeftRef = useRef(0);

  const level = LEVELS[levelIdx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'q' || e.key === 'Q') { onBack(); return; }
      if (e.key === 'Escape') {
        e.preventDefault();
        setTimerRunning(false);
        setQuestionTimeLeft(null);
        setPaused(false);
        setPhase('LEVEL_SELECT');
        return;
      }
      if (e.key === 'p' || e.key === 'P') setPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const getPool = () =>
    correctRef.current >= POOL_EXPAND_AT ? [...CONSONANTS, ...VOWELS] : VOWELS;

  const multiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
  const poolLabel = correct >= POOL_EXPAND_AT ? 'ALL' : 'VOWELS';
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    if (countdown <= 0) {
      const q = nextQuestion(getPool(), level);
      lastTargetRef.current = q.target;
      setQuestion(q);
      setPhase('QUESTION');
      setTimerRunning(true);
      if (level.questionSeconds !== null) setQuestionTimeLeft(level.questionSeconds);
      if (!level.soundMode) setTimeout(() => phoneme.current.play(q.target), 80);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  useEffect(() => {
    if (!timerRunning || paused) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [timerRunning, paused]);

  useEffect(() => {
    if (timeLeft === 0 && timerRunning) {
      setTimerRunning(false);
      setPhase('RESULTS');
    }
  }, [timeLeft, timerRunning]);

  useEffect(() => {
    if (phase !== 'QUESTION' || level.questionSeconds === null || paused) return;
    const t = setInterval(() => {
      setQuestionTimeLeft(s => (s === null || s <= 1) ? 0 : s - 1);
    }, 1000);
    return () => clearInterval(t);
  }, [phase, level.questionSeconds, paused]);

  useEffect(() => {
    if (phase !== 'QUESTION' || questionTimeLeft !== 0 || level.questionSeconds === null || paused) return;
    setSelected(null);
    setTotal(t => t + 1);
    setStreak(0);
    SoundEngine.getInstance().playJam();
    setPhase('FEEDBACK');
  }, [questionTimeLeft, phase, level.questionSeconds, paused]);

  useEffect(() => {
    if (phase !== 'FEEDBACK') return;
    const t = setTimeout(() => {
      if (timeLeftRef.current > 0) {
        const q = nextQuestion(getPool(), level, lastTargetRef.current);
        lastTargetRef.current = q.target;
        setQuestion(q);
        setSelected(null);
        setPhase('QUESTION');
        if (level.questionSeconds !== null) setQuestionTimeLeft(level.questionSeconds);
        if (!level.soundMode) setTimeout(() => phoneme.current.play(q.target), 80);
      } else {
        setPhase('RESULTS');
      }
    }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const handleSelect = (choice: string) => {
    if (phase !== 'QUESTION' || !question) return;
    const isCorrect = choice === question.answer;
    setSelected(choice);
    setTotal(t => t + 1);
    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      const mult = newStreak >= 10 ? 3 : newStreak >= 5 ? 2 : 1;
      setScore(s => s + 10 * mult);
      setCorrect(c => { const next = c + 1; correctRef.current = next; return next; });
      SoundEngine.getInstance().playSuccess();
      if (level.soundMode) phoneme.current.play(question.target);
    } else {
      setStreak(0);
      SoundEngine.getInstance().playJam();
    }
    setPhase('FEEDBACK');
  };

  const handleReplay = () => question && phoneme.current.play(question.target);

  const startLevel = (idx: number) => {
    correctRef.current = 0;
    timeLeftRef.current = LEVELS[idx].sessionSeconds;
    lastTargetRef.current = undefined;
    setLevelIdx(idx);
    setPhase('COUNTDOWN');
    setCountdown(3);
    setQuestion(null);
    setSelected(null);
    setScore(0);
    setCorrect(0);
    setTotal(0);
    setStreak(0);
    setTimeLeft(LEVELS[idx].sessionSeconds);
    setQuestionTimeLeft(null);
    setTimerRunning(false);
    setPaused(false);
  };

  const handleRestart = () => startLevel(levelIdx);

  const soundGridCols = '1fr 1fr';
  const listenGridCols = level.choices === 4 ? '1fr 1fr'
    : level.choices === 6 ? '1fr 1fr 1fr'
    : '1fr 1fr 1fr 1fr';
  const gridCols  = level.soundMode ? soundGridCols : listenGridCols;
  const gridW     = level.soundMode ? 340 : level.choices === 4 ? 320 : level.choices === 6 ? 440 : 480;
  const btnH      = level.soundMode ? 54  : level.choices === 4 ? 130 : level.choices === 6 ? 110 : 90;
  const btnFont   = level.soundMode ? 16  : level.choices === 4 ? 68  : level.choices === 6 ? 56  : 48;
  const btnFamily = level.soundMode ? '"Courier New", monospace' : '"Inter", "Apple SD Gothic Neo", sans-serif';

  const root: React.CSSProperties = {
    width: '100vw', height: '100vh',
    background: '#000', color: '#fff',
    fontFamily: '"Courier New", monospace',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', userSelect: 'none',
  };

  // ── Level select ─────────────────────────────────────────────────────────

  if (phase === 'LEVEL_SELECT') {
    return (
      <div style={root}>
        {/* back */}
        <button onClick={onBack} style={{
          position: 'absolute', top: 24, left: 24,
          background: 'none', border: 'none', color: '#444',
          fontSize: '13px', letterSpacing: '2px', cursor: 'pointer',
          fontFamily: '"Courier New", monospace', padding: '4px 0',
        }}>← BACK</button>

        <div style={{ fontSize: '11px', letterSpacing: '6px', color: '#444', marginBottom: '32px' }}>
          DRILL MODE
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '340px' }}>

          {/* section label: LISTEN */}
          <div style={{ fontSize: '10px', letterSpacing: '4px', color: '#333', marginBottom: '2px' }}>
            LISTEN
          </div>

          {LEVELS.slice(0, 3).map((l, i) => (
            <button key={i} onClick={() => startLevel(i)} style={{
              padding: '14px 18px',
              background: 'rgba(0,255,255,0.03)',
              border: '1px solid rgba(0,255,255,0.12)',
              borderLeft: '3px solid #0ff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: '"Courier New", monospace',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              transition: 'background 0.15s',
            }}>
              <span style={{ fontSize: '14px', letterSpacing: '3px', fontWeight: 'bold', color: '#0ff' }}>{l.label}</span>
              <span style={{ fontSize: '11px', color: '#555', letterSpacing: '1px' }}>{l.desc}</span>
            </button>
          ))}

          {/* divider */}
          <div style={{ height: '1px', background: '#111', margin: '6px 0' }} />

          {/* section label: SOUND */}
          <div style={{ fontSize: '10px', letterSpacing: '4px', color: '#333', marginBottom: '2px' }}>
            SOUND
          </div>

          <button onClick={() => startLevel(3)} style={{
            padding: '14px 18px',
            background: 'rgba(255,0,255,0.03)',
            border: '1px solid rgba(255,0,255,0.15)',
            borderLeft: '3px solid #f0f',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: '"Courier New", monospace',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}>
            <span style={{ fontSize: '14px', letterSpacing: '3px', fontWeight: 'bold', color: '#f0f' }}>SOUND</span>
            <span style={{ fontSize: '11px', color: '#555', letterSpacing: '1px' }}>{LEVELS[3].desc}</span>
          </button>

        </div>
      </div>
    );
  }

  // ── Countdown ─────────────────────────────────────────────────────────────

  if (phase === 'COUNTDOWN') {
    return (
      <div style={root}>
        <div style={{ fontSize: '11px', letterSpacing: '4px', color: '#333', marginBottom: '24px' }}>
          {level.label}
        </div>
        <div style={{ fontSize: '120px', color: level.accent, textShadow: `0 0 40px ${level.accent}`, lineHeight: 1 }}>
          {countdown > 0 ? countdown : '▶'}
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────

  if (phase === 'RESULTS') {
    return (
      <div style={root}>
        <div style={{ fontSize: '11px', letterSpacing: '4px', color: '#444', marginBottom: '6px' }}>
          {level.label}
        </div>
        <div style={{ fontSize: '13px', letterSpacing: '6px', color: level.accent, marginBottom: '32px' }}>
          SESSION OVER
        </div>

        <div style={{ fontSize: '80px', color: '#fbbf24', lineHeight: 1, textShadow: '0 0 24px rgba(251,191,36,0.5)', marginBottom: '6px' }}>
          {score}
        </div>
        <div style={{ fontSize: '13px', color: '#444', letterSpacing: '2px', marginBottom: '32px' }}>
          PTS
        </div>

        <div style={{
          display: 'flex', gap: '32px', marginBottom: '48px',
          fontSize: '14px', letterSpacing: '2px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: '24px', marginBottom: '4px' }}>{correct}/{total}</div>
            <div style={{ color: '#444', fontSize: '10px', letterSpacing: '3px' }}>CORRECT</div>
          </div>
          <div style={{ width: '1px', background: '#1a1a1a' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: accuracy >= 80 ? '#4ade80' : accuracy >= 60 ? '#fbbf24' : '#f87171', fontSize: '24px', marginBottom: '4px' }}>{accuracy}%</div>
            <div style={{ color: '#444', fontSize: '10px', letterSpacing: '3px' }}>ACCURACY</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleRestart} style={btnStyle(level.accent)}>AGAIN</button>
          <button onClick={() => setPhase('LEVEL_SELECT')} style={btnStyle('#333')}>LEVELS</button>
          <button onClick={onBack} style={btnStyle('#2a2a2a')}>BACK</button>
        </div>
      </div>
    );
  }

  // ── Question / Feedback ───────────────────────────────────────────────────

  return (
    <div style={root}>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 28px',
        borderBottom: '1px solid #0d0d0d',
      }}>
        <span style={{ color: level.accent, fontSize: '20px', fontWeight: 'bold', minWidth: '60px' }}>{score}</span>
        <span style={{
          color: timeLeft <= 10 ? '#f87171' : '#fbbf24',
          fontSize: '28px', fontWeight: 'bold',
          textShadow: timeLeft <= 10 ? '0 0 16px rgba(248,113,113,0.6)' : 'none',
        }}>{timeLeft}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '60px', justifyContent: 'flex-end' }}>
          <span style={{ color: '#2a2a2a', fontSize: '11px', letterSpacing: '2px' }}>{poolLabel}</span>
          <span style={{
            fontSize: '10px', letterSpacing: '2px', padding: '2px 8px',
            border: `1px solid ${level.accent}44`,
            color: level.accent, borderRadius: '3px',
            opacity: 0.7,
          }}>{level.label}</span>
        </div>
      </div>

      {/* Streak */}
      {streak > 1 && (
        <div style={{
          position: 'absolute', top: 72, left: 28,
          color: multiplier > 1 ? '#f0f' : '#fbbf24',
          fontSize: '13px', letterSpacing: '2px',
        }}>
          {streak}× {multiplier > 1 ? `· ${multiplier}× pts` : 'streak'}
        </div>
      )}

      {/* Per-question countdown bar */}
      {level.questionSeconds !== null && questionTimeLeft !== null && (
        <div style={{ width: `${gridW}px`, marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
            <span style={{
              fontSize: '13px', letterSpacing: '1px',
              color: questionTimeLeft <= 2 ? '#f87171' : '#555',
            }}>{questionTimeLeft}s</span>
          </div>
          <div style={{ height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(questionTimeLeft / level.questionSeconds) * 100}%`,
              background: questionTimeLeft <= 2 ? '#f87171' : '#fbbf24',
              borderRadius: '2px',
              transition: 'width 0.9s linear, background 0.2s',
            }} />
          </div>
        </div>
      )}

      {/* Sound mode: large character */}
      {level.soundMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '140px', lineHeight: 1,
            fontFamily: '"Inter", "Apple SD Gothic Neo", sans-serif',
            color: '#fff',
            textShadow: phase === 'FEEDBACK'
              ? (selected === question?.answer ? '0 0 40px rgba(74,222,128,0.7)' : '0 0 40px rgba(248,113,113,0.7)')
              : '0 0 30px rgba(255,255,255,0.08)',
            marginBottom: '20px',
          }}>
            {question?.target}
          </div>
          <button onClick={handleReplay} style={{
            padding: '6px 20px', fontSize: '11px',
            background: 'none', border: '1px solid #1e1e1e',
            color: '#444', borderRadius: '4px', cursor: 'pointer',
            fontFamily: '"Courier New", monospace', letterSpacing: '2px',
          }}>
            ▶ hint
          </button>
        </div>
      ) : (
        <button onClick={handleReplay} style={{
          marginBottom: '32px', padding: '14px 48px', fontSize: '20px',
          background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.25)',
          color: '#0ff', borderRadius: '8px', cursor: 'pointer',
          fontFamily: '"Courier New", monospace', letterSpacing: '4px',
        }}>
          ▶ PLAY
        </button>
      )}

      {/* Pause overlay */}
      {paused && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '42px', color: level.accent, letterSpacing: '10px', textShadow: `0 0 30px ${level.accent}` }}>PAUSED</div>
          <div style={{ fontSize: '11px', color: '#333', marginTop: '20px', letterSpacing: '3px' }}>P TO RESUME · ESC FOR MENU · Q TO QUIT</div>
        </div>
      )}

      {/* Choice grid */}
      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '12px', width: `${gridW}px` }}>
        {question?.choices.map(choice => {
          let border = '1px solid #1a1a1a';
          let bg = 'rgba(255,255,255,0.02)';
          let color = '#ccc';
          let shadow = 'none';

          if (phase === 'FEEDBACK') {
            if (choice === question.answer) {
              border = '1px solid #4ade80';
              bg = 'rgba(74,222,128,0.08)';
              color = '#4ade80';
              shadow = '0 0 12px rgba(74,222,128,0.15)';
            } else if (choice === selected) {
              border = '1px solid #f87171';
              bg = 'rgba(248,113,113,0.08)';
              color = '#f87171';
            }
          }

          const handleHover = level.soundMode
            ? () => { const c = LABEL_TO_CHAR[choice]; if (c) phoneme.current.play(c); }
            : undefined;

          return (
            <button
              key={choice}
              onClick={() => handleSelect(choice)}
              onMouseEnter={handleHover}
              style={{
                height: `${btnH}px`,
                fontSize: `${btnFont}px`,
                background: bg, border, color,
                borderRadius: '8px',
                boxShadow: shadow,
                cursor: phase === 'QUESTION' ? 'pointer' : 'default',
                fontFamily: btnFamily,
                letterSpacing: level.soundMode ? '0.5px' : 'normal',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 0.1s, background 0.1s, color 0.1s',
              }}
            >
              {choice}
            </button>
          );
        })}
      </div>
    </div>
  );
};

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '12px 28px', fontSize: '13px',
    background: 'transparent', border: `1px solid ${color}`,
    color, borderRadius: '6px', cursor: 'pointer',
    fontFamily: '"Courier New", monospace', fontWeight: 'bold',
    letterSpacing: '3px',
  };
}

export default DrillContainer;
