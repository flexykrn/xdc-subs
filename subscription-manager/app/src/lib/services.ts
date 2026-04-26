export interface ServiceTier {
  id: string;
  name: string;
  price: string;
  priceLabel: string;
  intervalDays: number;
  features: string[];
  planId: number;
}

export interface SubscriptionService {
  id: string;
  name: string;
  description: string;
  logo: string;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  tokenAddress: string;
  tiers: ServiceTier[];
  category: "streaming" | "music" | "ai" | "sports";
}

const netflixToken = process.env.NEXT_PUBLIC_NETFLIX_TOKEN_ADDRESS || "";
const spotifyToken = process.env.NEXT_PUBLIC_SPOTIFY_TOKEN_ADDRESS || "";
const youtubeToken = process.env.NEXT_PUBLIC_YOUTUBE_TOKEN_ADDRESS || "";
const jiohotstarToken = process.env.NEXT_PUBLIC_JIOHOTSTAR_TOKEN_ADDRESS || "";
const claudeToken = process.env.NEXT_PUBLIC_CLAUDE_TOKEN_ADDRESS || "";
const copilotToken = process.env.NEXT_PUBLIC_COPILOT_TOKEN_ADDRESS || "";

export const SERVICES: SubscriptionService[] = [
  {
    id: "netflix",
    name: "Netflix",
    description: "Watch award-winning TV shows, movies, and documentaries on any device.",
    logo: "/services/netflix.png",
    color: "#E50914",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-900",
    tokenAddress: netflixToken,
    category: "streaming",
    tiers: [
      {
        id: "netflix-mobile",
        name: "Mobile",
        price: "5000000000000000000",
        priceLabel: "5 NFX",
        intervalDays: 30,
        features: ["480p streaming", "1 device", "Mobile & tablet only"],
        planId: 1,
      },
      {
        id: "netflix-basic",
        name: "Basic",
        price: "10000000000000000000",
        priceLabel: "10 NFX",
        intervalDays: 30,
        features: ["720p HD", "1 device", "All content"],
        planId: 2,
      },
      {
        id: "netflix-standard",
        name: "Standard",
        price: "20000000000000000000",
        priceLabel: "20 NFX",
        intervalDays: 30,
        features: ["1080p Full HD", "2 devices", "Spatial audio"],
        planId: 3,
      },
    ],
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Stream millions of songs, podcasts, and audiobooks ad-free.",
    logo: "/services/spotify.png",
    color: "#1DB954",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-900",
    tokenAddress: spotifyToken,
    category: "music",
    tiers: [
      {
        id: "spotify-mini",
        name: "Mini",
        price: "1000000000000000000",
        priceLabel: "1 SPF",
        intervalDays: 7,
        features: ["Ad-free on mobile", "30 skips/day", "Offline up to 30 songs"],
        planId: 4,
      },
      {
        id: "spotify-individual",
        name: "Individual",
        price: "8000000000000000000",
        priceLabel: "8 SPF",
        intervalDays: 30,
        features: ["Ad-free everywhere", "Offline playback", "High quality audio"],
        planId: 5,
      },
      {
        id: "spotify-family",
        name: "Family",
        price: "15000000000000000000",
        priceLabel: "15 SPF",
        intervalDays: 30,
        features: ["6 accounts", "Parental controls", "Blend playlists"],
        planId: 6,
      },
    ],
  },
  {
    id: "youtube",
    name: "YouTube Premium",
    description: "Ad-free videos, background play, and YouTube Music included.",
    logo: "/services/yt.png",
    color: "#FF0000",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    textColor: "text-red-900",
    tokenAddress: youtubeToken,
    category: "streaming",
    tiers: [
      {
        id: "yt-individual",
        name: "Individual",
        price: "7000000000000000000",
        priceLabel: "7 YTB",
        intervalDays: 30,
        features: ["Ad-free videos", "Background play", "Downloads"],
        planId: 7,
      },
      {
        id: "yt-family",
        name: "Family",
        price: "13000000000000000000",
        priceLabel: "13 YTB",
        intervalDays: 30,
        features: ["6 family members", "YouTube Music Premium", "Kids app"],
        planId: 8,
      },
    ],
  },
  {
    id: "jiohotstar",
    name: "JioHotstar",
    description: "Live sports, IPL, movies, and TV shows in multiple languages.",
    logo: "/services/jiohotstar.png",
    color: "#1F80E0",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-900",
    tokenAddress: jiohotstarToken,
    category: "sports",
    tiers: [
      {
        id: "jh-mobile",
        name: "Mobile",
        price: "3000000000000000000",
        priceLabel: "3 JHS",
        intervalDays: 30,
        features: ["Live sports", "HD on mobile", "Ad-supported movies"],
        planId: 9,
      },
      {
        id: "jh-super",
        name: "Super",
        price: "6000000000000000000",
        priceLabel: "6 JHS",
        intervalDays: 30,
        features: ["All devices", "Full HD", "Dolby Atmos"],
        planId: 10,
      },
      {
        id: "jh-premium",
        name: "Premium",
        price: "12000000000000000000",
        priceLabel: "12 JHS",
        intervalDays: 30,
        features: ["4K UHD", "4 screens", "Disney+ content"],
        planId: 11,
      },
    ],
  },
  {
    id: "claude",
    name: "Claude Code",
    description: "AI-powered coding assistant that writes, debugs, and explains code.",
    logo: "/services/claude code.png",
    color: "#CC785C",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-900",
    tokenAddress: claudeToken,
    category: "ai",
    tiers: [
      {
        id: "claude-pro",
        name: "Pro",
        price: "25000000000000000000",
        priceLabel: "25 CLA",
        intervalDays: 30,
        features: ["5x more usage", "Claude 3.5 Sonnet", "Priority bandwidth"],
        planId: 12,
      },
      {
        id: "claude-team",
        name: "Team",
        price: "35000000000000000000",
        priceLabel: "35 CLA",
        intervalDays: 30,
        features: ["Shared projects", "Admin console", "SSO & audit logs"],
        planId: 13,
      },
      {
        id: "claude-enterprise",
        name: "Enterprise",
        price: "50000000000000000000",
        priceLabel: "50 CLA",
        intervalDays: 30,
        features: ["Unlimited usage", "Custom models", "Dedicated support", "SLA guarantee"],
        planId: 16,
      },
    ],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    description: "AI pair programmer that suggests code as you type in real-time.",
    logo: "/services/copliot.png",
    color: "#2D2D2D",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    textColor: "text-slate-900",
    tokenAddress: copilotToken,
    category: "ai",
    tiers: [
      {
        id: "copilot-individual",
        name: "Individual",
        price: "12000000000000000000",
        priceLabel: "12 COP",
        intervalDays: 30,
        features: ["Unlimited suggestions", "Code completion", "Chat in IDE"],
        planId: 14,
      },
      {
        id: "copilot-business",
        name: "Business",
        price: "22000000000000000000",
        priceLabel: "22 COP",
        intervalDays: 30,
        features: ["Code review", "Knowledge bases", "Policy management"],
        planId: 15,
      },
      {
        id: "copilot-enterprise",
        name: "Enterprise",
        price: "35000000000000000000",
        priceLabel: "35 COP",
        intervalDays: 30,
        features: ["Org-wide deployment", "Custom policies", "Advanced analytics", "Priority support"],
        planId: 17,
      },
    ],
  },
];

export function getServiceById(id: string): SubscriptionService | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function getServiceByPlanId(planId: number): SubscriptionService | undefined {
  return SERVICES.find((s) => s.tiers.some((t) => t.planId === planId));
}

export function getTierByPlanId(planId: number): { service: SubscriptionService; tier: ServiceTier } | undefined {
  for (const service of SERVICES) {
    const tier = service.tiers.find((t) => t.planId === planId);
    if (tier) {
      return { service, tier };
    }
  }
  return undefined;
}

export function getServiceLogo(id: string): string {
  const service = getServiceById(id);
  return service?.logo || "";
}

export function getServiceName(id: string): string {
  const service = getServiceById(id);
  return service?.name || id;
}
