import type { ChatMessage } from '@warewolf/contracts';
import type { ChatRefusal } from '@warewolf/domain';
import { Button, TextField } from '@mui/material';
import { PlayerAvatar } from './PlayerAvatar';
import { chatRefusalCopy, chatRemainingCopy, chatSeatName } from './chatCopy';

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
  const closed = chatRefusalCopy(canPost ? null : refusal);
  const helper = canPost ? chatRemainingCopy(remaining) : (closed ?? (isLoading ? 'Opening chat…' : null));

  return (
    <div className="ww-discussion">
      <ul className="ww-discussion-log" aria-label="Messages">
        {messages.length === 0 ? <li className="ww-log-empty">{isLoading ? 'Opening chat…' : 'No messages yet.'}</li> : null}
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
        <Button type="submit" variant="contained" color="secondary" disabled={!canPost || !sendable || sending}>
          Send
        </Button>
      </form>
    </div>
  );
}
