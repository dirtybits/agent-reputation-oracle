import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({ title: "Connect Account", path: "/auth/callback" }),
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
