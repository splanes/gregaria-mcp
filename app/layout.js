export const metadata = {
  title: "gregaria · MCP",
  description: "Connect Claude to Intervals.icu",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0b0d10",
          color: "#e8eaed",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  )
}
