import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionPrompt } from '../state/actions';

/**
 * The player's draft for each ability. A stored choice fills an empty draft
 * once. Later edits stay local until Submit, so a refetch cannot wipe a
 * change the player just made.
 */
export function useActionDraft(prompts: readonly ActionPrompt[]) {
  const [selected, setSelected] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [questions, setQuestions] = useState<Readonly<Record<string, string>>>({});
  const [hints, setHints] = useState<Readonly<Record<string, string>>>({});
  const seeded = useRef(new Set<string>());
  const promptsRef = useRef(prompts);
  promptsRef.current = prompts;
  const signature = prompts
    .map((prompt) => `${prompt.abilityInstanceId}:${prompt.action?.status ?? ''}:${prompt.action?.targetPlayerIds.join('.') ?? ''}:${String(prompt.action?.payload['question'] ?? '')}:${String(prompt.action?.payload['hint'] ?? '')}`)
    .join('|');

  useEffect(() => {
    for (const prompt of promptsRef.current) {
      const id = prompt.abilityInstanceId;
      if (!prompt.action || seeded.current.has(id)) continue;
      seeded.current.add(id);
      const targets = prompt.action.targetPlayerIds;
      const question = prompt.action.payload['question'];
      const hint = prompt.action.payload['hint'];
      setSelected((current) => ((current[id]?.length ?? 0) > 0 ? current : { ...current, [id]: targets }));
      if (typeof question === 'string') {
        setQuestions((current) => (current[id] ? current : { ...current, [id]: question }));
      }
      if (typeof hint === 'string') {
        setHints((current) => (current[id] ? current : { ...current, [id]: hint }));
      }
    }
  }, [signature]);

  const toggle = useCallback((id: string, playerId: string, count: number) => {
    setSelected((current) => {
      const list = current[id] ?? [];
      if (list.includes(playerId)) return { ...current, [id]: list.filter((item) => item !== playerId) };
      if (count <= 1) return { ...current, [id]: [playerId] };
      if (list.length >= count) return current;
      return { ...current, [id]: [...list, playerId] };
    });
  }, []);

  const chooseQuestion = useCallback((id: string, question: string) => {
    setQuestions((current) => ({ ...current, [id]: question }));
  }, []);

  const setHint = useCallback((id: string, hint: string) => {
    setHints((current) => ({ ...current, [id]: hint }));
  }, []);

  return { selected, questions, hints, toggle, chooseQuestion, setHint };
}
