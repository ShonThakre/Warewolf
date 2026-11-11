import { useMemo, useSyncExternalStore } from 'react';
import { layoutInfo, type LayoutInfo } from './layoutMode';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

// A string snapshot is stable between renders, so React only re-renders when the size changes.
const viewportKey = () => `${window.innerWidth}x${window.innerHeight}`;
const SERVER_KEY = '1440x900';

/**
 * The layout of the current viewport. Updates on resize and rotation. Read
 * synchronously on the first render, so the first paint already has the
 * right mode.
 */
export function useLayoutMode(): LayoutInfo {
  const key = useSyncExternalStore(subscribe, viewportKey, () => SERVER_KEY);
  return useMemo(() => {
    const [width, height] = key.split('x').map(Number) as [number, number];
    return layoutInfo(width, height);
  }, [key]);
}
