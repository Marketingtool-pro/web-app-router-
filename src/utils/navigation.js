import { useNavigate, useLocation, useParams } from 'react-router-dom';

const DANGEROUS_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:']);

// Keep this allowlist limited to trusted external destinations only.
// Add origins as needed, for example: 'https://docs.example.com'
const ALLOWED_EXTERNAL_ORIGINS = new Set();

const isAllowedExternalOrigin = (origin) => ALLOWED_EXTERNAL_ORIGINS.has(origin);

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

export function useRouter() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const push = (path) => {
    try {
      const target = getSafeNavigationTarget(path);
      if (!target) return;

      const { appOrigin, url } = target;

      if (url.origin === appOrigin) {
        // Internal route: use SPA navigation
        navigate(url.pathname + url.search + url.hash);
      } else if (isAllowedExternalOrigin(url.origin)) {
        // External URL (allowlisted): full page reload
        window.location.href = url.href;
      } else {
        console.warn('Blocked navigation to non-allowlisted external origin:', url.origin);
      }
    } catch (error) {
      console.error('Navigation push failed for target:', path, error);
    }
  };

  const replace = (path) => {
    try {
      const target = getSafeNavigationTarget(path);
      if (!target) return;

      const { appOrigin, url } = target;

      if (url.origin === appOrigin) {
        navigate(url.pathname + url.search + url.hash, { replace: true });
      } else if (isAllowedExternalOrigin(url.origin)) {
        window.location.replace(url.href);
      } else {
        console.warn('Blocked replace to non-allowlisted external origin:', url.origin);
      }
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
