import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const MESSAGE_MS = 4000;
const ERROR_MS = 3000;

interface Notifications {
  message: string | null;
  error: string | null;
  /** Shows an informational message in the alert bar for a few seconds */
  showMessage: (text: string) => void;
  /** Shows an error in the alert bar for a few seconds */
  showError: (text: string) => void;
}

const NotificationsContext = createContext<Notifications | null>(null);

// A text that clears itself after `duration` ms; showing a new one restarts the timer.
function useFlash(duration: number) {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback(
    (value: string) => {
      clearTimeout(timer.current);
      setText(value);
      timer.current = setTimeout(() => {
        setText(null);
      }, duration);
    },
    [duration],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return [text, show] as const;
}

/** Holds the alert bar's transient message and error for the whole app. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [message, showMessage] = useFlash(MESSAGE_MS);
  const [error, showError] = useFlash(ERROR_MS);
  const value = useMemo(
    () => ({ message, error, showMessage, showError }),
    [message, error, showMessage, showError],
  );
  return <NotificationsContext value={value}>{children}</NotificationsContext>;
}

/** The alert bar's message and error, and functions to show new ones. */
export function useNotifications(): Notifications {
  const notifications = useContext(NotificationsContext);
  if (!notifications) {
    throw new Error('useNotifications needs a NotificationsProvider');
  }
  return notifications;
}
