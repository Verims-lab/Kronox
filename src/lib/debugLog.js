const isDev = import.meta.env.DEV;

export const debugLog = (...args) => {
  if (isDev) console.log(...args);
};

export const debugWarn = (...args) => {
  if (isDev) console.warn(...args);
};
