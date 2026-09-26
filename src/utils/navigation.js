import { useNavigate, useLocation, useParams } from 'react-router-dom';

const DANGEROUS_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);

const getSafeNavigationTarget = (path) => {
  const appOrigin = window.location.origin;

  try {
    const url = new URL(path, appOrigin);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      if (DANGEROUS_PROTOCOLS.has(url.protocol)) {
        console.warn('Blocked navigation to dangerous protocol:', url.protocol, 'target:', path);
      } else {
        console.warn('Blocked navigation to unsupported protocol:', url.protocol, 'target:', path);
      }
      return null;
    }

    return { appOrigin, url };
  } catch (error) {
    return null;
  }
};

// Router navigation is same-origin only. External links should be rendered as
// plain <a href> elements, never pushed through the SPA router.

/**
 * Returns a same-origin, path-only route ("/x?y#z") for `path`, or null.
 * Only the path/search/hash of a same-origin URL are ever returned, so the
 * result can never send the browser to another host.
 */
const toInternalRoute = (path) => {
  const target = getSafeNavigationTarget(path);
  if (!target) return null;
  const { appOrigin, url } = target;
  if (url.origin !== appOrigin) {
    console.warn('Blocked navigation to external origin:', url.origin);
    return null;
  }
  const route = url.pathname + url.search + url.hash;
  // Reject protocol-relative forms such as "//evil.example".
  if (!route.startsWith('/') || route.startsWith('//')) return null;
  return route;
};

export function useRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const push = (path) => {
    try {
      const route = toInternalRoute(path);
      if (route) navigate(route);
    } catch (error) {
      console.error('Navigation push failed for target:', path, error);
    }
  };

  const replace = (path) => {
    try {
      const route = toInternalRoute(path);
      if (route) navigate(route, { replace: true });
    } catch (error) {
      console.error('Navigation replace failed for target:', path, error);
    }
  };

  return {
    pathname: location.pathname,
    query: Object.fromEntries(new URLSearchParams(location.search)),
    asPath: location.pathname + location.search,
    push,
    replace,
    back: () => navigate(-1),
    params
  };
}

export function usePathname() {
  const location = useLocation();
  return location.pathname;
}

export function useSearchParams() {
  const location = useLocation();
  const navigate = useNavigate();

  return {
    get: (key) => new URLSearchParams(location.search).get(key),
    set: (key, value, options = {}) => {
      const newParams = new URLSearchParams(location.search);
      newParams.set(key, value);
      navigate(`${location.pathname}?${newParams.toString()}`, options);
    },
    setMany: (updates, options = {}) => {
      const newParams = new URLSearchParams(location.search);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, String(value));
        }
      });
      navigate(`${location.pathname}?${newParams.toString()}`, options);
    },
    createUpdater: () => {
      const draftParams = new URLSearchParams(location.search);
      return {
        set: (key, value) => {
          draftParams.set(key, String(value));
        },
        delete: (key) => {
          draftParams.delete(key);
        },
        commit: (options = {}) => {
          navigate(`${location.pathname}?${draftParams.toString()}`, options);
        }
      };
    }
  };
}
