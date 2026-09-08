import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({ title: "Sign In", path: "/sign-in" }),
  robots: { index: false, follow: false },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
