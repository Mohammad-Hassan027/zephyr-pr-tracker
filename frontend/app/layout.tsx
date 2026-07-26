import "./globals.css";

export const metadata = {
  title: "Zephyr PR Tracker",
  description: "Event participation & referral tracking for Zephyr PR team",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-ink font-body antialiased">{children}</body>
    </html>
  );
}
