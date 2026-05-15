import React, { useState, useEffect, useRef } from 'react';
import { PhonemePlayer } from '../engine/PhonemePlayer';
import { SoundEngine } from '../engine/SoundEngine';
import { CONSONANTS, VOWELS } from '../engine/koreanChars';

type DrillPhase = 'LEVEL_SELECT' | 'COUNTDOWN' | 'QUESTION' | 'FEEDBACK' | 'RESULTS';

interface Question {
  target: string;
  choices: string[];
}

interface LevelConfig {
  choices: number;
  sessionSeconds: number;
  questionSeconds: number | null;
  label: string;
  desc: string;
}

const LEVELS: LevelConfig[] = [
  { choices: 4, sessionSeconds: 90, questionSeconds: null, label: 'LEVEL 1', desc: '4 choices · 90s session' },
  { choices: 6, sessionSeconds: 90, questionSeconds: 6,    label: 'LEVEL 2', desc: '6 choices · 6s per question' },
  { choices: 8, sessionSeconds: 90, questionSeconds: 4,    label: 'LEVEL 3', desc: '8 choices · 4s per question' },
];

const FEEDBACK_MS = 700;
const POOL_EXPAND_AT = 10;

function makeQuestion(pool: string[], numChoices: number, exclude?: string): Question {
  const candidates = exclude ? pool.filter(c => c !== exclude) : pool;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const others = pool.filter(c => c !== target);
  const distractors: string[] = [];
  const used = new Set<string>([target]);
  while (distractors.length < Math.min(numChoices - 1, others.length)) {
    const pick = others[Math.floor(Math.random() * others.length)];
    if (!used.has(pick)) { used.add(pick); distractors.push(pick); }
  }
  return { target, choices: [target, ...distractors].sort(() => Math.random() - 0.5) };
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
  const questionTimeLeftRef = useRef<number | null>(null);

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
      if (e.key === 'p' || e.key === 'P') {
        setPaused(p => !p);
      }
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
  useEffect(() => { questionTimeLeftRef.current = questionTimeLeft; }, [questionTimeLeft]);

  // Countdown phase
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    if (countdown <= 0) {
      const q = makeQuestion(getPool(), level.choices);
      lastTargetRef.current = q.target;
      setQuestion(q);
      setPhase('QUESTION');
      setTimerRunning(true);
      if (level.questionSeconds !== null) setQuestionTimeLeft(level.questionSeconds);
      setTimeout(() => phoneme.current.play(q.target), 80);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Session timer
  useEffect(() => {
    if (!timerRunning || paused) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [timerRunning, paused]);

  // Session time's up
  useEffect(() => {
    if (timeLeft === 0 && timerRunning) {
      setTimerRunning(false);
      setPhase('RESULTS');
    }
  }, [timeLeft, timerRunning]);

  // Per-question timer (levels 2 & 3)
  useEffect(() => {
    if (phase !== 'QUESTION' || level.questionSeconds === null || paused) return;
    const t = setInterval(() => {
      setQuestionTimeLeft(s => {
        if (s === null || s <= 1) return 0;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, level.questionSeconds, paused]);

  // Per-question expiry → auto-wrong
  useEffect(() => {
    if (phase !== 'QUESTION' || questionTimeLeft !== 0 || level.questionSeconds === null || paused) return;
    setSelected(null);
    setTotal(t => t + 1);
    setStreak(0);
    SoundEngine.getInstance().playJam();
    setPhase('FEEDBACK');
  }, [questionTimeLeft, phase, level.questionSeconds]);

  // Feedback → next question
  useEffect(() => {
    if (phase !== 'FEEDBACK') return;
    const t = setTimeout(() => {
      if (timeLeftRef.current > 0) {
        const q = makeQuestion(getPool(), level.choices, lastTargetRef.current);
        lastTargetRef.current = q.target;
        setQuestion(q);
        setSelected(null);
        setPhase('QUESTION');
        if (level.questionSeconds !== null) setQuestionTimeLeft(level.questionSeconds);
        setTimeout(() => phoneme.current.play(q.target), 80);
      } else {
        setPhase('RESULTS');
      }
    }, FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const handleSelect = (char: string) => {
    if (phase !== 'QUESTION' || !question) return;
    const isCorrect = char === question.target;
    setSelected(char);
    setTotal(t => t + 1);
    if (isCorrect) {
      const newStreak = streak + 1;
      setStreak(newStreak);
      const mult = newStreak >= 10 ? 3 : newStreak >= 5 ? 2 : 1;
      setScore(s => s + 10 * mult);
      setCorrect(c => {
        const next = c + 1;
        correctRef.current = next;
        return next;
      });
      SoundEngine.getInstance().playSuccess();
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

  const gridCols = level.choices === 4 ? '1fr 1fr'
    : level.choices === 6 ? '1fr 1fr 1fr'
    : '1fr 1fr 1fr 1fr';

  const btnH = level.choices === 4 ? 130 : level.choices === 6 ? 110 : 90;
  const btnFont = level.choices === 4 ? 68 : level.choices === 6 ? 56 : 48;
  const gridW = level.choices === 4 ? 320 : level.choices === 6 ? 440 : 480;

  // ── Styles ──────────────────────────────────────────────────────────────

  const root: React.CSSProperties = {
    width: '100vw', height: '100vh',
    background: '#000', color: '#fff',
    fontFamily: '"Courier New", monospace',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', userSelect: 'none',
  };

  // ── Level select screen ──────────────────────────────────────────────────

  if (phase === 'LEVEL_SELECT') {
    return (
      <div style={root}>
        <h1 style={{ color: '#0ff', fontSize: '28px', letterSpacing: '6px', marginBottom: '40px' }}>
          DRILL MODE
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '320px' }}>
          {LEVELS.map((l, i) => (
            <button key={i} onClick={() => startLevel(i)} style={{
              padding: '18px 24px',
              background: 'rgba(0,255,255,0.05)',
              border: '2px solid #0ff',
              color: '#0ff',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: '"Courier New", monospace',
              textAlign: 'left',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '18px', letterSpacing: '2px', fontWeight: 'bold' }}>{l.label}</span>
              <span style={{ fontSize: '13px', color: '#aaa', letterSpacing: '1px' }}>{l.desc}</span>
            </button>
          ))}
        </div>
        <button onClick={onBack} style={{ ...btnStyle('#444'), marginTop: '32px' }}>BACK</button>
      </div>
    );
  }

  // ── Countdown screen ─────────────────────────────────────────────────────

  if (phase === 'COUNTDOWN') {
    return (
      <div style={root}>
        <div style={{ fontSize: '120px', color: '#0ff', textShadow: '0 0 30px #0ff', lineHeight: 1 }}>
          {countdown > 0 ? countdown : '▶'}
        </div>
      </div>
    );
  }

  // ── Results screen ───────────────────────────────────────────────────────

  if (phase === 'RESULTS') {
    return (
      <div style={root}>
        <div style={{ color: '#444', fontSize: '13px', letterSpacing: '3px', marginBottom: '8px' }}>
          {level.label}
        </div>
        <h1 style={{ color: '#0ff', fontSize: '36px', letterSpacing: '4px', marginBottom: '10px' }}>
          SESSION OVER
        </h1>
        <p style={{ fontSize: '72px', color: '#fbbf24', margin: '10px 0', textShadow: '0 0 20px #fbbf24' }}>
          {score}
        </p>
        <p style={{ fontSize: '20px', color: '#aaa', margin: '6px 0' }}>
          {correct} / {total} &nbsp;·&nbsp; {accuracy}%
        </p>
        <div style={{ marginTop: '48px', display: 'flex', gap: '20px' }}>
          <button onClick={handleRestart} style={btnStyle('#0ff')}>AGAIN</button>
          <button onClick={() => setPhase('LEVEL_SELECT')} style={btnStyle('#f0f')}>LEVELS</button>
          <button onClick={onBack} style={btnStyle('#666')}>BACK</button>
        </div>
      </div>
    );
  }

  // ── Question / Feedback screen ───────────────────────────────────────────

  return (
    <div style={root}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 20, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', padding: '0 30px',
      }}>
        <span style={{ color: '#0ff', fontSize: '22px' }}>{score}</span>
        <span style={{
          color: timeLeft <= 10 ? '#f00' : '#fbbf24',
          fontSize: '32px', fontWeight: 'bold',
          textShadow: timeLeft <= 10 ? '0 0 12px #f00' : 'none',
        }}>{timeLeft}</span>
        <span style={{ color: '#444', fontSize: '13px', letterSpacing: '2px' }}>{poolLabel}</span>
      </div>

      {/* Streak */}
      {streak > 1 && (
        <div style={{
          position: 'absolute', top: 62, left: 30,
          color: multiplier > 1 ? '#f0f' : '#fbbf24',
          fontSize: '16px', letterSpacing: '1px',
        }}>
          {streak} streak{multiplier > 1 ? ` · ${multiplier}×` : ''}
        </div>
      )}

      {/* Per-question countdown bar (levels 2 & 3) */}
      {level.questionSeconds !== null && questionTimeLeft !== null && (
        <div style={{ width: `${gridW}px`, marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '13px', color: '#555', letterSpacing: '2px' }}>TIME</span>
            <span style={{
              fontSize: '18px', fontWeight: 'bold', letterSpacing: '1px',
              color: questionTimeLeft <= 2 ? '#f00' : '#fbbf24',
              textShadow: questionTimeLeft <= 2 ? '0 0 10px #f00' : 'none',
            }}>{questionTimeLeft}s</span>
          </div>
          <div style={{ height: '6px', background: '#111', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(questionTimeLeft / level.questionSeconds) * 100}%`,
              background: questionTimeLeft <= 2 ? '#f00' : '#fbbf24',
              borderRadius: '3px',
              transition: 'width 0.9s linear, background 0.2s',
              boxShadow: questionTimeLeft <= 2 ? '0 0 8px #f00' : 'none',
            }} />
          </div>
        </div>
      )}

      {/* Replay button */}
      <button onClick={handleReplay} style={{
        marginBottom: '36px',
        padding: '14px 52px',
        fontSize: '22px',
        background: 'rgba(0,255,255,0.08)',
        border: '2px solid #0ff',
        color: '#0ff',
        borderRadius: '8px',
        cursor: 'pointer',
        fontFamily: '"Courier New", monospace',
        letterSpacing: '3px',
        boxShadow: '0 0 10px rgba(0,255,255,0.3)',
      }}>
        ▶ PLAY
      </button>

      {paused && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}>
          <div style={{ fontSize: '48px', color: '#0ff', letterSpacing: '8px', textShadow: '0 0 20px #0ff' }}>PAUSED</div>
          <div style={{ fontSize: '13px', color: '#555', marginTop: '16px', letterSpacing: '2px' }}>P TO RESUME · ESC FOR MENU · Q TO QUIT</div>
        </div>
      )}

      {/* Choice grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: gridCols,
        gap: '16px',
        width: `${gridW}px`,
      }}>
        {question?.choices.map(char => {
          let border = '2px solid #222';
          let bg = 'rgba(255,255,255,0.03)';
          let color = '#fff';

          if (phase === 'FEEDBACK') {
            if (char === question.target) {
              border = '2px solid #4ade80';
              bg = 'rgba(74,222,128,0.12)';
              color = '#4ade80';
            } else if (char === selected) {
              border = '2px solid #f00';
              bg = 'rgba(255,0,0,0.12)';
              color = '#f00';
            }
          }

          return (
            <button
              key={char}
              onClick={() => handleSelect(char)}
              style={{
                height: `${btnH}px`,
                fontSize: `${btnFont}px`,
                background: bg,
                border,
                color,
                borderRadius: '10px',
                cursor: phase === 'QUESTION' ? 'pointer' : 'default',
                fontFamily: '"Inter", "Apple SD Gothic Neo", sans-serif',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.08s, background 0.08s, color 0.08s',
              }}
            >
              {char}
            </button>
          );
        })}
      </div>
    </div>
  );
};

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: '14px 36px', fontSize: '18px',
    background: 'transparent', border: `2px solid ${color}`,
    color, borderRadius: '6px', cursor: 'pointer',
    fontFamily: '"Courier New", monospace', fontWeight: 'bold',
    letterSpacing: '2px',
  };
}

export default DrillContainer;
