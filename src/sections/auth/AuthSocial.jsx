import PropTypes from "prop-types";
import { useState } from "react";

// @mui
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CardMedia from "@mui/material/CardMedia";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

// @project
import { APP_DEFAULT_PATH, AUTH_USER_KEY, SOCIAL_AUTH_PROVIDER } from "@/config";
import { SocialTypes } from "@/enum";
import { loginWithFacebook, loginWithGoogle } from "@/utils/api/auth";
import { authConfigManager } from "@/utils/authConfigManager";
import GetImagePath from "@/utils/GetImagePath";
import { useRouter } from "@/utils/navigation";

// @assets
import googleIcon from "@/assets/images/social/google.svg";
import instagramIcon from "@/assets/images/social/instagram.svg";

/***************************  SOCIAL BUTTON - DATA  ***************************/

const authButtons = [
  { label: "Google", icon: googleIcon, title: "Sign in with Google" },
  { label: "Instagram", icon: instagramIcon, title: "Sign in with Instagram" },
];

/***************************  AUTH - SOCIAL  ***************************/

export default function AuthSocial({ type = SocialTypes.VERTICAL, buttonSx }) {
  const router = useRouter();
  const [socialError, setSocialError] = useState("");

  async function socialLogin(label) {
    if (SOCIAL_AUTH_PROVIDER) {
      try {
        switch (label) {
          case "Google": {
            authConfigManager.setState({ socialProvider: "google" });

            const { data, error } = await loginWithGoogle();
            if (error) {
              setSocialError(error || "Something went wrong");
              return;
            }

            if (data) {
              localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
              router.replace(APP_DEFAULT_PATH);
            }

            return;
          }
          case "Instagram": {
            // Instagram login - clean redirect flow matching your specific requirements
            const FB_APP_ID = "1582682256320433";
            const IG_SCOPES =
              "instagram_basic,instagram_manage_insights,instagram_content_publish,instagram_manage_comments,pages_read_engagement,pages_show_list,business_management";
            const redirectUri = `${window.location.origin}/oauth/instagram-ads`;
            const state = crypto.randomUUID();
            sessionStorage.setItem("fb_ads_state", state);

            window.location.href =
              `https://www.facebook.com/v21.0/dialog/oauth?` +
              `client_id=${FB_APP_ID}` +
              `&redirect_uri=${encodeURIComponent(redirectUri)}` +
              `&scope=${encodeURIComponent(IG_SCOPES)}` +
              `&state=${state}` +
              `&response_type=token`;
            return;
          }
          case "Facebook": {
            authConfigManager.setState({ socialProvider: "facebook" });

            const { data: facebookData, error: facebookError } = await loginWithFacebook();
            if (facebookError) {
              setSocialError(facebookError || "Something went wrong");
              return;
            }

            if (facebookData) {
              localStorage.setItem(AUTH_USER_KEY, JSON.stringify(facebookData));
              router.replace(APP_DEFAULT_PATH);
            }

            return;
          }
          default:
            console.warn(`Unsupported social login provider: ${label}`);
        }
      } catch (error) {
        console.error("Social login error:", error);
        setSocialError("Social login failed. Please try again.");
      }
    }
  }

  return (
    <>
      <Stack direction={type === SocialTypes.VERTICAL ? "column" : "row"} sx={{ gap: 1 }}>
        {authButtons.map((item, index) => (
          <Button
            key={index}
            variant="outlined"
            fullWidth
            size="small"
            color="secondary"
            sx={{
              ...(type === SocialTypes.HORIZONTAL && { ".MuiButton-startIcon": { m: 0 } }),
              ...buttonSx,
            }}
            startIcon={
              <CardMedia
                component="img"
                src={GetImagePath(item.icon)}
                sx={{ width: 16, height: 16 }}
                alt={item.label}
              />
            }
            onClick={() => socialLogin(item.label)}
          >
            {type === SocialTypes.VERTICAL && (
              <Typography variant="caption1" sx={{ textTransform: "none" }}>
                {item.title}
              </Typography>
            )}
          </Button>
        ))}
      </Stack>
      {socialError && (
        <Alert sx={{ mt: 2 }} severity="error" variant="filled" icon={false}>
          {socialError}
        </Alert>
      )}
    </>
  );
}

AuthSocial.propTypes = {
  type: PropTypes.any,
  SocialTypes: PropTypes.any,
  VERTICAL: PropTypes.any,
  buttonSx: PropTypes.any,
};
