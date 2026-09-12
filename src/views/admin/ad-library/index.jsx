import { useState, useCallback, useRef } from "react";

// @mui
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import CircularProgress from "@mui/material/CircularProgress";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

// @assets
import {
  IconSearch,
  IconBookmark,
  IconBookmarkFilled,
  IconBrandFacebook,
  IconBrandGoogle,
  IconBrandInstagram,
  IconSparkles,
  IconX,
  IconCopy,
  IconExternalLink,
  IconArrowRight,
  IconFilter,
  IconLayoutGrid,
  IconLayoutList,
  IconTrendingUp,
  IconEye,
  IconHeart,
  IconShare,
  IconDownload,
  IconPlayerPlay,
  IconPhoto,
  IconAd2,
  IconBrandTiktok,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";

import { searchAdLibrary } from "@/utils/api/windmill";

/***************************  CONSTANTS  ***************************/

const PLATFORM_COLORS = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  google: "#4285F4",
  tiktok: "#000000",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
};

const PLATFORM_ICONS = {
  facebook: IconBrandFacebook,
  instagram: IconBrandInstagram,
  google: IconBrandGoogle,
  tiktok: IconBrandTiktok,
};

const CATEGORIES = [
  { key: "all", label: "All Ads" },
  { key: "ecommerce", label: "E-commerce" },
  { key: "saas", label: "SaaS" },
  { key: "leadgen", label: "Lead Gen" },
  { key: "local", label: "Local Business" },
];

const HERO_VIDEO = "/videos/hero-ai-robot.mp4";
const APP_LINK = "https://play.google.com/store/apps/details?id=pro.marketingtool.app";

const IMG = "/images/ad-library/images";
const VID = "/images/ad-library/videos";

/***************************  SAMPLE ADS DATA  ***************************/

// SAMPLE_ADS removed. It was 1100 lines of invented ads (fake advertisers,
// fake spend such as $185,000, fake impressions) shown to every customer as
// if it were real ad-library data, and the trending row was always built
// from it. House rule: no demo or fake data, show zeros when there is none.
// Both empty states already existed in this file and now actually render.

/***************************  AD CARD (PREMIUM)  ***************************/

function AdCard({ ad, saved, onSave, onClick }) {
  const PlatformIcon = PLATFORM_ICONS[ad.platform];
  const videoRef = useRef(null);
  const hasVideo = Boolean(ad.video);

  const handleMouseEnter = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };
  const handleMouseLeave = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Card
      onClick={() => onClick(ad)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        cursor: "pointer",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: "0 12px 40px rgba(128,90,245,0.15)",
          transform: "translateY(-4px)",
        },
        "&:hover video": { opacity: 1 },
        "&:hover .ad-thumb-img": { opacity: hasVideo ? 0 : 1 },
      }}
    >
      {/* Image / Video */}
      <Box sx={{ height: 200, bgcolor: "grey.900", overflow: "hidden", position: "relative" }}>
        {/* Fallback thumbnail image */}
        {ad.thumbnail ? (
          <img
            className="ad-thumb-img"
            src={ad.thumbnail}
            alt=""
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "opacity 0.4s",
              position: hasVideo ? "absolute" : "relative",
              inset: 0,
              zIndex: 1,
            }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(128,90,245,0.06)",
            }}
          >
            <IconPhoto size={32} style={{ opacity: 0.2 }} />
          </Box>
        )}

        {/* Video (plays on hover) */}
        {hasVideo && (
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              position: "absolute",
              inset: 0,
              zIndex: 0,
              opacity: 0,
              transition: "opacity 0.4s",
            }}
          >
            <source src={ad.video} type="video/mp4" />
          </video>
        )}

        {/* Gradient overlay */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.5) 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Top bar */}
        <Stack
          direction="row"
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            {PlatformIcon && (
              <Box
                sx={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  bgcolor: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlatformIcon size={14} color={PLATFORM_COLORS[ad.platform]} />
              </Box>
            )}
            <Chip
              label={ad.platform}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.65rem",
                fontWeight: 600,
                textTransform: "capitalize",
                bgcolor: "rgba(0,0,0,0.55)",
                color: "white",
                backdropFilter: "blur(8px)",
                borderLeft: `3px solid ${PLATFORM_COLORS[ad.platform] || "#805AF5"}`,
              }}
            />
          </Stack>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onSave(ad.id);
            }}
            sx={{
              width: 28,
              height: 28,
              bgcolor: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              color: saved ? "#805AF5" : "white",
              "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
            }}
          >
            {saved ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} />}
          </IconButton>
        </Stack>

        {/* Bottom badges */}
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {ad.format && (
            <Chip
              icon={
                ad.format === "Video" || ad.format === "Reels" ? (
                  <IconPlayerPlay size={10} />
                ) : undefined
              }
              label={ad.format}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.6rem",
                bgcolor: "rgba(0,0,0,0.55)",
                color: "white",
                backdropFilter: "blur(8px)",
                "& .MuiChip-icon": { color: "white" },
              }}
            />
          )}
          {ad.impressions && (
            <Chip
              icon={<IconEye size={10} />}
              label={`${(ad.impressions / 1000000).toFixed(1)}M`}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.6rem",
                bgcolor: "rgba(0,0,0,0.55)",
                color: "white",
                backdropFilter: "blur(8px)",
                "& .MuiChip-icon": { color: "white" },
              }}
            />
          )}
        </Stack>
      </Box>

      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        {/* Advertiser */}
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
          <Box
            sx={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              fontSize: "0.55rem",
              fontWeight: 700,
              bgcolor: PLATFORM_COLORS[ad.platform] + "18",
              color: PLATFORM_COLORS[ad.platform],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {ad.advertiser?.[0]}
          </Box>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, fontSize: "0.7rem", color: "text.secondary" }}
          >
            {ad.advertiser}
          </Typography>
          {ad.country && (
            <Typography
              variant="caption"
              sx={{ fontSize: "0.6rem", color: "text.disabled", ml: "auto" }}
            >
              {ad.country}
            </Typography>
          )}
        </Stack>

        {/* Headline */}
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            mb: 0.5,
            letterSpacing: "-0.01em",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.4,
          }}
        >
          {ad.headline || ad.title || "Untitled Ad"}
        </Typography>

        {/* Body */}
        {ad.body && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.5,
              mb: 1.5,
            }}
          >
            {ad.body}
          </Typography>
        )}

        {/* Meta row */}
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Stack direction="row" spacing={0.5}>
            {ad.ctr && (
              <Chip
                label={`${ad.ctr}% CTR`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  bgcolor: "rgba(16,185,129,0.08)",
                  color: "#10B981",
                }}
              />
            )}
          </Stack>
          {ad.cta && (
            <Chip
              label={ad.cta}
              size="small"
              sx={{
                height: 20,
                fontSize: "0.6rem",
                bgcolor: "rgba(128,90,245,0.08)",
                color: "primary.main",
                fontWeight: 600,
              }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/***************************  TRENDING CARD (HORIZONTAL)  ***************************/

function TrendingCard({ ad, onClick }) {
  return (
    <Card
      onClick={() => onClick(ad)}
      sx={{
        minWidth: 280,
        maxWidth: 280,
        cursor: "pointer",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        overflow: "hidden",
        flexShrink: 0,
        scrollSnapAlign: "start",
        transition: "all 0.3s",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: "0 8px 28px rgba(128,90,245,0.12)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box sx={{ height: 140, position: "relative", overflow: "hidden" }}>
        <img
          src={ad.thumbnail}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.6) 100%)",
          }}
        />
        <Stack direction="row" spacing={0.5} sx={{ position: "absolute", bottom: 8, left: 8 }}>
          <Chip
            label={ad.platform}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.6rem",
              fontWeight: 600,
              textTransform: "capitalize",
              bgcolor: "rgba(0,0,0,0.6)",
              color: "white",
              backdropFilter: "blur(8px)",
            }}
          />
          <Chip
            label={ad.format}
            size="small"
            sx={{
              height: 20,
              fontSize: "0.6rem",
              bgcolor: "rgba(0,0,0,0.6)",
              color: "white",
              backdropFilter: "blur(8px)",
            }}
          />
        </Stack>
        <Chip
          icon={<IconTrendingUp size={10} />}
          label="Trending"
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            height: 20,
            fontSize: "0.6rem",
            fontWeight: 600,
            bgcolor: "rgba(128,90,245,0.9)",
            color: "white",
            "& .MuiChip-icon": { color: "white" },
          }}
        />
      </Box>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: "0.65rem",
            color: "text.disabled",
            display: "block",
            mb: 0.25,
          }}
        >
          {ad.advertiser}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            fontSize: "0.8rem",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {ad.headline}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
          {ad.impressions && (
            <Typography variant="caption" sx={{ fontSize: "0.6rem", color: "text.disabled" }}>
              {(ad.impressions / 1000000).toFixed(1)}M views
            </Typography>
          )}
          {ad.ctr && (
            <Typography
              variant="caption"
              sx={{ fontSize: "0.6rem", color: "#10B981", fontWeight: 600 }}
            >
              {ad.ctr}% CTR
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/***************************  STAT CARD  ***************************/

function StatCard({ icon: Icon, label, value, color, trend }) {
  return (
    <Card sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, flex: 1 }}>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: `${color}12`,
              color,
            }}
          >
            <Icon size={20} />
          </Box>
          <Box>
            <Typography
              variant="h5"
              sx={{ fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em" }}
            >
              {value}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.7rem" }}>
                {label}
              </Typography>
              {trend && (
                <Typography
                  variant="caption"
                  sx={{ color: "#10B981", fontWeight: 700, fontSize: "0.6rem" }}
                >
                  {trend}
                </Typography>
              )}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/***************************  LOADING SKELETON  ***************************/

function LoadingGrid() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Card
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <Skeleton variant="rectangular" height={200} animation="wave" />
            <CardContent sx={{ p: 2 }}>
              <Skeleton width="35%" height={12} sx={{ mb: 0.75 }} animation="wave" />
              <Skeleton width="85%" height={16} sx={{ mb: 0.5 }} animation="wave" />
              <Skeleton width="65%" height={14} animation="wave" />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/***************************  AD DETAIL DIALOG  ***************************/

function AdDetailDialog({ ad, open, onClose, saved, onSave }) {
  if (!ad) return null;

  const PlatformIcon = PLATFORM_ICONS[ad.platform];

  const handleCopy = () => {
    const text = [ad.headline, ad.body, ad.cta].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Grid container>
          {/* Left: Visual */}
          {(ad.thumbnail || ad.video) && (
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  height: { xs: 260, md: "100%" },
                  minHeight: { md: 420 },
                  bgcolor: "grey.900",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {ad.video ? (
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  >
                    <source src={ad.video} type="video/mp4" />
                  </video>
                ) : (
                  <img
                    src={ad.thumbnail}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)",
                  }}
                />
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ position: "absolute", top: 12, left: 12 }}
                >
                  {ad.platform && (
                    <Chip
                      label={ad.platform}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        bgcolor: "rgba(0,0,0,0.55)",
                        color: "white",
                        backdropFilter: "blur(8px)",
                      }}
                    />
                  )}
                  {ad.format && (
                    <Chip
                      label={ad.format}
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: "0.65rem",
                        bgcolor: "rgba(0,0,0,0.55)",
                        color: "white",
                        backdropFilter: "blur(8px)",
                      }}
                    />
                  )}
                </Stack>
              </Box>
            </Grid>
          )}

          {/* Right: Details */}
          <Grid size={{ xs: 12, md: ad.thumbnail ? 7 : 12 }}>
            <Box sx={{ p: 3 }}>
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}
              >
                <Box sx={{ flex: 1, mr: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    {PlatformIcon && (
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          bgcolor: PLATFORM_COLORS[ad.platform] + "18",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <PlatformIcon size={16} color={PLATFORM_COLORS[ad.platform]} />
                      </Box>
                    )}
                    <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                      {ad.advertiser}
                    </Typography>
                    {ad.country && (
                      <Chip
                        label={ad.country}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.6rem" }}
                      />
                    )}
                  </Stack>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, mb: 1, lineHeight: 1.3, letterSpacing: "-0.02em" }}
                  >
                    {ad.headline || ad.title || "Untitled Ad"}
                  </Typography>
                  {ad.body && (
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {ad.body}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    onClick={() => onSave(ad.id)}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: saved ? "rgba(128,90,245,0.1)" : "transparent",
                    }}
                  >
                    {saved ? (
                      <IconBookmarkFilled size={18} color="#805AF5" />
                    ) : (
                      <IconBookmark size={18} />
                    )}
                  </IconButton>
                  <IconButton onClick={onClose} sx={{ width: 36, height: 36 }}>
                    <IconX size={18} />
                  </IconButton>
                </Stack>
              </Stack>

              {/* Tags */}
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap", mb: 3 }}>
                {ad.platform && (
                  <Chip label={ad.platform} size="small" sx={{ textTransform: "capitalize" }} />
                )}
                {ad.format && <Chip label={ad.format} size="small" variant="outlined" />}
                {ad.startDate && (
                  <Chip label={`Since ${ad.startDate}`} size="small" variant="outlined" />
                )}
                {ad.cta && <Chip label={ad.cta} size="small" color="primary" />}
                {ad.category && (
                  <Chip
                    label={ad.category}
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: "capitalize" }}
                  />
                )}
              </Stack>

              {/* Metrics */}
              {(ad.impressions || ad.spend || ad.ctr) && (
                <Grid container spacing={1.5} sx={{ mb: 3 }}>
                  {ad.impressions && (
                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: "rgba(128,90,245,0.04)",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ fontSize: "0.6rem", display: "block" }}
                        >
                          Impressions
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {(ad.impressions / 1000000).toFixed(1)}M
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {ad.ctr && (
                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: "rgba(16,185,129,0.04)",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ fontSize: "0.6rem", display: "block" }}
                        >
                          CTR
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#10B981" }}>
                          {ad.ctr}%
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {ad.spend && (
                    <Grid size={{ xs: 4 }}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: "rgba(239,68,68,0.04)",
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ fontSize: "0.6rem", display: "block" }}
                        >
                          Spend
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          ${(ad.spend / 1000).toFixed(0)}K
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              )}

              {/* Actions */}
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<IconSparkles size={14} />}
                  sx={{ borderRadius: 2 }}
                >
                  AI Analysis
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<IconCopy size={14} />}
                  sx={{ borderRadius: 2 }}
                  onClick={handleCopy}
                >
                  Copy Text
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<IconDownload size={14} />}
                  sx={{ borderRadius: 2 }}
                >
                  Save to Board
                </Button>
                {ad.url && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<IconExternalLink size={14} />}
                    sx={{ borderRadius: 2 }}
                    onClick={() => window.open(ad.url, "_blank")}
                  >
                    View Original
                  </Button>
                )}
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
}

/***************************  AD LIBRARY PAGE  ***************************/

export default function AdLibraryPage() {
  const [query, setQuery] = useState("");
  const [platformTab, setPlatformTab] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30d");
  const [loading, setLoading] = useState(false);
  const [apiResults, setApiResults] = useState(null);
  const [error, setError] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const [selectedAd, setSelectedAd] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const trendingRef = useRef(null);

  const platformTabs = ["all", "facebook", "instagram", "google"];

  // Search via API
  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchAdLibrary({
        query: q,
        platform: platformTabs[platformTab] !== "all" ? platformTabs[platformTab] : undefined,
        dateRange,
      });
      setApiResults(Array.isArray(data) ? data : data?.ads || data?.results || []);
    } catch (err) {
      const msg = err.message || "Search failed";
      if (msg.includes("404") || msg.includes("not found")) {
        setError("api_not_configured");
      } else {
        setError(msg);
      }
      setApiResults(null);
    } finally {
      setLoading(false);
    }
  }, [query, platformTab, dateRange]);

  const clearSearch = () => {
    setQuery("");
    setApiResults(null);
    setError(null);
  };

  const toggleSave = (id) => {
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Filter sample ads
  const activePlatform = platformTabs[platformTab];
  let filteredAds = apiResults ?? [];

  if (activePlatform !== "all") {
    filteredAds = filteredAds.filter((ad) => ad.platform === activePlatform);
  }
  if (categoryFilter !== "all") {
    filteredAds = filteredAds.filter((ad) => ad.category === categoryFilter);
  }
  if (showSaved) {
    filteredAds = filteredAds.filter((ad) => savedIds.includes(ad.id));
  }

  // If API results exist, show those instead
  const displayResults =
    apiResults !== null
      ? showSaved
        ? apiResults.filter((ad) => savedIds.includes(ad.id))
        : apiResults
      : null;

  // Trending: top 8 by impressions
  const trendingAds = [...(apiResults ?? [])]
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 8);

  const scrollTrending = (dir) => {
    if (trendingRef.current) {
      trendingRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  const isSearchMode = apiResults !== null;

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      {/* HERO SECTION WITH VIDEO */}
      <Card
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 4,
          overflow: "hidden",
          position: "relative",
          minHeight: { xs: 280, md: 320 },
        }}
      >
        {/* Background Video */}
        <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/images/ad-library/images/01b569fd1095ed0daf4f923864e685bc.png"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
          {/* Dark overlay for readability */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.7) 100%)",
            }}
          />
        </Box>

        <CardContent sx={{ p: { xs: 3, md: 4 }, position: "relative", zIndex: 1 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            alignItems={{ md: "center" }}
            justifyContent="space-between"
          >
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #805AF5 0%, #06b6d4 100%)",
                    boxShadow: "0 4px 12px rgba(128,90,245,0.4)",
                  }}
                >
                  <IconAd2 size={22} color="white" />
                </Box>
                <Box>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 800,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.1,
                      color: "white",
                    }}
                  >
                    Ad Library
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 0.25 }}>
                    Discover winning ads from top brands across platforms
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* QUICK STATS */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <StatCard icon={IconAd2} label="Ads Tracked" value="10K+" color="#805AF5" trend="+12%" />
        <StatCard
          icon={IconEye}
          label="Total Impressions"
          value="84M"
          color="#06b6d4"
          trend="+8%"
        />
        <StatCard
          icon={IconTrendingUp}
          label="Avg CTR"
          value="3.5%"
          color="#10B981"
          trend="+0.4%"
        />
        <StatCard
          icon={IconHeart}
          label="Saved Ads"
          value={String(savedIds.length)}
          color="#f43f5e"
        />
      </Stack>

      {/* ERROR STATES */}
      {error === "api_not_configured" && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Ad Library search is not configured yet. Showing sample ads below.
        </Alert>
      )}
      {error && error !== "api_not_configured" && (
        <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* SEARCH RESULTS MODE */}
      {isSearchMode && !loading && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                size="small"
                startIcon={<IconChevronLeft size={14} />}
                onClick={clearSearch}
                sx={{ borderRadius: 2 }}
              >
                Back to Library
              </Button>
              <Typography variant="body2" color="text.secondary">
                {displayResults?.length || 0} results for &ldquo;{query}&rdquo;
              </Typography>
            </Stack>
            <Button
              variant={showSaved ? "contained" : "outlined"}
              size="small"
              startIcon={showSaved ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} />}
              onClick={() => setShowSaved(!showSaved)}
              sx={{ borderRadius: 2 }}
            >
              Saved ({savedIds.length})
            </Button>
          </Stack>

          {displayResults && displayResults.length > 0 ? (
            <Grid container spacing={2}>
              {displayResults.map((ad, idx) => (
                <Grid key={ad.id || idx} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <AdCard
                    ad={ad}
                    saved={savedIds.includes(ad.id)}
                    onSave={toggleSave}
                    onClick={setSelectedAd}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <CardContent sx={{ py: 6, textAlign: "center" }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  No ads found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try a different search term or adjust your filters.
                </Typography>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* LOADING */}
      {loading && <LoadingGrid />}

      {/* BROWSE MODE (DEFAULT) */}
      {!isSearchMode && !loading && (
        <>
          {/* TRENDING SECTION */}
          <Box>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(239,68,68,0.08)",
                    color: "#ef4444",
                  }}
                >
                  <IconTrendingUp size={16} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Trending Now
                </Typography>
                <Chip
                  label="Hot"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    bgcolor: "rgba(239,68,68,0.08)",
                    color: "#ef4444",
                  }}
                />
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => scrollTrending(-1)}
                  sx={{ border: "1px solid", borderColor: "divider", width: 30, height: 30 }}
                >
                  <IconChevronLeft size={16} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => scrollTrending(1)}
                  sx={{ border: "1px solid", borderColor: "divider", width: 30, height: 30 }}
                >
                  <IconChevronRight size={16} />
                </IconButton>
              </Stack>
            </Stack>

            <Box
              ref={trendingRef}
              sx={{
                display: "flex",
                gap: 2,
                overflowX: "auto",
                pb: 1,
                scrollSnapType: "x mandatory",
                scrollBehavior: "smooth",
                "&::-webkit-scrollbar": { height: 4 },
                "&::-webkit-scrollbar-thumb": { bgcolor: "divider", borderRadius: 2 },
              }}
            >
              {trendingAds.map((ad) => (
                <TrendingCard key={ad.id} ad={ad} onClick={setSelectedAd} />
              ))}
            </Box>
          </Box>

          {/* BROWSE ALL SECTION */}
          <Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ sm: "center" }}
              spacing={1.5}
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(128,90,245,0.08)",
                    color: "#805AF5",
                  }}
                >
                  <IconLayoutGrid size={16} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
                  Browse Ads
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {filteredAds.length} ads
                </Typography>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant={showSaved ? "contained" : "outlined"}
                  size="small"
                  startIcon={
                    showSaved ? <IconBookmarkFilled size={14} /> : <IconBookmark size={14} />
                  }
                  onClick={() => setShowSaved(!showSaved)}
                  sx={{ borderRadius: 2 }}
                >
                  Saved ({savedIds.length})
                </Button>
              </Stack>
            </Stack>

            {/* Search bar */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
              <TextField
                placeholder="Search by brand, keyword, or industry..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                size="small"
                fullWidth
                sx={{
                  flex: 1,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2.5,
                    "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(128,90,245,0.1)" },
                  },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <IconSearch size={18} />
                      </InputAdornment>
                    ),
                    endAdornment: query && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={clearSearch}>
                          <IconX size={14} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={!query.trim() || loading}
                sx={{
                  borderRadius: 2.5,
                  minWidth: 100,
                  px: 3,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #805AF5 0%, #6366f1 100%)",
                }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : "Search"}
              </Button>
            </Stack>

            {/* Platform Tabs */}
            <Tabs
              value={platformTab}
              onChange={(_, v) => setPlatformTab(v)}
              sx={{
                mb: 2,
                minHeight: 36,
                "& .MuiTab-root": {
                  minHeight: 36,
                  py: 0,
                  px: 2,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textTransform: "none",
                  borderRadius: 2,
                },
                "& .MuiTabs-indicator": { borderRadius: 2, height: 3 },
              }}
            >
              <Tab label="All Platforms" />
              <Tab icon={<IconBrandFacebook size={14} />} iconPosition="start" label="Facebook" />
              <Tab icon={<IconBrandInstagram size={14} />} iconPosition="start" label="Instagram" />
              <Tab icon={<IconBrandGoogle size={14} />} iconPosition="start" label="Google" />
            </Tabs>

            {/* Category Chips */}
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap", mb: 2.5 }}>
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat.key}
                  label={cat.label}
                  size="small"
                  variant={categoryFilter === cat.key ? "filled" : "outlined"}
                  onClick={() => setCategoryFilter(cat.key)}
                  sx={{
                    cursor: "pointer",
                    height: 28,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    ...(categoryFilter === cat.key && {
                      bgcolor: "primary.main",
                      color: "white",
                      borderColor: "primary.main",
                    }),
                    "&:hover": { borderColor: "primary.main" },
                  }}
                />
              ))}
            </Stack>

            {/* Ads Grid */}
            {filteredAds.length > 0 ? (
              <Grid container spacing={2}>
                {filteredAds.map((ad) => (
                  <Grid key={ad.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <AdCard
                      ad={ad}
                      saved={savedIds.includes(ad.id)}
                      onSave={toggleSave}
                      onClick={setSelectedAd}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Card sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
                <CardContent sx={{ py: 6, textAlign: "center" }}>
                  {showSaved ? (
                    <>
                      <IconBookmark size={44} style={{ opacity: 0.12, marginBottom: 12 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        No saved ads
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Bookmark ads to save them here.
                      </Typography>
                    </>
                  ) : (
                    <>
                      <IconFilter size={44} style={{ opacity: 0.12, marginBottom: 12 }} />
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        No ads match your filters
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Try adjusting platform or category filters.
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </Box>
        </>
      )}

      {/* Detail Dialog */}
      <AdDetailDialog
        ad={selectedAd}
        open={Boolean(selectedAd)}
        onClose={() => setSelectedAd(null)}
        saved={selectedAd ? savedIds.includes(selectedAd.id) : false}
        onSave={toggleSave}
      />
    </Stack>
  );
}
