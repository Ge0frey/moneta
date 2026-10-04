"use client";

/** Root-layout failures render their own document (no globals.css), so styles here are inline and minimal. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#000",
          color: "#fff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
        }}
      >
        <title>Moneta · Error</title>
        <main role="alert" style={{ maxWidth: 520, padding: 24 }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 12,
              color: "#8a8a8a",
              margin: 0,
            }}
          >
            MONETA
          </p>
          <h1
            style={{
              fontSize: 40,
              lineHeight: "44px",
              fontWeight: 400,
              letterSpacing: "-0.02em",
              margin: "12px 0",
            }}
          >
            The app failed to load.
          </h1>
          <p style={{ color: "#a3a3a3", fontSize: 15, lineHeight: "22px" }}>
            Your funds are unaffected. Everything lives on-chain.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              height: 40,
              padding: "0 20px",
              borderRadius: 999,
              border: 0,
              background: "#fafafa",
              color: "#000",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
