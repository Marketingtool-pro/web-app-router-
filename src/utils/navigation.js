import { useNavigate, useLocation, useParams } from 'react-router-dom';

const getSafeNavigationTarget = (path) => {
  const appOrigin = window.location.origin;
  const url = new URL(path, appOrigin);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  return { appOrigin, url };
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
      } else {
        // External URL: full page reload
        window.location.href = url.href;
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
      } else {
        window.location.replace(url.href);
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
    set: (key, value) => {
      const newParams = new URLSearchParams(location.search);
      newParams.set(key, value);
      navigate(`${location.pathname}?${newParams.toString()}`);
    }
  };
}
