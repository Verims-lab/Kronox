declare module 'canvas-confetti' {
  type ConfettiOptions = Record<string, unknown>;

  interface ConfettiInstance {
    (options?: ConfettiOptions): Promise<null> | null;
    reset?: () => void;
  }

  const confetti: ConfettiInstance;
  export default confetti;
}
