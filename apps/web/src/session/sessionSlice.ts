import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SeatCredentials } from '@warewolf/contracts';

/** The caller's seat: which game they are in and the bearer token for it. */
export interface SessionState {
  readonly credentials: SeatCredentials | null;
}

const initialState: SessionState = { credentials: null };

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    /** After create or join. */
    seated(_state, action: PayloadAction<SeatCredentials>) {
      return { credentials: action.payload };
    },
    /** After leaving, being kicked, or a token the server no longer accepts. */
    cleared() {
      return { credentials: null };
    },
    /** Host transfer changes who is host without changing the token. */
    hostChanged(state, action: PayloadAction<boolean>) {
      if (state.credentials) state.credentials.isHost = action.payload;
    },
  },
});

export const { seated, cleared, hostChanged } = sessionSlice.actions;

type WithSession = { session: SessionState };
export const selectCredentials = (state: WithSession) => state.session.credentials;
export const selectToken = (state: WithSession) => state.session.credentials?.token ?? null;
export const selectGameId = (state: WithSession) => state.session.credentials?.gameId ?? null;
