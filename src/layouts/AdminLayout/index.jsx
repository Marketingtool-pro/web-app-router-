import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import useMediaQuery from "@mui/material/useMediaQuery";
import Container from "@mui/material/Container";
import Toolbar from "@mui/material/Toolbar";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";

// @project
import Drawer from "./Drawer";
import Header from "./Header";
import ConnectAdsModal from "@/components/ConnectAdsModal";
import { handlerDrawerOpen, useGetMenuMaster } from "@/states/menu";
import Breadcrumbs from "@/components/Breadcrumbs";
import Loader from "@/components/Loader";
import { DRAWER_WIDTH } from "@/config";
import useConfig from "@/hooks/useConfig";
import { useAuth } from "@/contexts/AuthContext";
import { fetchConnectedAccounts } from "@/utils/api/windmill";

/***************************  ADMIN LAYOUT  ***************************/

export default function DashboardLayout() {
  const { menuMasterLoading } = useGetMenuMaster();
  const { user } = useAuth();
  const isAdmin =
    user?.email?.toLowerCase() === "help@marketingtool.pro" || user?.name === "testuser1";
  const {
    state: { miniDrawer },
  } = useConfig();

  const downXL = useMediaQuery((theme) => theme.breakpoints.down("xl"));
  // Start hidden. The popup is shown only once the backend confirms the
  // customer has no connected ad accounts. The old rule was
  // localStorage("fb_ads_connected") !== "true", which is per-browser and
  // Facebook-only: it nagged customers who had already connected Google Ads,
  // reappeared on every new device, and could be silenced permanently by
  // setting one browser value.
  // "checking" until the backend answers, so the app never flashes behind the
  // gate. The modal itself is hard: disableEscapeKeyDown, no close, no skip.
  const [adsState, setAdsState] = useState("checking");
  const showConnectAds = adsState === "none";

  useEffect(() => {
    const userId = user?.$id || user?.id;
    if (!userId) return undefined;

    let cancelled = false;

    const checkConnection = async () => {
      try {
        const res = await fetchConnectedAccounts({ userId });
        const accounts = Array.isArray(res) ? res : res?.accounts || [];
        if (!cancelled) setAdsState(accounts.length === 0 ? "none" : "connected");
      } catch {
        // Never lock a paying customer out on a backend hiccup.
        if (!cancelled) setAdsState("connected");
      }
    };

    checkConnection();
    // Re-check when the tab regains focus, e.g. returning from an OAuth redirect.
    window.addEventListener("focus", checkConnection);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", checkConnection);
    };
  }, [user]);

  // set drawer media and `miniDrawer` config wise
  useEffect(() => {
    if (!miniDrawer) {
      handlerDrawerOpen(!downXL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downXL]);

  if (menuMasterLoading) return <Loader />;
  if (!isAdmin && adsState === "checking") return <Loader />;

  return (
    <Stack direction="row" sx={{ width: 1 }}>
      {showConnectAds && !isAdmin && <ConnectAdsModal />}
      <Header />
      <Drawer />
      <Box
        component="main"
        sx={{ width: `calc(100% - ${DRAWER_WIDTH}px)`, flexGrow: 1, p: { xs: 2, sm: 3 } }}
      >
        <Toolbar sx={{ minHeight: { xs: 54, sm: 46, md: 76 } }} />
        <Box
          sx={{
            py: 0.4,
            px: 1.5,
            mx: { xs: -2, sm: -3 },
            display: { xs: "block", md: "none" },
            borderBottom: 1,
            borderColor: "divider",
            mb: 2,
          }}
        >
          <Breadcrumbs />
        </Box>
        <Container maxWidth={false} sx={{ px: { xs: 0, sm: 2, md: 3, lg: 4 }, maxWidth: 1920 }}>
          <Outlet />
        </Container>
      </Box>
    </Stack>
  );
}
