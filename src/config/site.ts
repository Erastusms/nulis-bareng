export const siteConfig = {
  name: "NulisBareng",
  description: "A modern, collaborative real-time workspace for teams, boards, and documents.",
  links: {
    github: "https://github.com/example/nulis-bareng",
    docs: "/docs",
  },
  navigation: [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Workspaces", href: "/workspaces" },
    { title: "Documents", href: "/documents" },
    { title: "Settings", href: "/settings" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
