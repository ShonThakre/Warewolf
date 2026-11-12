import { describe, expect, it } from 'vitest';
import { chatMessageSchema, chatViewSchema, postChatMessageRequestSchema } from '../src/index.js';

const ID = '0f4c6d1e-8b1a-4b7e-9c2a-1d2e3f4a5b6c';
const OTHER = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

describe('post chat message request', () => {
  it('stores the trimmed text', () => {
    expect(postChatMessageRequestSchema.parse({ body: '  Rafi was quiet last night.  ' })).toEqual({ body: 'Rafi was quiet last night.' });
  });

  it('refuses blank text, more than 280 characters, and extra fields', () => {
    expect(postChatMessageRequestSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(postChatMessageRequestSchema.safeParse({ body: 'a'.repeat(281) }).success).toBe(false);
    expect(postChatMessageRequestSchema.safeParse({ body: 'a'.repeat(280) }).success).toBe(true);
    expect(postChatMessageRequestSchema.safeParse({ body: '🐺'.repeat(280) }).success).toBe(true);
    expect(postChatMessageRequestSchema.safeParse({ body: 'hi', channel: 'wolves' }).success).toBe(false);
    expect(postChatMessageRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('chat view', () => {
  it('carries messages, mutes, and the caller’s own posting state', () => {
    const message = { messageId: ID, seq: 3, playerId: OTHER, body: 'hi', roundNumber: 1, phase: 'DAY_DISCUSSION', createdAt: '2026-11-11T10:00:00.000Z' };
    expect(chatMessageSchema.parse(message)).toEqual(message);
    const view = { messages: [message], mutedPlayerIds: [OTHER], you: { canPost: false, refusal: 'DEAD' } };
    expect(chatViewSchema.parse(view)).toEqual(view);
  });

  it('never carries a message from a closed phase', () => {
    const night = { messageId: ID, seq: 1, playerId: OTHER, body: 'hi', roundNumber: 1, phase: 'NIGHT_SUBMIT', createdAt: '2026-11-11T10:00:00.000Z' };
    expect(chatMessageSchema.safeParse(night).success).toBe(false);
  });
});
