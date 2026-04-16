import "./globals.css";

export const metadata = {
  title: "Coffee Discovery — Find Your Perfect Single-Origin",
  description:
    "Explore single-origin coffees from around the world. AI-powered recommendations matched to your taste preferences.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
