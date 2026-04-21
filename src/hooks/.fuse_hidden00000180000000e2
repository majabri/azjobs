import { useEffect } from 'react';

const DEFAULT_TITLE = 'iCareerOS';
const TITLE_SUFFIX = ' | iCareerOS';

/**
 * Custom hook to set the page title
 * Automatically adds " | iCareerOS" suffix and restores default on unmount
 *
 * @param pageName - The name of the current page/section
 * @example
 * usePageTitle('Dashboard');
 * // Sets document.title to "Dashboard | iCareerOS"
 */
export const usePageTitle = (pageName: string): void => {
  useEffect(() => {
    const previousTitle = document.title;
    const newTitle = pageName ? `${pageName}${TITLE_SUFFIX}` : DEFAULT_TITLE;

    document.title = newTitle;

    // Cleanup: restore previous title on unmount
    return () => {
      document.title = previousTitle;
    };
  }, [pageName]);
};

export default usePageTitle;
