import type { LayoutMode } from './layoutMode';

/**
 * The priority viewports from docs/werewolf/ui-ux-plan.md, section 12, with
 * the mode each must get. Unit tests check `layoutMode` against this list,
 * and the Playwright projects (WEB-05) can be generated from it.
 */
export interface PriorityViewport {
  /** Playwright project name. */
  readonly project: string;
  readonly width: number;
  readonly height: number;
  readonly mode: LayoutMode;
}

export const PRIORITY_VIEWPORTS: readonly PriorityViewport[] = [
  { project: 'desktop-fhd', width: 1920, height: 1080, mode: 'full' },
  { project: 'desktop-wide', width: 1440, height: 900, mode: 'full' },
  { project: 'tablet-land', width: 1024, height: 768, mode: 'compact' },
  { project: 'phone-land-lg', width: 915, height: 412, mode: 'phone-landscape' },
  { project: 'phone-land', width: 844, height: 390, mode: 'phone-landscape' },
  { project: 'phone-land-sm', width: 667, height: 375, mode: 'phone-landscape' },
  { project: 'phone-portrait', width: 390, height: 844, mode: 'portrait' },
];

/** The collapsed-rail check, run inside `phone-land-sm` with `setViewportSize`. */
export const NARROW_LANDSCAPE_CHECK: PriorityViewport = { project: 'phone-land-sm', width: 568, height: 320, mode: 'narrow-landscape' };
