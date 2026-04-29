// Shared drag state via a simple ref-based context
// Avoids re-renders — only drag start/end matters
import { createContext, useContext } from 'react';

export const DragContext = createContext({
  isDragging: false,
  setIsDragging: () => {},
});

export const useDragContext = () => useContext(DragContext);