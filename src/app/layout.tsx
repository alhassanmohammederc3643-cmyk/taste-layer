export const metadata = { title: "Taste Layer for agents", description: "Qloo-grounded taste for any agent." };
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#0f1115", color: "#e8e8ea" }}>{children}</body>
    </html>
  );
}
