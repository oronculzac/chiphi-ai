import { useEffect, useCallback, useRef } from 'react';

interface KeyboardNavigationOptions {
  // Enable arrow key navigation for lists/grids
  enableArrowKeys?: boolean;
  // Enable tab trapping within a container
  enableTabTrapping?: boolean;
  // Enable escape key handling
  enableEscapeKey?: boolean;
  // Enable enter/space key handling for custom elements
  enableActivationKeys?: boolean;
  // Callback for escape key
  onEscape?: () => void;
  // Callback for activation keys (enter/space)
  onActivate?: (element: HTMLElement) => void;
  // Selector for focusable elements
  focusableSelector?: string;
}

const defaultFocusableSelector = `
  a[href],
  button:not([disabled]),
  input:not([disabled]),
  select:not([disabled]),
  textarea:not([disabled]),
  [tabindex]:not([tabindex="-1"]),
  [contenteditable="true"]
`;

export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: KeyboardNavigationOptions = {}
) {
  const {
    enableArrowKeys = false,
    enableTabTrapping = false,
    enableEscapeKey = false,
    enableActivationKeys = false,
    onEscape,
    onActivate,
    focusableSelector = defaultFocusableSelector,
  } = options;

  const currentFocusIndex = useRef<number>(0);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    
    const elements = containerRef.current.querySelectorAll(focusableSelector);
    return Array.from(elements).filter((el): el is HTMLElement => {
      return el instanceof HTMLElement && 
             el.offsetParent !== null && // Element is visible
             !el.hasAttribute('disabled') &&
             el.tabIndex !== -1;
    });
  }, [containerRef, focusableSelector]);

  // Focus an element by index
  const focusElementByIndex = useCallback((index: number) => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    // Wrap around if index is out of bounds
    const wrappedIndex = ((index % elements.length) + elements.length) % elements.length;
    currentFocusIndex.current = wrappedIndex;
    
    const element = elements[wrappedIndex];
    element.focus();
    
    // Scroll element into view if needed
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'nearest',
      inline: 'nearest'
    });
  }, [getFocusableElements]);

  // Get current focus index
  const getCurrentFocusIndex = useCallback((): number => {
    const elements = getFocusableElements();
    const activeElement = document.activeElement as HTMLElement;
    
    if (!activeElement || !containerRef.current?.contains(activeElement)) {
      return 0;
    }
    
    const index = elements.indexOf(activeElement);
    return index >= 0 ? index : 0;
  }, [getFocusableElements, containerRef]);

  // Handle arrow key navigation
  const handleArrowKeys = useCallback((event: KeyboardEvent) => {
    if (!enableArrowKeys) return;

    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentIndex = getCurrentFocusIndex();

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        focusElementByIndex(currentIndex + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        focusElementByIndex(currentIndex - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusElementByIndex(0);
        break;
      case 'End':
        event.preventDefault();
        focusElementByIndex(elements.length - 1);
        break;
    }
  }, [enableArrowKeys, getFocusableElements, getCurrentFocusIndex, focusElementByIndex]);

  // Handle tab trapping
  const handleTabTrapping = useCallback((event: KeyboardEvent) => {
    if (!enableTabTrapping || event.key !== 'Tab') return;

    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    // If we're not within the container, focus the first element
    if (!containerRef.current?.contains(activeElement)) {
      event.preventDefault();
      firstElement.focus();
      return;
    }

    // Handle shift+tab (backward)
    if (event.shiftKey) {
      if (activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Handle tab (forward)
      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, [enableTabTrapping, getFocusableElements, containerRef]);

  // Handle escape key
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (!enableEscapeKey || event.key !== 'Escape') return;
    
    event.preventDefault();
    onEscape?.();
  }, [enableEscapeKey, onEscape]);

  // Handle activation keys (Enter/Space)
  const handleActivationKeys = useCallback((event: KeyboardEvent) => {
    if (!enableActivationKeys) return;
    
    const activeElement = document.activeElement as HTMLElement;
    if (!activeElement || !containerRef.current?.contains(activeElement)) return;

    // Only handle if the element doesn't have native activation behavior
    const isNativelyActivatable = activeElement.matches('button, a, input, select, textarea');
    if (isNativelyActivatable) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate?.(activeElement);
    }
  }, [enableActivationKeys, containerRef, onActivate]);

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle events within our container
    if (!containerRef.current?.contains(event.target as Node)) return;

    handleArrowKeys(event);
    handleTabTrapping(event);
    handleEscapeKey(event);
    handleActivationKeys(event);
  }, [handleArrowKeys, handleTabTrapping, handleEscapeKey, handleActivationKeys, containerRef]);

  // Focus the first element
  const focusFirst = useCallback(() => {
    focusElementByIndex(0);
  }, [focusElementByIndex]);

  // Focus the last element
  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    focusElementByIndex(elements.length - 1);
  }, [focusElementByIndex, getFocusableElements]);

  // Focus the next element
  const focusNext = useCallback(() => {
    const currentIndex = getCurrentFocusIndex();
    focusElementByIndex(currentIndex + 1);
  }, [getCurrentFocusIndex, focusElementByIndex]);

  // Focus the previous element
  const focusPrevious = useCallback(() => {
    const currentIndex = getCurrentFocusIndex();
    focusElementByIndex(currentIndex - 1);
  }, [getCurrentFocusIndex, focusElementByIndex]);

  // Set up event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return navigation functions
  return {
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusElementByIndex,
    getFocusableElements,
    getCurrentFocusIndex,
  };
}

// Hook for managing focus restoration
export function useFocusRestore() {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const saveFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
      previousFocusRef.current.focus();
    }
  }, []);

  return { saveFocus, restoreFocus };
}

// Hook for managing focus trap (useful for modals/dialogs)
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);
  
  const { focusFirst } = useKeyboardNavigation(containerRef, {
    enableTabTrapping: isActive,
  });

  // Focus first element when trap becomes active
  useEffect(() => {
    if (isActive) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(focusFirst, 10);
      return () => clearTimeout(timer);
    }
  }, [isActive, focusFirst]);

  return containerRef;
}