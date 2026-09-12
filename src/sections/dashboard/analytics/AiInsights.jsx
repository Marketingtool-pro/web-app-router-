import { useEffect, useState } from "react";

// @mui
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";

// @project
import MainCard from "@/components/MainCard";
import RichText from "@/components/RichText";
import { fetchAnalyticsOverview } from "@/utils/api/windmill";
import { useAuth } from "@/contexts/AuthContext";

/***************************  DASHBOARD - AI INSIGHTS  ***************************/

// f/tools/engine-analytics-overview already returns aiAnalysis,
// aiRecommendations, aiForecast and automationRules from the AI Router.
// Nothing in the app rendered any of it, so the engine burned four model
// calls per load and the customer saw only the KPI numbers.

function Section({ title, body, loading }) {
  if (loading) {
    return (
      <MainCard>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
      </MainCard>
    );
  }
  if (!body) return null;
  return (
    <MainCard>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <RichText text={body} />
    </MainCard>
  );
}

function Forecast({ raw }) {
  let f = null;
  try {
    f = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    f = null;
  }
  if (!f || typeof f !== "object") return null;

  const cells = [
    { label: "Forecast spend", value: f.forecastSpend },
    { label: "Forecast clicks", value: f.forecastClicks },
    { label: "Forecast conversions", value: f.forecastConversions },
    { label: "Forecast ROAS", value: f.forecastROAS },
  ].filter((c) => c.value !== undefined && c.value !== null);

  if (!cells.length) return null;

  return (
    <MainCard>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6">Next 30 days</Typography>
        {f.confidence ? <Chip size="small" label={`${f.confidence}% confidence`} /> : null}
      </Stack>
      <Grid container spacing={2}>
        {cells.map((c) => (
          <Grid key={c.label} size={{ xs: 6, md: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {c.label}
              </Typography>
              <Typography variant="h5">{c.value}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>
    </MainCard>
  );
}

export default function AiInsights({ dateRange = "last_30_days", platform = null }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: false, data: null });

  useEffect(() => {
    const userId = user?.$id || user?.id;
    if (!userId) return undefined;

    let cancelled = false;
    setState({ loading: true, data: null });

    (async () => {
      try {
        const res = await fetchAnalyticsOverview({ userId, dateRange, platform });
        if (!cancelled) setState({ loading: false, data: res?.data || null });
      } catch {
        // Show nothing rather than an error block or placeholder text.
        if (!cancelled) setState({ loading: false, data: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, dateRange, platform]);

  const { loading, data } = state;
  const hasAny =
    data && (data.aiAnalysis || data.aiRecommendations || data.aiForecast || data.automationRules);

  if (!loading && !hasAny) return null;

  return (
    <Stack sx={{ gap: { xs: 3, md: 4 } }}>
      <Section title="What the numbers say" body={data?.aiAnalysis} loading={loading} />
      <Section title="Recommended actions" body={data?.aiRecommendations} loading={loading} />
      <Forecast raw={data?.aiForecast} />
      <Section title="Automation rules" body={data?.automationRules} loading={loading} />
    </Stack>
  );
}
