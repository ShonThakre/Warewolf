import type { ChatMessage } from '@warewolf/contracts';
import type { ChatRefusal, GamePhase } from '@warewolf/domain';
import { Button, TextField } from '@mui/material';
import { PlayerAvatar } from './PlayerAvatar';
import { chatRefusalCopy, chatRemainingCopy, chatSeatName } from './chatCopy';
import { revoteDiscussionNotice } from './voteCopy';

type Seat = { readonly playerId: string; readonly displayName: string; readonly avatarId: number | null; readonly lifeStatus: string };

/**
 * The discussion rail's live channel (WW-1206). Messages carry a seat and
 * text. This panel does not add a role or a team, and the results recap does
 * not mount it.
 */
export function DiscussionPanel({
  players,
  youId,
  messages,
  mutedPlayerIds,
  canPost,
  refusal,
  phase,
  isLoading,
  loadError,
  draft,
  remaining,
  sendable,
  sending,
  sendError,
  onDraft,
  onSend,
  moderation,
}: {
  readonly players: readonly Seat[];
  readonly youId: string;
  readonly messages: readonly ChatMessage[];
  readonly mutedPlayerIds: readonly string[];
  readonly canPost: boolean;
  readonly refusal: ChatRefusal | null;
  /** Used so morning closed copy differs from night. */
  readonly phase?: GamePhase | null;
  readonly isLoading: boolean;
  readonly loadError: string | null;
  readonly draft: string;
  readonly remaining: number;
  readonly sendable: boolean;
  readonly sending: boolean;
  readonly sendError: string | null;
  readonly onDraft: (text: string) => void;
  readonly onSend: () => void;
  readonly moderation: {
    readonly isWorking: boolean;
    readonly error: string | null;
    readonly onDelete: (messageId: string) => void;
    readonly onMute: (playerId: string) => void;
    readonly onUnmute: (playerId: string) => void;
  } | null;
}) {
  const closed = chatRefusalCopy(canPost ? null : refusal, phase);
  const channelClosed = !canPost && refusal === 'CLOSED';
  const morningClosed = channelClosed && phase === 'DAY_ANNOUNCE';
  const helper = canPost ? chatRemainingCopy(remaining) : channelClosed ? null : (closed ?? (isLoading ? 'Opening chat…' : null));

  const dayOpen = phase === 'DAY_DISCUSSION' || phase === 'VOTING' || phase === 'REVOTE';
  const revoteNotice = phase === 'REVOTE' ? revoteDiscussionNotice() : null;

  return (
    <div className="ww-discussion" data-closed={channelClosed ? 'true' : undefined} data-morning={morningClosed ? 'true' : undefined} data-live={dayOpen && !channelClosed ? 'true' : undefined} data-revote={revoteNotice ? 'true' : undefined}>
      <h2 className="ww-discussion-title">
        <span className="ww-discussion-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2.1-5.1A8.5 8.5 0 1 1 21 11.5Z" />
          </svg>
        </span>
        Discussion
      </h2>
      {revoteNotice ? (
        <div className="ww-discussion-notice" role="status">
          <span className="ww-discussion-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2.1-5.1A8.5 8.5 0 1 1 21 11.5Z" />
            </svg>
          </span>
          <div className="ww-discussion-notice-copy">
            <p className="ww-discussion-notice-title">{revoteNotice.title}</p>
            <p className="ww-discussion-notice-body">{revoteNotice.body}</p>
          </div>
        </div>
      ) : null}
      {channelClosed && closed ? (
        <div className="ww-discussion-closed" role="status">
          {morningClosed ? (
            <span className="ww-discussion-lock" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </span>
          ) : (
            <span className="ww-discussion-closed-mark" aria-hidden="true">
              i
            </span>
          )}
          <p className="ww-discussion-closed-copy">{closed}</p>
        </div>
      ) : null}
      <ul className="ww-discussion-log" aria-label="Messages">
        {messages.length === 0 && !channelClosed ? <li className="ww-log-empty">{isLoading ? 'Opening chat…' : 'No messages yet.'}</li> : null}
        {messages.map((message) => {
          const seat = players.find((player) => player.playerId === message.playerId);
          const name = chatSeatName(players, message.playerId);
          const muted = mutedPlayerIds.includes(message.playerId);
          return (
            <li key={message.messageId} className="ww-chat-message">
              <PlayerAvatar name={name} size="nav" avatarId={seat?.avatarId ?? null} dead={seat?.lifeStatus === 'DEAD'} />
              <div className="ww-chat-main">
                <p className="ww-chat-name">
                  {name}
                  {muted ? <span className="ww-chat-muted"> Muted</span> : null}
                </p>
                <p className="ww-chat-body">{message.body}</p>
                {moderation ? (
                  <div className="ww-chat-tools">
                    <Button variant="outlined" size="small" disabled={moderation.isWorking} onClick={() => moderation.onDelete(message.messageId)}>
                      Delete
                    </Button>
                    {message.playerId !== youId ? (
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={moderation.isWorking}
                        onClick={() => (muted ? moderation.onUnmute(message.playerId) : moderation.onMute(message.playerId))}
                      >
                        {muted ? `Unmute ${name}` : `Mute ${name}`}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {loadError ? <p className="ww-action-copy">{loadError}</p> : null}
      {moderation?.error ? (
        <p className="ww-action-alert" role="alert">
          {moderation.error}
        </p>
      ) : null}
      {channelClosed ? null : (
        <form
          className="ww-discussion-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (canPost && sendable && !sending) onSend();
          }}
        >
          <TextField
            className="ww-chat-field"
            size="small"
            label="Message"
            placeholder="Type a message…"
            value={draft}
            disabled={!canPost || sending}
            onChange={(event) => onDraft(event.target.value)}
            helperText={helper}
            slotProps={{ htmlInput: { 'aria-label': 'Message' } }}
          />
          {sendError ? (
            <p className="ww-action-alert" role="alert">
              {sendError}
            </p>
          ) : null}
          <Button type="submit" variant="contained" color="primary" disabled={!canPost || !sendable || sending}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
