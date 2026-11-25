import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SeatCredentials } from '@warewolf/contracts';

/** ID-01: why the server closed this seat's connection. */
export type RevokedReason = 'SEAT_RECLAIMED' | 'KICKED';

/** The caller's seat: which game they are in and the bearer token for it. */
export interface SessionState {
  readonly credentials: SeatCredentials | null;
  /** Set when the seat was taken over on another device, or removed. The UI explains it once. */
  readonly revoked?: RevokedReason | null;
}

const initialState: SessionState = { credentials: null, revoked: null };

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /** After create, join, or rejoin. */
    seated(_state, action: PayloadAction<SeatCredentials>) {
      return { credentials: action.payload, revoked: null };
    },
    /** After leaving, being kicked, or a token the server no longer accepts. */
    cleared(state) {
      return { credentials: null, revoked: state.revoked ?? null };
    },
    /** ID-01: the server closed this seat's sockets. The seat is gone from this device. */
    revoked(_state, action: PayloadAction<RevokedReason>) {
      return { credentials: null, revoked: action.payload };
    },
    /** The notice was read. */
    revokedSeen(state) {
      state.revoked = null;
    },
    /** Host transfer changes who is host without changing the token. */
    hostChanged(state, action: PayloadAction<boolean>) {
      if (state.credentials) state.credentials.isHost = action.payload;
    },
    /** ID-01: a new rejoin code for the current seat. */
    rejoinCodeChanged(state, action: PayloadAction<string>) {
      if (state.credentials) state.credentials.rejoinCode = action.payload;
    },
  },
});

export const { seated, cleared, revoked, revokedSeen, hostChanged, rejoinCodeChanged } = sessionSlice.actions;

type WithSession = { session: SessionState };
export const selectCredentials = (state: WithSession) => state.session.credentials;
export const selectToken = (state: WithSession) => state.session.credentials?.token ?? null;
export const selectGameId = (state: WithSession) => state.session.credentials?.gameId ?? null;
export const selectRevoked = (state: WithSession) => state.session.revoked ?? null;
