import React, { createContext, useContext, useState, useCallback } from 'react';

const NavigationStackContext = createContext();

export function NavigationStackProvider({ children }) {
  const [stacks, setStacks] = useState({
    '/': ['/'],
    '/lobby': ['/lobby'],
    '/settings': ['/settings'],
  });

  const [currentTab, setCurrentTab] = useState('/');

  const pushRoute = useCallback((tabPath, newRoute) => {
    setStacks(prev => ({
      ...prev,
      [tabPath]: [...prev[tabPath], newRoute]
    }));
  }, []);

  const popRoute = useCallback((tabPath) => {
    setStacks(prev => ({
      ...prev,
      [tabPath]: prev[tabPath].length > 1 
        ? prev[tabPath].slice(0, -1) 
        : prev[tabPath]
    }));
  }, []);

  const resetStack = useCallback((tabPath) => {
    setStacks(prev => ({
      ...prev,
      [tabPath]: [tabPath]
    }));
  }, []);

  const switchTab = useCallback((tabPath) => {
    setCurrentTab(tabPath);
  }, []);

  const getStackForTab = useCallback((tabPath) => {
    return stacks[tabPath] || [tabPath];
  }, [stacks]);

  return (
    <NavigationStackContext.Provider
      value={{
        stacks,
        currentTab,
        pushRoute,
        popRoute,
        resetStack,
        switchTab,
        getStackForTab,
      }}
    >
      {children}
    </NavigationStackContext.Provider>
  );
}

export function useNavigationStack() {
  const context = useContext(NavigationStackContext);
  if (!context) {
    throw new Error('useNavigationStack must be used within NavigationStackProvider');
  }
  return context;
}