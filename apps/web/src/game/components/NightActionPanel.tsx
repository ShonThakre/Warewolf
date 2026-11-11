import type { TargetRuleDto } from '@warewolf/contracts';
import { Button, TextField } from '@mui/material';
import { useState } from 'react';
import type { ActionPrompt } from '../state/actions';
import { availabilitySentence, promptLabel, questionLabel, shownPrompt } from './actionCopy';

/**
 * The signed-in player's abilities. The role name lives here, not in the
 * discussion rail. Hide collapses it to "Your role" so the phone can be set down.
 */
export function NightActionPanel({
  roleName,
  prompts,
  activeId,
  question,
  hint,
  error,
  onActivate,
  onQuestion,
  onHint,
}: {
  readonly roleName: string | null;
  readonly prompts: readonly ActionPrompt[];
  readonly activeId: string | null;
  readonly question: string | null;
  readonly hint: string;
  readonly error: string | null;
  readonly onActivate: (abilityInstanceId: string) => void;
  readonly onQuestion: (question: string) => void;
  readonly onHint: (hint: string) => void;
}) {
  const [covered, setCovered] = useState(false);
  const visible = prompts.filter(shownPrompt);
  const active = visible.find((prompt) => prompt.abilityInstanceId === activeId) ?? null;
  const questions = active?.ability.target.kind === 'QUESTION' ? active.ability.target.questions : [];
  const textRule = active?.ability.target.kind === 'TEXT' ? active.ability.target : null;
  const showSwitcher = visible.length > 1 || visible.some((prompt) => prompt.availability !== 'OPEN' || prompt.action?.status === 'LOCKED');

  return (
    <div className="ww-night-panel">
      {roleName ? (
        <div className="ww-night-role">
          <p className="ww-status-title">{covered ? 'Your role' : roleName}</p>
          <Button variant="outlined" onClick={() => setCovered((value) => !value)}>
            {covered ? 'Show role' : 'Hide role'}
          </Button>
        </div>
      ) : null}
      {showSwitcher ? (
        <ul className="ww-prompts">
          {visible.map((prompt) => {
            const label = promptLabel(prompt.ability);
            const locked = prompt.action?.status === 'LOCKED';
            const editable = prompt.availability === 'OPEN' && !locked;
            const why = locked ? 'Submitted' : availabilitySentence(prompt.availability);
            return (
              <li key={prompt.abilityInstanceId}>
                {editable ? (
                  <Button variant="outlined" aria-pressed={prompt.abilityInstanceId === active?.abilityInstanceId} onClick={() => onActivate(prompt.abilityInstanceId)}>
                    {label}
                  </Button>
                ) : (
                  <p className="ww-action-copy">
                    {label}
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
      {active?.ability.exclusiveGroup ? <p className="ww-action-copy">This replaces your other choice.</p> : null}
      {questions.length > 0 ? (
        <div className="ww-prompts">
          {questions.map((item) => (
            <Button key={item} variant="outlined" aria-pressed={question === item} onClick={() => onQuestion(item)}>
              {questionLabel(item)}
            </Button>
          ))}
        </div>
      ) : null}
      {repeatNote(active?.ability.target ?? null)}
      {error ? (
        <p className="ww-action-alert" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function repeatNote(rule: TargetRuleDto | null) {
  if (!rule || rule.kind !== 'PLAYERS' || !rule.notSameAsLastRound) return null;
  return <p className="ww-action-copy">Not the same player as last night.</p>;
}
