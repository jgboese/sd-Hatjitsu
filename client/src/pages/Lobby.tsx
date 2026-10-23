import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useNotifications } from '../notifications.tsx';
import { request } from '../socket.ts';

/** The landing page: create a room, or join one by its number. */
export function Lobby() {
  const navigate = useNavigate();
  const { showError } = useNotifications();
  const [roomNumber, setRoomNumber] = useState('');
  const [busy, setBusy] = useState(false);

  const enterRoom = async () => {
    setBusy(true);
    const response = await request('room info', { roomUrl: roomNumber });
    if ('error' in response) {
      setBusy(false);
      showError(response.error);
    } else {
      void navigate(`/${response.roomUrl}`);
    }
  };

  const createRoom = async () => {
    setBusy(true);
    const response = await request('create room', {});
    if (typeof response === 'string') {
      void navigate(`/${response}`);
    } else {
      setBusy(false);
      showError(response.error);
    }
  };

  return (
    <div className="lobby">
      <h3 className="subheading">
        Distributed scrum <span>planning poker</span> for estimating agile
        projects.
      </h3>
      <p>
        First person to <strong>create</strong> the room is the moderator.{' '}
        <strong>Share</strong> the url or room number with other team members to{' '}
        <strong>join</strong> the room.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void enterRoom();
        }}
      >
        <label className="subheading" htmlFor="roomfield">
          Enter room number
        </label>
        <div className="row">
          <input
            value={roomNumber}
            onChange={(event) => {
              setRoomNumber(event.target.value);
            }}
            name="roomfield"
            id="roomfield"
            type="tel"
            maxLength={5}
            placeholder="room no"
            className="span2 roomUrl"
            autoFocus
          />{' '}
          <button
            type="submit"
            className="span2 btn"
            title="Join an existing planning poker room"
            disabled={busy}
          >
            Join room
          </button>
        </div>
        <label htmlFor="createRoom">or</label>
        <div className="row">
          <button
            type="button"
            id="createRoom"
            className="span1 btn"
            title="Create a new planning poker room"
            disabled={busy}
            onClick={() => void createRoom()}
          >
            Create new room
          </button>
        </div>
      </form>
    </div>
  );
}
