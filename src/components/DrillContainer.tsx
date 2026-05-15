import React, { useState, useEffect, useRef } from 'react';
import { PhonemePlayer } from '../engine/PhonemePlayer';
import { SoundEngine } from '../engine/SoundEngine';
import { CONSONANTS, VOWELS } from '../engine/koreanChars';

type DrillPhase = 'COUNTDOWN' | 'QUESTION' | 'FEEDBACK' | 'RESULTS';

interface Question {
  target: string;
  choices: string[];
}

const SESSION_SECONDS = 60;
const FEEDBACK_MS = 700;
const POOL_EXPAND_AT = 10;

function makeQuestion(pool: string[], exclude?: string): Question {
  const candidates = exclude ? pool.filter(c => c !== exclude) : pool;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const others = pool.filter(c => c !== target);
  const distractors: string[] = [];
  const used = new Set<string>([target]);
  while (distractors.length < Math.min(3, others.length)) {
    const pick = others[Math.floor(Math.random() * others.length)];
    if (!used.has(pick)) { used.add(pick); distractors.push(pick); }
  }
  return { target, choices: [target, ...distractors].sort(() => Math.random() - 0.5) };
}

const DrillContainer: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [phase, setPhase] = useState<DrillPhase>('COUNTDOWN');
  const [countdown, setCountdown] = useState(3);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SESSION_SECONDS);
  const [timerRunning, setTimerRunning] = useState(false);

  const phoneme = useRef(new PhonemePlayer());
  const lastTargetRef = useRef<string | undefined>(undefined);
  const correctRef = useRef(0);
  const timeLeftRef = useRef(SESSION_SECONDS);

  const getPool = () =>
    correctRef.current >= POOL_EXPAND_AT ? [...CONSONANTS, ...VOWELS] : VOWELS;

  const multiplier = streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
  const poolLabel = correct >= POOL_EXPAND_AT ? 'ALL' : 'VOWELS';
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Keep timeLeftRef in sync so FEEDBACK timeout can read it without stale closure
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Countdown phase
  useEffect(() => {
    if (phase !== 'COUNTDOWN') return;
    if (countdown <= 0) {
      const q = makeQuestion(getPool());
      lastTargetRef.current = q.target;
      setQuestion(q);
      setPhase('QUESTION');
      setTimerRunning(true);
      setTimeout(() => phoneme.current.play(q.target), 80);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Session timer — only re-registers when timerRunning flips
  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [timerRunning]);

  // Time's up
  useEffect(() => {
    if (timeLeft === 0 && timerRunning) {
      setTimerRunning(false);
      setPhase('RESULTS');
    }
  }, [timeLeft, timerRunning]);

  // Feedback → next question
  useEffect(() => {
    if (phase !== 'FEEDBACK') return;
    const t = setTimeout(() => {
      if (timeLeftRef.current > 0) {
        const q = makeQuestion(getPool(), lastTargetRef.current);
        lastTargetRef.current = q.target;
        setQuestion(q);
        setSelected(null);
        setPhase('QUESTION');
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

  const handleRestart = () => {
    correctRef.current = 0;
    timeLeftRef.current = SESSION_SECONDS;
    lastTargetRef.current = undefined;
    setPhase('COUNTDOWN');
    setCountdown(3);
    setQuestion(null);
    setSelected(null);
    setScore(0);
    setCorrect(0);
    setTotal(0);
    setStreak(0);
    setTimeLeft(SESSION_SECONDS);
    setTimerRunning(false);
  };

  // ── Styles ──────────────────────────────────────────────────────────────

  const root: React.CSSProperties = {
    width: '100vw', height: '100vh',
    background: '#000', color: '#fff',
    fontFamily: '"Courier New", monospace',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', userSelect: 'none',
  };

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

      {/* 2×2 choice grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '320px' }}>
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
                height: '130px',
                fontSize: '68px',
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
