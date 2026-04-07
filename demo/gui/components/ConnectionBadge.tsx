import { useMachine, ConnectionState } from 'lux-react';

export function ConnectionBadge() {
  const { connectionState, changeUser } = useMachine();

  const label =
    connectionState === ConnectionState.CONNECTED
      ? 'Connected'
      : connectionState === ConnectionState.CONNECTING
        ? 'Connecting'
        : connectionState === ConnectionState.ERROR
          ? 'Error'
          : 'Disconnected';

  const cls =
    connectionState === ConnectionState.CONNECTED
      ? 'badge badge--ok'
      : connectionState === ConnectionState.ERROR
        ? 'badge badge--error'
        : 'badge badge--neutral';

  return (
    <div className={cls}>
      <span className="badge-dot" />
      {label}
        {changeUser && (
            <>
            <button className="badge-button" onClick={() => changeUser!('anonymous', '')}>
                Log out
            </button>
            <button className="badge-button" onClick={() => changeUser!('dev', 'dev')}>
                Log in
            </button>
            </>
        )}
    </div>
  );
}
