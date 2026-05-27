import { useEffect } from 'react';
import { useNavigationContext } from '../context/NavigationContext';

/**
 * Hook to automatically manage nav visibility based on screen focus
 * Call this in screen components that have scrollable content
 */
export const useAutoHideNav = () => {
  const { showNav, forceShowNav } = useNavigationContext();

  useEffect(() => {
    // Show nav when screen mounts
    forceShowNav();

    return () => {
      // Ensure nav is visible when leaving screen
      showNav();
    };
  }, [showNav, forceShowNav]);
};

export default useAutoHideNav;