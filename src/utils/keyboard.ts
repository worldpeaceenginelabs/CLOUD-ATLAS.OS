export function onEnter(event: KeyboardEvent, handler: () => void): void {
  if (event.key === 'Enter') {
    handler();
  }
}

