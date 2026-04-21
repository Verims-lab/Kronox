import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function DropZone({ index, isActive, onDrop }) {
  return (
    <motion.div
      animate={isActive ? { scale: 1.1, borderColor: 'hsl(43, 80%, 55%)' } : { scale: 1 }}
      className={`
        flex items-center justify-center
        w-8 h-20 min-w-8
        rounded-md border-2 border-dashed
        transition-colors duration-200
        cursor-pointer
        ${isActive 
          ? 'border-primary bg-primary/20' 
          : 'border-muted-foreground/30 bg-muted/30 hover:border-primary/50 hover:bg-primary/10'}
      `}
      onClick={() => onDrop(index)}
    >
      <ChevronDown className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground/50'}`} />
    </motion.div>
  );
}