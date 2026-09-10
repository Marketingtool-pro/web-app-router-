import { useEffect, useRef } from 'react';

/***************************  MENU COLLAPSED - RECURSIVE FUNCTION  ***************************/

/**
 * Recursively traverses menu items to find and open the correct parent menu.
 * If a menu item matches the current pathname, it marks the corresponding menu as selected and opens it.
 *
 * @param {NavItemType[]} items - List of menu items.
 * @param {string} pathname - Current route pathname.
 * @param {string | undefined} menuId - ID of the menu to be set as selected.
 * @param {SetState<string | null>} setSelected - Function to update the selected menu.
 * @param {Dispatch<SetStateAction<boolean>>} setOpen - Function to update the open state.
 */

function setParentOpenedMenu(items, pathname, menuId, setSelected, setOpen) {
  for (const item of items) {
    // Recursively check child menus
    if (item.children?.length) {
      setParentOpenedMenu(item.children, pathname, menuId, setSelected, setOpen);
    }

    if (item.url === pathname) {
      setSelected(menuId ?? null);
      setOpen(true);
    }
  }
}

/***************************  MENU COLLAPSED - HOOK  ***************************/

/**
 * Hook to handle menu collapse behavior based on the current route.
 * Automatically expands the parent menu of the active route item.
 *
 * @param {NavItemType} menu - The menu object containing items.
 * @param {string} pathname - Current route pathname.
 * @param {boolean} miniMenuOpened - Flag indicating if the mini menu is open.
 * @param {SetState<string | null>} setSelected - Function to update selected menu state.
 * @param {Dispatch<SetStateAction<boolean>>} setOpen - Function to update menu open state.
 * @param {SetState<HTMLElement>} setAnchorEl - Function to update the anchor element state.
 */

export default function useMenuCollapse(menu, pathname, miniMenuOpened, setSelected, setOpen, setAnchorEl) {
  // The state setters and the mini-menu flag are read through a ref so that the effect
  // below can declare an exhaustive dependency list (route / menu shape only) without
  // re-running on every parent render. This keeps the original behaviour and removes the
  // stale `eslint-disable react-hooks/exhaustive-deps` comment, which the ESLint scanner
  // reported as an unknown rule.
  const latest = useRef({ miniMenuOpened, setSelected, setOpen, setAnchorEl });
  latest.current = { miniMenuOpened, setSelected, setOpen, setAnchorEl };

  useEffect(() => {
    const { miniMenuOpened: isMiniOpen, setSelected: select, setOpen: open, setAnchorEl: setAnchor } = latest.current;

    open(false); // Close the menu initially

    // Reset selection based on menu state
    if (!isMiniOpen) {
      select(null);
    } else if (setAnchor) {
      setAnchor(null);
    }

    // If menu has children, determine which should be opened
    if (menu.children?.length) {
      setParentOpenedMenu(menu.children, pathname, menu.id, select, open);
    }
  }, [pathname, menu.children, menu.id]);
}
