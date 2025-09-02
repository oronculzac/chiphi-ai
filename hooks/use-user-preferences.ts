import { useState, useEffect, useCallback } from 'react';

export interface UserPreferences {
  // Notification preferences
  emailNotifications: boolean;
  pushNotifications: boolean;
  transactionAlerts: boolean;
  weeklyReports: boolean;
  
  // Display preferences
  theme: 'light' | 'dark' | 'system';
  language: string;
  currency: string;
  dateFormat: string;
  
  // Accessibility preferences
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  soundEffects: boolean;
  
  // Dashboard preferences
  defaultView: 'analytics' | 'transactions' | 'insights';
  itemsPerPage: number;
  autoRefresh: boolean;
  compactMode: boolean;
}

const defaultPreferences: UserPreferences = {
  emailNotifications: true,
  pushNotifications: false,
  transactionAlerts: true,
  weeklyReports: true,
  theme: 'system',
  language: 'en',
  currency: 'USD',
  dateFormat: 'MM/dd/yyyy',
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  soundEffects: true,
  defaultView: 'analytics',
  itemsPerPage: 25,
  autoRefresh: true,
  compactMode: false,
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from localStorage or API
  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Try localStorage first (for demo/offline support)
      const stored = localStorage.getItem('user-preferences');
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
        applyPreferences({ ...defaultPreferences, ...parsed });
        return;
      }

      // In a real app, load from API:
      // const response = await fetch('/api/user/preferences');
      // if (!response.ok) throw new Error('Failed to load preferences');
      // const data = await response.json();
      // setPreferences(data.preferences);
      // applyPreferences(data.preferences);

    } catch (err) {
      console.error('Error loading preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
      // Use defaults on error
      setPreferences(defaultPreferences);
      applyPreferences(defaultPreferences);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save preferences to localStorage or API
  const savePreferences = useCallback(async (newPreferences: UserPreferences) => {
    try {
      setError(null);

      // Save to localStorage (for demo/offline support)
      localStorage.setItem('user-preferences', JSON.stringify(newPreferences));

      // In a real app, save to API:
      // const response = await fetch('/api/user/preferences', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(newPreferences),
      // });
      // if (!response.ok) throw new Error('Failed to save preferences');

      setPreferences(newPreferences);
      applyPreferences(newPreferences);

    } catch (err) {
      console.error('Error saving preferences:', err);
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
      throw err; // Re-throw so UI can handle the error
    }
  }, []);

  // Update a specific preference
  const updatePreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    savePreferences(newPreferences);
  }, [preferences, savePreferences]);

  // Apply preferences to the DOM/environment
  const applyPreferences = useCallback((prefs: UserPreferences) => {
    // Apply theme
    if (prefs.theme !== 'system') {
      document.documentElement.classList.toggle('dark', prefs.theme === 'dark');
    } else {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    }

    // Apply accessibility preferences
    document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion);
    document.documentElement.classList.toggle('high-contrast', prefs.highContrast);
    document.documentElement.classList.toggle('large-text', prefs.largeText);

    // Apply compact mode
    document.documentElement.classList.toggle('compact-mode', prefs.compactMode);

    // Set CSS custom properties for dynamic values
    document.documentElement.style.setProperty('--items-per-page', prefs.itemsPerPage.toString());
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    savePreferences(defaultPreferences);
  }, [savePreferences]);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Listen for system theme changes when using 'system' theme
  useEffect(() => {
    if (preferences.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        document.documentElement.classList.toggle('dark', mediaQuery.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [preferences.theme]);

  // Format currency based on preferences
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: preferences.currency,
    }).format(amount);
  }, [preferences.currency]);

  // Format date based on preferences
  const formatDate = useCallback((date: Date) => {
    const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
      'MM/dd/yyyy': { month: '2-digit', day: '2-digit', year: 'numeric' },
      'dd/MM/yyyy': { day: '2-digit', month: '2-digit', year: 'numeric' },
      'yyyy-MM-dd': { year: 'numeric', month: '2-digit', day: '2-digit' },
      'MMM d, yyyy': { month: 'short', day: 'numeric', year: 'numeric' },
    };

    const options = formatMap[preferences.dateFormat] || formatMap['MM/dd/yyyy'];
    return new Intl.DateTimeFormat(preferences.language, options).format(date);
  }, [preferences.dateFormat, preferences.language]);

  // Play sound effect if enabled
  const playSound = useCallback((soundType: 'success' | 'error' | 'notification' = 'notification') => {
    if (!preferences.soundEffects) return;

    // In a real app, you would play actual sound files
    // For now, we'll just use the Web Audio API to create simple tones
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different sound types
      const frequencies = {
        success: 800,
        error: 300,
        notification: 600,
      };

      oscillator.frequency.setValueAtTime(frequencies[soundType], audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Ignore audio errors (e.g., if user hasn't interacted with page yet)
      console.debug('Could not play sound:', error);
    }
  }, [preferences.soundEffects]);

  return {
    preferences,
    loading,
    error,
    updatePreference,
    savePreferences,
    resetToDefaults,
    formatCurrency,
    formatDate,
    playSound,
  };
}