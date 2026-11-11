import { skipToken } from '@reduxjs/toolkit/query/react';
import type { MyAbilityPrompt, MyActions, MyRole, OwnAbility, SubmitActionResponse } from '@warewolf/contracts';
import type { ActionPayload } from '@warewolf/domain';
import { useCallback, useEffect, useRef } from 'react';
import { useGetMyActionsQuery, useSubmitActionMutation } from '../../api/actions';
import { apiErrorOf, type ApiErrorInfo } from '../../api/api';
import { useSeat } from './lobby';

/**
 * Hooks for the action panel (WEB-07, for WW-604). Screens never fetch
 * actions or pick an Idempotency-Key themselves.
 */

export interface MyActionsView {
  /** Null until loaded, and when the caller has no seat. */
  readonly actions: MyActions | null;
  readonly isLoading: boolean;
  readonly error: ApiErrorInfo | null;
  readonly refetch: () => void;
}

/**
 * The caller's abilities and choices, from GET /me/actions. Pass the
 * `stateVersion` from `useGameState`: availability changes only when the
 * phase does, so the hook refetches when the version moves instead of polling.
 */
export function useMyActions(stateVersion: number | undefined): MyActionsView {
  const seat = useSeat();
  const query = useGetMyActionsQuery(seat?.gameId ?? skipToken, { refetchOnFocus: true });
  const seen = useRef(stateVersion);
  const { refetch } = query;
  useEffect(() => {
    if (stateVersion === undefined || seen.current === stateVersion) return;
    seen.current = stateVersion;
    if (seat) void refetch();
  }, [stateVersion, seat, refetch]);

  return {
    actions: seat ? (query.data ?? null) : null,
    isLoading: query.isLoading,
    error: apiErrorOf(query.error),
    refetch: () => void query.refetch(),
  };
}

/** One row of the action panel: the ability's rules from /me, and its state from /me/actions. */
export interface ActionPrompt extends MyAbilityPrompt {
  readonly ability: OwnAbility;
}

/** The exclusive group on a prompt, when choosing it replaces the player's other choice in that group. */
export function exclusiveGroup(prompt: Pick<ActionPrompt, 'ability'>): string | null {
  return prompt.ability.exclusiveGroup ?? null;
}

/** The payload for one draft. A hint is `{ hint }`. A question is `{ question }`. Anything else sends nothing. */
export function choicePayload(prompt: Pick<ActionPrompt, 'ability'>, draft: { readonly hint?: string; readonly question?: string | null }): ActionPayload {
  const rule = prompt.ability.target;
  if (rule.kind === 'TEXT') return { hint: (draft.hint ?? '').trim() };
  if (rule.kind === 'QUESTION' && draft.question) return { question: draft.question };
  return {};
}

/** Joins GET /me and GET /me/actions by ability instance, in /me's order. Abilities missing from either are left out. */
export function actionPrompts(role: MyRole | null, actions: MyActions | null): ActionPrompt[] {
  if (!role || !actions) return [];
  const byId = new Map(actions.abilities.map((a) => [a.abilityInstanceId, a]));
  return role.abilities.flatMap((ability) => {
    const prompt = byId.get(ability.abilityInstanceId);
    return prompt ? [{ ...prompt, ability }] : [];
  });
}

/**
 * A request key from the platform CSPRNG. `crypto.getRandomValues` also
 * works on plain http, such as a phone on a LAN dev server, where
 * `crypto.randomUUID` does not exist.
 */
export function newIdempotencyKey(fill: (bytes: Uint8Array<ArrayBuffer>) => void = (b) => void crypto.getRandomValues(b)): string {
  const bytes = new Uint8Array(16);
  fill(bytes);
  return `ww-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export interface ActionChoice {
  readonly abilityInstanceId: string;
  readonly targetPlayerIds?: readonly string[];
  readonly payload?: ActionPayload;
}

export interface SubmitActionControl {
  /** Resolves to the stored action, or null when refused. Read `error` for why. */
  readonly submit: (choice: ActionChoice) => Promise<SubmitActionResponse | null>;
  readonly isSubmitting: boolean;
  /** ACTION_TARGET_ILLEGAL carries `issues[0].message`, written for the player. */
  readonly error: ApiErrorInfo | null;
}

/**
 * Submits a choice. The same choice reuses its key, so a retry after a lost
 * response or a double tap replays instead of acting twice. A different
 * choice gets a new key and replaces the pending one on the server.
 */
export function useSubmitAction(): SubmitActionControl {
  const seat = useSeat();
  const [trigger, result] = useSubmitActionMutation();
  const keys = useRef(new Map<string, string>());

  const submit = useCallback(
    async (choice: ActionChoice) => {
      if (!seat) return null;
      const body = { abilityInstanceId: choice.abilityInstanceId, targetPlayerIds: [...(choice.targetPlayerIds ?? [])], payload: { ...(choice.payload ?? {}) } };
      const signature = JSON.stringify([body.abilityInstanceId, body.targetPlayerIds, Object.entries(body.payload).sort()]);
      let key = keys.current.get(signature);
      if (!key) {
        key = newIdempotencyKey();
        keys.current.set(signature, key);
      }
      const outcome = await trigger({ gameId: seat.gameId, idempotencyKey: key, ...body });
      return 'data' in outcome && outcome.data ? outcome.data : null;
    },
    [seat, trigger],
  );

  return { submit, isSubmitting: result.isLoading, error: apiErrorOf(result.error) };
}
