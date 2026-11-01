export function notifySaved(message: string) {
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent('nextplay:notification', { detail: message }),
    );
}
