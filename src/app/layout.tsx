import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CPoint PMS", template: "%s · CPoint PMS" },
  description: "Product Monitoring System for CPoint Shoe Store Corporation",
};

// Runs before first paint: saved choice wins, otherwise follow the OS. Keep the key in sync
// with THEME_STORAGE_KEY in components/theme-toggle.tsx.
const themeScript = `(function(){try{var t=localStorage.getItem("cpoint-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
