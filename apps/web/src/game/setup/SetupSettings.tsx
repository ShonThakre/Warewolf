import type { GameConfiguration } from '@warewolf/domain';
import { BLOCKING_DECISIONS, DEFAULT_CATALOG, KILL_AGGREGATIONS, requiredAcknowledgments } from '@warewolf/domain';
import { Button, FormControlLabel, MenuItem, Radio, RadioGroup, Switch, TextField } from '@mui/material';
import { ACK_LABEL, alphaWolfHint, INLINE_DECISIONS, KILL_LABEL, lockedModeCopy, NIGHT_TOGGLE_LABEL, SURVIVAL_CHOICES, SURVIVAL_QUESTION } from './setupCopy';
import {
  modeLocked,
  roleCount,
  seatAlphaWolf,
  setAcknowledgement,
  setFriendlyFire,
  setInfectionAnnouncement,
  setInfectionEnabled,
  setInfectionSuccesses,
  setKillAggregation,
  setKnowsTeammates,
  setNightToggle,
  setPacing,
  setRequiresSurvival,
  setReveal,
  setRoundCap,
  setTimer,
  setVotingFlag,
  setWolfCap,
} from './setupDraft';

export function SetupSettings({
  draft,
  editable,
  onDraft,
}: {
  draft: GameConfiguration;
  editable: boolean;
  onDraft: (next: GameConfiguration) => void;
}) {
  const locked = modeLocked(draft);
  const lockedCopy = lockedModeCopy(draft.mode);
  const disabled = !editable || locked;
  const needed = requiredAcknowledgments(draft, DEFAULT_CATALOG);
  const alphaHint = draft.infection.enabled && roleCount(draft, 'alpha_wolf') === 0 ? alphaWolfHint(roleCount(draft, 'normal_villager') > 0) : null;

  return (
    <div className="ww-setup-fields">
      {lockedCopy ? <p className="ww-setup-copy">{lockedCopy}</p> : null}
      <TextField select label="Pace" value={draft.pacing} disabled={disabled} onChange={(event) => onDraft(setPacing(draft, event.target.value as GameConfiguration['pacing']))}>
        <MenuItem value="HOST">The host advances each phase</MenuItem>
        <MenuItem value="TIMED">Timers advance each phase</MenuItem>
      </TextField>
      {draft.pacing === 'TIMED' && draft.timers ? (
        <>
          <TimerField label="Night seconds" value={draft.timers.nightSeconds} disabled={disabled} onChange={(value) => onDraft(setTimer(draft, 'nightSeconds', value))} />
          <TimerField label="Day seconds" value={draft.timers.daySeconds} disabled={disabled} onChange={(value) => onDraft(setTimer(draft, 'daySeconds', value))} />
          <TimerField label="Vote seconds" value={draft.timers.voteSeconds} disabled={disabled} onChange={(value) => onDraft(setTimer(draft, 'voteSeconds', value))} />
        </>
      ) : null}
      <TimerField label="Round limit" value={draft.roundCap} disabled={disabled} onChange={(value) => onDraft(setRoundCap(draft, value))} />
      <TimerField
        label="Wolf cap"
        value={draft.teams.wolfCap}
        disabled={disabled}
        helper="At least the number of wolves dealt at the start. A higher cap leaves room for a later conversion."
        onChange={(value) => onDraft(setWolfCap(draft, value))}
      />
      <Flag label="Wolves know each other" checked={draft.wolves.knowsTeammates} disabled={disabled} onChange={(value) => onDraft(setKnowsTeammates(draft, value))} />
      <Flag label="Friendly fire" checked={draft.wolves.friendlyFire} disabled={disabled} onChange={(value) => onDraft(setFriendlyFire(draft, value))} />
      <TextField
        select
        label="How a wolf kill is chosen"
        value={draft.wolves.killAggregation}
        disabled={disabled}
        onChange={(event) => onDraft(setKillAggregation(draft, event.target.value as GameConfiguration['wolves']['killAggregation']))}
      >
        {KILL_AGGREGATIONS.map((option) => (
          <MenuItem key={option} value={option}>
            {KILL_LABEL[option]}
          </MenuItem>
        ))}
      </TextField>
      <Flag label="Infection" checked={draft.infection.enabled} disabled={disabled} onChange={(value) => onDraft(setInfectionEnabled(draft, value))} />
      {draft.infection.enabled ? (
        <>
          <TextField
            select
            label="Infection announcement"
            value={draft.infection.announcement}
            disabled={disabled}
            onChange={(event) => onDraft(setInfectionAnnouncement(draft, event.target.value as GameConfiguration['infection']['announcement']))}
          >
            <MenuItem value="SILENT">Silent. Only the converted player learns it</MenuItem>
            <MenuItem value="PUBLIC">The table is told</MenuItem>
          </TextField>
          <TimerField label="Infection successes" value={draft.infection.maxSuccesses} disabled={disabled} onChange={(value) => onDraft(setInfectionSuccesses(draft, value))} />
          <fieldset className="ww-setup-choice">
            <legend className="ww-setup-choice-title">{SURVIVAL_QUESTION}</legend>
            <RadioGroup
              value={draft.infection.requiresSurvival ? 'SURVIVAL_REQUIRED' : 'CONVERT_BEFORE_DEATH'}
              onChange={(event) => onDraft(setRequiresSurvival(draft, event.target.value === 'SURVIVAL_REQUIRED'))}
            >
              {SURVIVAL_CHOICES.map((choice) => (
                <FormControlLabel
                  key={choice.value}
                  value={choice.value}
                  disabled={disabled}
                  control={<Radio />}
                  label={
                    <span className="ww-setup-choice-label">
                      {choice.label}
                      {choice.note ? <span className="ww-setup-choice-note">{choice.note}</span> : null}
                    </span>
                  }
                />
              ))}
            </RadioGroup>
          </fieldset>
          {alphaHint ? (
            <div className="ww-setup-hint" role="note">
              <p className="ww-setup-copy">{alphaHint.text}</p>
              {editable && !locked ? (
                <Button variant="outlined" onClick={() => onDraft(seatAlphaWolf(draft))}>
                  {alphaHint.action}
                </Button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
      <Flag label="Day vote" checked={draft.voting.enabled} disabled={disabled} onChange={(value) => onDraft(setVotingFlag(draft, 'enabled', value))} />
      <Flag label="Players may abstain" checked={draft.voting.abstain} disabled={disabled} onChange={(value) => onDraft(setVotingFlag(draft, 'abstain', value))} />
      <Flag label="A vote can change until the poll closes" checked={draft.voting.changeUntilClose} disabled={disabled} onChange={(value) => onDraft(setVotingFlag(draft, 'changeUntilClose', value))} />
      <Flag label="Eliminated players may vote" checked={draft.voting.deadMayVote} disabled={disabled} onChange={(value) => onDraft(setVotingFlag(draft, 'deadMayVote', value))} />
      <TextField
        select
        label="Reveal after a day elimination"
        value={draft.voting.revealOnDayElimination}
        disabled={disabled}
        onChange={(event) => onDraft(setReveal(draft, 'revealOnDayElimination', event.target.value as GameConfiguration['voting']['revealOnDayElimination']))}
      >
        <MenuItem value="CURRENT_ROLE">Show the current role</MenuItem>
        <MenuItem value="HIDDEN">Keep it hidden</MenuItem>
      </TextField>
      <TextField
        select
        label="Reveal after a night death"
        value={draft.voting.revealOnNightDeath}
        disabled={disabled}
        onChange={(event) => onDraft(setReveal(draft, 'revealOnNightDeath', event.target.value as GameConfiguration['voting']['revealOnNightDeath']))}
      >
        <MenuItem value="CURRENT_ROLE">Show the current role</MenuItem>
        <MenuItem value="HIDDEN">Keep it hidden</MenuItem>
      </TextField>
      {(Object.keys(NIGHT_TOGGLE_LABEL) as (keyof typeof NIGHT_TOGGLE_LABEL)[]).map((key) => (
        <Flag key={key} label={NIGHT_TOGGLE_LABEL[key]} checked={draft.night.toggles[key]} disabled={disabled} onChange={(value) => onDraft(setNightToggle(draft, key, value))} />
      ))}
      {BLOCKING_DECISIONS.filter((decision) => decision.id in needed && !INLINE_DECISIONS.includes(decision.id)).map((decision) => (
        <TextField
          key={decision.id}
          select
          label={decision.title}
          value={draft.rulesetAcknowledgments[decision.id] ?? ''}
          disabled={disabled}
          helperText={`${decision.id}. Start needs this acknowledgement to match the setup.`}
          onChange={(event) => onDraft(setAcknowledgement(draft, decision.id, event.target.value))}
        >
          {decision.options.map((option) => (
            <MenuItem key={option} value={option}>
              {ACK_LABEL[option] ?? option}
            </MenuItem>
          ))}
        </TextField>
      ))}
    </div>
  );
}

function Flag({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="ww-setup-field">
      <Switch checked={checked} disabled={disabled} onChange={(_event, value) => onChange(value)} />
      {label}
    </label>
  );
}

function TimerField({
  label,
  value,
  disabled,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  helper?: string;
  onChange: (value: number) => void;
}) {
  return (
    <TextField
      className="ww-setup-number"
      label={label}
      type="number"
      value={value}
      disabled={disabled}
      helperText={helper}
      onChange={(event) => onChange(Number(event.target.value))}
      slotProps={{ htmlInput: { min: 0 } }}
    />
  );
}
