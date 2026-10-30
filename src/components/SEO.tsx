import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  imageAlt?: string;
  url?: string;
  type?: string;
  noIndex?: boolean;
  structuredData?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const DEFAULT_SEO = {
  title: "Diagramwise — Design architectures. Get them reviewed.",
  description:
    "Practice system design by building architectures visually, explaining your assumptions, and getting structured feedback on scalability, reliability, data design, and trade-offs.",
  keywords:
    "system design, architecture diagram, system design interview, software architecture, distributed systems, scalable architecture",
  image: "https://diagramwise.com/og/home.png",
  imageAlt: "Diagramwise homepage preview",
  url: "https://diagramwise.com/",
  type: "website",
};

const normalizeCanonicalUrl = (value: string): string => {
  try {
    const canonical = new URL(value);
    const pathSegments = canonical.pathname.split("/");
    const lastSegment = pathSegments.findLast(Boolean);
    const isFile = lastSegment?.includes(".") ?? false;

    if (
      canonical.pathname !== "/" &&
      !canonical.pathname.endsWith("/") &&
      !isFile
    ) {
      canonical.pathname = `${canonical.pathname}/`;
    }

    return canonical.toString();
  } catch {
    return value;
  }
};

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  image,
  imageAlt,
  url,
  type = "website",
  noIndex = false,
  structuredData,
}) => {
  const canonicalUrl = normalizeCanonicalUrl(url || DEFAULT_SEO.url);
  const structuredDataJson = structuredData
    ? JSON.stringify(structuredData).replaceAll("<", String.raw`\u003c`)
    : "";

  useEffect(() => {
    // Update document title
    document.title = title || DEFAULT_SEO.title;

    // Update meta tags
    const updateMetaTag = (
      name: string,
      content: string,
      isProperty = false,
    ) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(
        `meta[${attribute}="${name}"]`,
      ) as HTMLMetaElement;

      if (element) {
        element.content = content;
      } else {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        element.content = content;
        document.head.appendChild(element);
      }
    };

    // Standard meta tags
    updateMetaTag("title", title || DEFAULT_SEO.title);
    updateMetaTag("description", description || DEFAULT_SEO.description);
    updateMetaTag("keywords", keywords || DEFAULT_SEO.keywords);
    updateMetaTag(
      "robots",
      noIndex
        ? "noindex, follow"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    );

    // Open Graph tags
    updateMetaTag("og:title", title || DEFAULT_SEO.title, true);
    updateMetaTag(
      "og:description",
      description || DEFAULT_SEO.description,
      true,
    );
    updateMetaTag("og:image", image || DEFAULT_SEO.image, true);
    updateMetaTag("og:image:alt", imageAlt || title || DEFAULT_SEO.title, true);
    updateMetaTag("og:url", canonicalUrl, true);
    updateMetaTag("og:type", type, true);

    // Twitter tags
    updateMetaTag("twitter:title", title || DEFAULT_SEO.title);
    updateMetaTag(
      "twitter:description",
      description || DEFAULT_SEO.description,
    );
    updateMetaTag("twitter:image", image || DEFAULT_SEO.image);
    updateMetaTag("twitter:image:alt", imageAlt || title || DEFAULT_SEO.title);
    updateMetaTag("twitter:url", canonicalUrl);

    // Update canonical link
    let canonical = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement;
    if (canonical) {
      canonical.href = canonicalUrl;
    } else {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = canonicalUrl;
      document.head.appendChild(canonical);
    }
  }, [
    title,
    description,
    keywords,
    image,
    imageAlt,
    canonicalUrl,
    type,
    noIndex,
  ]);

  useEffect(() => {
    const id = "page-structured-data";
    const existing = document.getElementById(id);

    // The prerendered HTML already carries this route's structured data. Keep
    // it instead of adding a duplicate; on client-side navigation to another
    // route, drop the stale copy and fall through to the page's own data.
    const prerendered = document.getElementById("route-structured-data");
    if (prerendered) {
      if (prerendered.textContent?.includes(`"@id":"${canonicalUrl}"`)) {
        existing?.remove();
        return;
      }
      prerendered.remove();
    }

    if (!structuredDataJson) {
      existing?.remove();
      return;
    }

    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.textContent = structuredDataJson;
    if (!script.isConnected) document.head.appendChild(script);

    return () => script.remove();
  }, [structuredDataJson, canonicalUrl]);

  return null;
};

export default SEO;
