/**
 * Tiny write-notification hub. Repository mutations call notifyDataChanged();
 * screens subscribe to refetch. Keeps screens ignorant of *who* changed the
 * data (add modal, category manager, CSV import — all just work).
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDataChanged(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}
