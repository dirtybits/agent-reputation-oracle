import type { Metadata } from "next";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE_PATH,
  SITE_TAGLINE,
  SITE_TWITTER_IMAGE_PATH,
  getCanonicalUrl,
  truncateDescription,
} from "@/lib/site";

type BuildMetadataParams = {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
};

export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  keywords = [],
}: BuildMetadataParams): Metadata {
  const normalizedDescription = truncateDescription(description);
  const canonical = getCanonicalUrl(path);
  const ogImage = getCanonicalUrl(SITE_OG_IMAGE_PATH);
  const twitterImage = getCanonicalUrl(SITE_TWITTER_IMAGE_PATH);

  return {
    title,
    description: normalizedDescription,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description: normalizedDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} social card`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: normalizedDescription,
      images: [twitterImage],
    },
  };
}

export function buildDefaultMetadata(): Metadata {
  const googleVerification =
    process.env.GOOGLE_SITE_VERIFICATION ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

  return {
    metadataBase: new URL(getCanonicalUrl("/")),
    title: {
      default: `${SITE_NAME} | ${SITE_TAGLINE}`,
      template: `%s | ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    alternates: {
      canonical: getCanonicalUrl("/"),
    },
    openGraph: {
      type: "website",
      url: getCanonicalUrl("/"),
      siteName: SITE_NAME,
      title: `${SITE_NAME} | ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: getCanonicalUrl(SITE_OG_IMAGE_PATH),
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} social card`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} | ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      images: [getCanonicalUrl(SITE_TWITTER_IMAGE_PATH)],
    },
    verification: googleVerification
      ? {
          google: googleVerification,
        }
      : undefined,
  };
}
