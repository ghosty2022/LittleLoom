import { useEffect } from 'react';
import { useNavigationVisibility } from '../context/AppContext';

export interface AutoHideNavOptions {
  /** Hide the nav bar when this screen is focused (default: false) */
  hideOnFocus?: boolean;
  /** Show the nav bar when this screen is blurred/unmounted (default: true) */
  showOnBlur?: boolean;
  /** Mark this as a community screen to hide tab bar completely (default: false) */
  isCommunityScreen?: boolean;
  /** Route name to set for community detection (optional) */
  routeName?: string | null;
}

export const useAutoHideNav = (options: AutoHideNavOptions = {}) => {
  const { showNav, forceShowNav, forceHideNav, setCommunityRoute } = useNavigationVisibility();

  const {
    hideOnFocus = false,
    showOnBlur = true,
    isCommunityScreen = false,
    routeName = null,
  } = options;

  useEffect(() => {
    if (routeName !== undefined) {
      setCommunityRoute(routeName);
    }

    if (isCommunityScreen || hideOnFocus) {
      forceHideNav();
    } else {
      forceShowNav();
    }

    return () => {
      if (routeName !== undefined) {
        setCommunityRoute(null);
      }
      if (showOnBlur) {
        showNav();
      }
    };
  }, [showNav, forceShowNav, forceHideNav, setCommunityRoute, hideOnFocus, showOnBlur, isCommunityScreen, routeName]);
};

export default useAutoHideNav;
