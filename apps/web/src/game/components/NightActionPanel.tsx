import type { TargetRuleDto } from '@warewolf/contracts';
import type { Faction } from '@warewolf/domain';
import { Button, TextField } from '@mui/material';
import { useState } from 'react';
import type { ActionPrompt } from '../state/actions';
import { availabilitySentence, exclusiveNote, promptLabel, questionLabel, shownPrompt } from './actionCopy';
import { RolePortrait } from './RolePortrait';

/**
 * The signed-in player's abilities. The role name lives here, not in the
 * discussion rail. Hide collapses it to "Your role" so the phone can be set down.
 */
export function NightActionPanel({
  roleName,
  roleId,
  faction,
  prompts,
  activeId,
  question,
  hint,
  error,
  attackLine,
  identityLine = null,
  onActivate,
  onQuestion,
  onHint,
  part = 'all',
  covered: coveredProp,
  onToggleCover,
}: {
  readonly roleName: string | null;
  /** Private portrait. Omitted when the role has not loaded. Hidden with the name. */
  readonly roleId?: string | null;
  readonly faction?: Faction | null;
  readonly prompts: readonly ActionPrompt[];
  readonly activeId: string | null;
  readonly question: string | null;
  readonly hint: string;
  readonly error: string | null;
  /** The informed Doctor's attack line. Null for every other seat. */
  readonly attackLine?: string | null;
  /** Night identity strip: the open ability sentence under the role name. */
  readonly identityLine?: string | null;
  readonly onActivate: (abilityInstanceId: string) => void;
  readonly onQuestion: (question: string) => void;
  readonly onHint: (hint: string) => void;
  /** Night splits the name into the action bar and the controls onto the stage. */
  readonly part?: 'all' | 'identity' | 'controls';
  readonly covered?: boolean;
  readonly onToggleCover?: (covered: boolean) => void;
}) {
  const [localCovered, setLocalCovered] = useState(false);
  const covered = coveredProp ?? localCovered;
  function toggleCover() {
    const next = !covered;
    if (onToggleCover) onToggleCover(next);
    else setLocalCovered(next);
  }
  const visible = prompts.filter(shownPrompt);
  const active = visible.find((prompt) => prompt.abilityInstanceId === activeId) ?? null;
  const questions = active?.ability.target.kind === 'QUESTION' ? active.ability.target.questions : [];
  const textRule = active?.ability.target.kind === 'TEXT' ? active.ability.target : null;
  const showSwitcher = visible.length > 1 || visible.some((prompt) => prompt.availability !== 'OPEN' || prompt.action?.status === 'LOCKED');

  return (
    <div className="ww-night-panel">
      {part !== 'controls' && roleName ? (
        <div className="ww-night-role">
          {roleId && faction && !covered ? (
            <RolePortrait roleId={roleId} name={roleName} faction={faction} size="thumb" loading="eager" />
          ) : null}
          <div className="ww-night-role-copy">
            <p className="ww-status-title">{covered ? 'Your role' : roleName}</p>
            {!covered && identityLine ? <p className="ww-night-role-line">{identityLine}</p> : null}
          </div>
          <Button className="ww-night-hide" variant="text" onClick={toggleCover}>
            {covered ? 'Show role' : 'Hide role'}
          </Button>
        </div>
      ) : null}
      {part === 'identity' ? null : (
        <>
      {showSwitcher ? (
        <ul className="ww-prompts">
          {visible.map((prompt) => {
            const sentence = promptLabel(prompt.ability);
            const locked = prompt.action?.status === 'LOCKED';
            const editable = prompt.availability === 'OPEN' && !locked;
            const why = locked ? 'Submitted' : availabilitySentence(prompt.availability);
            return (
              <li key={prompt.abilityInstanceId}>
                {editable ? (
                  <Button variant="outlined" aria-pressed={prompt.abilityInstanceId === active?.abilityInstanceId} onClick={() => onActivate(prompt.abilityInstanceId)}>
                    {sentence}
                  </Button>
                ) : (
                  <p className="ww-action-copy">
                    {sentence}
                    {why ? `. ${why}` : ''}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {textRule ? (
        <TextField
          label="Hint"
          value={hint}
          onChange={(event) => onHint(event.target.value)}
          helperText="1 to 140 characters. Do not name a player or a seat."
          slotProps={{ htmlInput: { maxLength: textRule.maxLength, 'aria-label': 'Hint' } }}
        />
      ) : null}
      {exclusiveNote(active?.ability.exclusiveGroup) ? <p className="ww-action-copy">{exclusiveNote(active?.ability.exclusiveGroup)}</p> : null}
      {questions.length > 0 ? (
        <div className="ww-prompts">
          {questions.map((item) => (
            <Button key={item} variant="outlined" aria-pressed={question === item} onClick={() => onQuestion(item)}>
              {questionLabel(item)}
            </Button>
          ))}
        </div>
      ) : null}
      {attackLine ? <p className="ww-action-copy">{attackLine}</p> : null}
      {repeatNote(active?.ability.target ?? null)}
      {error ? (
        <p className="ww-action-alert" role="alert">
          {error}
        </p>
      ) : null}
        </>
      )}
    </div>
  );
}

function repeatNote(rule: TargetRuleDto | null) {
  if (!rule || rule.kind !== 'PLAYERS' || !rule.notSameAsLastRound) return null;
  return <p className="ww-action-copy">Not the same player as last night.</p>;
}
