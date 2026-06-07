import { useEffect } from 'react';
import { useNavigationVisibility } from '../context/AppContext';

/**
 * Hook to automatically manage nav visibility based on screen focus
 * Call this in screen components that have scrollable content
 */
export const useAutoHideNav = () => {
  const { showNav, forceShowNav } = useNavigationVisibility();

  useEffect(() => {
    forceShowNav();

    return () => {
      showNav();
    };
  }, [showNav, forceShowNav]);
};

export default useAutoHideNav;