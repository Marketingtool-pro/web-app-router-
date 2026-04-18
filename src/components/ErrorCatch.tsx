import * as React from "react";
import { ErrorComponentProps } from "@tanstack/react-router";
import Error500 from "@/components/Error500";
import { Box, Typography, Button, Container, Stack } from "@mui/material";

export function ErrorCatch({ error, reset }: ErrorComponentProps) {
  React.useEffect(() => {
    console.error("Application Error:", error);
  }, [error]);

  const errorMessage =
    error instanceof Error ? error.message : String(error || "Unknown application error");

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Error500
        heading={errorMessage}
        primaryBtn={{
          children: "Try Again",
          onClick: () => {
            // Clear any local caches that might be causing the error
            if (typeof window !== "undefined") {
              // Optional: localStorage.removeItem('some-problematic-key');
            }
            reset();
          },
        }}
      />

      {/* Developer fallback if Error500 fails to render or for detailed debugging */}
      <Container maxWidth="md" sx={{ mt: -10, mb: 10, position: "relative", zIndex: 10 }}>
        <Stack
          spacing={2}
          sx={{
            p: 3,
            bgcolor: "rgba(255,0,0,0.05)",
            borderRadius: 2,
            border: "1px solid rgba(255,0,0,0.1)",
          }}
        >
          <Typography variant="h6" color="error">
            Technical Details
          </Typography>
          <Typography
            variant="body2"
            component="pre"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              fontFamily: "monospace",
              p: 2,
              bgcolor: "background.paper",
              borderRadius: 1,
            }}
          >
            {errorMessage}
          </Typography>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Hard Refresh
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

export default ErrorCatch;
