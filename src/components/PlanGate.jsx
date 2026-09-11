import { useEffect, useState } from "react";

// @project
import { useAuth } from "@/contexts/AuthContext";
import { checkSubscription } from "@/utils/api/windmill";
import LockedPageOverlay from "@/components/LockedPageOverlay";
import Loader from "@/components/Loader";

/***************************  PLAN GATE  ***************************/

// Same admin rule AdminLayout already uses, kept in one place here.
const ADMIN_EMAILS = ["help@marketingtool.pro"];
const ADMIN_NAMES = ["testuser1"];

/**
 * Gates a paid page behind the real subscription tier.
 *
 * Calls f/tools/check-subscription on Windmill, which returns
 * { tier, trialDaysLeft, blocked, code }. Fails CLOSED: the helper already
 * returns blocked:true when the call errors, so a backend outage never opens
 * a paid page. Admins bypass the check entirely.
 */
export default function PlanGate({ featureName, featureDescription, features, children }) {
  const { user, isProcessing } = useAuth();
  const [status, setStatus] = useState("checking");

  const isAdmin =
    ADMIN_EMAILS.includes(user?.email?.toLowerCase()) || ADMIN_NAMES.includes(user?.name);

  useEffect(() => {
    let cancelled = false;

    if (isProcessing) return undefined;

    if (isAdmin) {
      setStatus("allowed");
      return undefined;
    }

    const userId = user?.$id || user?.id;
    if (!userId) {
      setStatus("blocked");
      return undefined;
    }

    setStatus("checking");
    (async () => {
      const result = await checkSubscription({ userId });
      if (cancelled) return;
      setStatus(result?.blocked ? "blocked" : "allowed");
    })();

    return () => {
      cancelled = true;
    };
  }, [isProcessing, isAdmin, user]);

  if (isProcessing || status === "checking") return <Loader />;

  if (status === "blocked") {
    return (
      <LockedPageOverlay
        featureName={featureName}
        featureDescription={featureDescription}
        features={features}
      />
    );
  }

  return children;
}
