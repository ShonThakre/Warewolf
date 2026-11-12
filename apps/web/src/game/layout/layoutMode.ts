/**
 * Layout mode is a function of the viewport, not of a device name
 * (docs/werewolf/ui-ux-plan.md, section 3). This module is the one place the
 * breakpoints live. `GameLayout` puts the mode on its root as `data-layout`,
 * and the stylesheet keys its grid templates off that attribute, so the
 * CSS and the tests can never disagree about which mode a viewport is in.
 */

export const LAYOUT_MODES = ['full', 'compact', 'tablet', 'phone-landscape', 'narrow-landscape', 'portrait'] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

/** Phone viewports that use compact session chrome instead of marketing nav. */
export const PHONE_LAYOUT_MODES = ['portrait', 'phone-landscape', 'narrow-landscape'] as const satisfies readonly LayoutMode[];

/** Height at which the status line gets its own row instead of sharing the top bar. */
export const TALL_HEIGHT = 700;

/** True when the shell should hide Play / How to Play / Roles and use session chrome. */
export function isPhoneLayout(mode: LayoutMode): boolean {
  return (PHONE_LAYOUT_MODES as readonly LayoutMode[]).includes(mode);
}

/**
 * The six modes of section 3, checked in the table's order:
 *
 * | Mode | Condition |
 * |---|---|
 * | `full` | width ≥ 1440 and height ≥ 800 |
 * | `compact` | width ≥ 1024 and height ≥ 700 |
 * | `tablet` | landscape, height ≥ 500, width ≥ 768 |
 * | `phone-landscape` | landscape, width ≥ 600, height < 700 |
 * | `narrow-landscape` | landscape, width < 600 |
 * | `portrait` | portrait, width < 768 |
 *
 * Landscape means wider than tall, as in CSS; a square viewport is portrait.
 * The table leaves two gaps, both filled with `tablet`, the three-area mode
 * with the narrowest regular rail:
 * - portrait from 768 to 1023 wide, such as a 768×1024 tablet held upright;
 * - landscape from 600 to 767 wide and at least 700 tall, a near-square window.
 */
export function layoutMode(width: number, height: number): LayoutMode {
  const landscape = width > height;
  if (width >= 1440 && height >= 800) return 'full';
  if (width >= 1024 && height >= TALL_HEIGHT) return 'compact';
  if (!landscape) return width < 768 ? 'portrait' : 'tablet';
  if (width < 600) return 'narrow-landscape';
  if (width >= 768 && height >= 500) return 'tablet';
  if (height < TALL_HEIGHT) return 'phone-landscape';
  return 'tablet';
}

/** What `GameLayout` and screens need to know about the current viewport. */
export interface LayoutInfo {
  readonly mode: LayoutMode;
  readonly width: number;
  readonly height: number;
  /** Wider than tall, as CSS `orientation: landscape`. */
  readonly landscape: boolean;
  /**
   * The status line has its own row under the top bar. False when the
   * height is under 700 or in portrait, where it shares one bar.
   */
  readonly statusRow: boolean;
  /** Narrow landscape only: the rail is a button until opened, then overlays the stage. */
  readonly railCollapsible: boolean;
  /** Portrait only: the stacked template, with a Players / rail switch under the scene. */
  readonly stacked: boolean;
}

export function layoutInfo(width: number, height: number): LayoutInfo {
  const mode = layoutMode(width, height);
  return {
    mode,
    width,
    height,
    landscape: width > height,
    statusRow: mode !== 'portrait' && height >= TALL_HEIGHT,
    railCollapsible: mode === 'narrow-landscape',
    stacked: mode === 'portrait',
  };
}
