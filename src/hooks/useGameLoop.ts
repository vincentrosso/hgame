import { useEffect, useRef } from 'react';

export const useGameLoop = (callback: (delta: number) => void) => {
  const requestRef = useRef<number>(0);
  const previousTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      // Cap delta time to avoid huge jumps after tab switching
      callbackRef.current(Math.min(deltaTime, 100));
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};
