import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { AuthProvider } from "@/components/AuthContext";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AA Subs - Gasless Web3 Subscriptions",
  description: "Account Abstraction subscription manager with social login, gasless transactions, and automated renewals on XDC Network.",
  keywords: ["web3", "account abstraction", "subscriptions", "gasless", "xdc", "etherspot", "web3auth"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <NavBar />
          <main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-slate-200 bg-slate-50 py-6">
            <div className="mx-auto max-w-5xl px-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">AA Subs</p>
                <p className="text-xs text-slate-500">Gasless Web3 subscriptions on XDC</p>
              </div>
              <div className="flex gap-4 text-xs text-slate-500">
                <span>Web3Auth MPC</span>
                <span>•</span>
                <span>Etherspot ERC-7579</span>
                <span>•</span>
                <span>Arka Paymaster</span>
              </div>
              <p className="text-xs text-slate-400">Testnet Demo • Apothem Network</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
