import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { enqueueSnackbar } from "notistack";

// @project
import { useAuth } from "@/contexts/AuthContext";
import Loader from "@/components/Loader";
import { getAppwriteJwt } from "@/utils/api/windmill";

export default function IgConnectCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const processCallback = async () => {
      const hash = location.hash;
      const params = new URLSearchParams(hash.replace("#", "?"));
      const accessToken = params.get("access_token");
      const state = params.get("state");

      // Verify state
      const savedState = sessionStorage.getItem("fb_ads_state");
      if (state !== savedState) {
        console.warn("Invalid state in IG callback");
        if (window.opener) {
          window.opener.postMessage({ type: "IG_AUTH_FAILURE" }, window.location.origin);
          window.close();
        } else {
          enqueueSnackbar("Failed to connect Instagram.", { variant: "error" });
          navigate("/setting/profile");
        }
        return;
      }

      if (accessToken) {
        let synced = false;

        // Sync with Windmill
        try {
          const API_BASE = import.meta.env.VITE_WINDMILL_URL || "https://app.marketingtool.pro";
          const API_WORKSPACE = import.meta.env.VITE_WINDMILL_WORKSPACE || "marketingtool-pro";

          const response = await fetch(
            `${API_BASE}/api/w/${API_WORKSPACE}/jobs/run_wait_result/p/f/tools/instagram-connect`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getAppwriteJwt()}`,
              },
              body: JSON.stringify({ accessToken, userId: user?.id, platform: "instagram" }),
            },
          );

          if (!response.ok) {
            throw new Error(`Windmill sync failed with status ${response.status}`);
          }

          synced = true;
        } catch (e) {
          console.error("Windmill sync error:", e);
        }

        if (!synced) {
          if (window.opener) {
            window.opener.postMessage({ type: "IG_AUTH_FAILURE" }, window.location.origin);
            window.close();
          } else {
            enqueueSnackbar("Failed to connect Instagram.", { variant: "error" });
            navigate("/setting/profile");
          }
          return;
        }

        localStorage.setItem("ig_ads_connected", "true");

        // If opened in popup, communicate with parent
        if (window.opener) {
          window.opener.postMessage(
            { type: "IG_AUTH_SUCCESS", data: { id: user?.id, access_token: accessToken } },
            window.location.origin,
          );
          window.close();
        } else {
          enqueueSnackbar("Instagram connected successfully!", { variant: "success" });
          navigate("/setting/profile");
        }
      } else {
        if (window.opener) {
          window.opener.postMessage({ type: "IG_AUTH_FAILURE" }, window.location.origin);
          window.close();
        } else {
          enqueueSnackbar("Failed to connect Instagram.", { variant: "error" });
          navigate("/setting/profile");
        }
      }
    };

    processCallback();
  }, [location, navigate, user?.id]);

  return <Loader />;
}
