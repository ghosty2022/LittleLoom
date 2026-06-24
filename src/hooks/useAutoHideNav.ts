// src/hooks/useAutoHideNav.ts
import { useEffect, useRef } from 'react';
import { useNavigationState } from '@react-navigation/native';
import { useSmartNavVisibility } from './useSmartNavVisibility';

export interface AutoHideNavOptions {
  /** Hide the nav bar when this screen is focused (default: false) */
  hideOnFocus?: boolean;
  /** Show the nav bar when this screen is blurred/unmounted (default: true) */
  showOnBlur?: boolean;
  /** Mark this as a community screen to hide tab bar completely (default: false) */
  isCommunityScreen?: boolean;
  /** Route name to set for community detection (optional) */
  routeName?: string | null;
  /** Custom smart nav config */
  navConfig?: Parameters<typeof useSmartNavVisibility>[0];
}

/**
 * 2026: useAutoHideNav — Now uses the Smart Visibility Engine
 * 
 * This hook provides declarative control over navigation visibility
 * while respecting the new velocity-based scroll system.
 */
export const useAutoHideNav = (options: AutoHideNavOptions = {}) => {
  const {
    hideOnFocus = false,
    showOnBlur = true,
    isCommunityScreen = false,
    routeName = null,
    navConfig,
  } = options;

  // Get smart nav instance (shared across the app via context or singleton)
  const smartNav = useSmartNavVisibility(navConfig);
  const hasControlled = useRef(false);

  useEffect(() => {
    // Take control of nav visibility
    hasControlled.current = true;

    if (isCommunityScreen || hideOnFocus) {
      smartNav.forceHide();
    } else {
      smartNav.forceShow();
    }

    return () => {
      if (hasControlled.current && showOnBlur) {
        smartNav.forceShow();
        hasControlled.current = false;
      }
    };
  }, [smartNav, hideOnFocus, showOnBlur, isCommunityScreen, routeName]);

  return {
    smartNav,
    forceHide: smartNav.forceHide,
    forceShow: smartNav.forceShow,
  };
};

export default useAutoHideNav;