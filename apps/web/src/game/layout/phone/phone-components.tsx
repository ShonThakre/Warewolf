import type { ReactNode } from 'react';
import './phone-components.css';

export interface PhoneSurfaceProps {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  as?: 'div' | 'section' | 'article';
}

/** Card surface for setup summary, result facts, and host overview rows. */
export function PhoneSurface({ children, className, raised = false, as: Tag = 'div' }: PhoneSurfaceProps) {
  const classes = ['ww-phone-surface', className].filter(Boolean).join(' ');
  return (
    <Tag className={classes} data-raised={raised ? 'true' : undefined}>
      {children}
    </Tag>
  );
}

export interface PhoneActionDockProps {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
  labelledBy?: string;
}

/** Sticky-safe wrapper for existing primary/secondary actions. Does not own phase state. */
export function PhoneActionDock({ children, className, sticky = true, labelledBy }: PhoneActionDockProps) {
  const classes = ['ww-phone-action-dock', className].filter(Boolean).join(' ');
  return (
    <div className={classes} data-sticky={sticky ? 'true' : undefined} role="region" aria-labelledby={labelledBy}>
      {children}
    </div>
  );
}

export interface PhonePlayerIdentityProps {
  avatar: ReactNode;
  name: ReactNode;
  meta?: ReactNode;
  className?: string;
}

/** Spacing rules around an existing PlayerAvatar plus public labels. */
export function PhonePlayerIdentity({ avatar, name, meta, className }: PhonePlayerIdentityProps) {
  const classes = ['ww-phone-identity', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {avatar}
      <div className="ww-phone-identity-copy">
        <p className="ww-phone-identity-name">{name}</p>
        {meta != null ? <p className="ww-phone-identity-meta">{meta}</p> : null}
      </div>
    </div>
  );
}

export interface PhoneStatusPillProps {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'accent' | 'village' | 'wolf';
  icon?: ReactNode;
}

/** Compact phase / presence pill. Copy must stay explicit; color is reinforcement only. */
export function PhoneStatusPill({ children, className, tone = 'default', icon }: PhoneStatusPillProps) {
  const classes = ['ww-phone-status-pill', className].filter(Boolean).join(' ');
  return (
    <span className={classes} data-tone={tone === 'default' ? undefined : tone}>
      {icon}
      {children}
    </span>
  );
}

export interface PhoneSectionSwitchProps {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}

/** Visual shell for an existing section/tab control row. */
export function PhoneSectionSwitch({ children, className, labelledBy }: PhoneSectionSwitchProps) {
  const classes = ['ww-phone-section-switch', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="group" aria-labelledby={labelledBy}>
      {children}
    </div>
  );
}
