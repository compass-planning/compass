/**
 * CompassLogo — SVG brand mark shared by the Compass product family.
 *
 * Same compass icon and wordmark as Compass Planning; the product label under
 * "COMPASS" changes ("CRM" or "PLANNING").
 *
 * Variants:
 *   "full"    — icon + wordmark lockup (auth pages, wide areas)
 *   "sidebar" — compact icon + stacked wordmark (sidebar header)
 *   "icon"    — icon only (collapsed sidebar, favicon-style)
 */
import { useId } from "react";

export type CompassProduct = "crm" | "planning" | "family";

interface Props {
  variant?: "full" | "sidebar" | "icon";
  /** Product label under COMPASS ("family" shows the bare brand, no label). Defaults to "crm". */
  product?: CompassProduct;
  /** Optional small caption beneath the wordmark, e.g. "Advisor Edition" */
  edition?: string;
  /** Use a white wordmark for dark backgrounds */
  light?: boolean;
  /** Icon size in px for the "icon" variant (default 40) */
  size?: number;
  className?: string;
}

const PRODUCT_LABEL: Record<CompassProduct, string> = {
  crm: "CRM",
  planning: "PLANNING",
  family: "",
};
const PRODUCT_NAME: Record<CompassProduct, string> = {
  crm: "Compass CRM",
  planning: "Compass Planning",
  family: "Compass",
};

function CompassIcon({ gradientId }: { gradientId: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible", width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0052FF" />
          <stop offset="100%" stopColor="#00DF89" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="100" cy="100" r="85" fill="none" stroke={`url(#${gradientId})`} strokeWidth="12" />
      {/* Cardinal ticks */}
      <line x1="100" y1="28" x2="100" y2="44" stroke="#0052FF" strokeWidth="7" strokeLinecap="round" />
      <line x1="100" y1="156" x2="100" y2="172" stroke="#A3AED0" strokeWidth="5" strokeLinecap="round" />
      <line x1="28" y1="100" x2="44" y2="100" stroke="#A3AED0" strokeWidth="5" strokeLinecap="round" />
      <line x1="156" y1="100" x2="172" y2="100" stroke="#A3AED0" strokeWidth="5" strokeLinecap="round" />
      {/* Compass needle — growth direction */}
      <polygon points="100,100 148,52 122,42" fill={`url(#${gradientId})`} />
      <polygon points="100,100 52,148 78,158" fill="#A3AED0" opacity="0.4" />
      {/* Centre pin */}
      <circle cx="100" cy="100" r="11" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="6" fill="#0052FF" />
    </svg>
  );
}

export function CompassLogo({
  variant = "full",
  product = "crm",
  edition,
  light = false,
  size = 40,
  className = "",
}: Props) {
  // useId() yields ":r1:"-style ids; strip colons so url(#id) is always valid.
  const gradientId = `cpGrad-${useId().replace(/:/g, "")}`;
  const wordmarkColor = light ? "#FFFFFF" : "#1B2559";
  const label = PRODUCT_LABEL[product];
  const accessibleName = PRODUCT_NAME[product];

  if (variant === "icon") {
    return (
      <div
        role="img"
        aria-label={accessibleName}
        className={`flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <CompassIcon gradientId={gradientId} />
      </div>
    );
  }

  const isSidebar = variant === "sidebar";
  const iconPx = isSidebar ? 36 : 56;

  return (
    <div role="img" aria-label={accessibleName} className={`flex items-center ${isSidebar ? "gap-2.5" : "gap-4"} ${className}`}>
      <div style={{ width: iconPx, height: iconPx, flexShrink: 0 }}>
        <CompassIcon gradientId={gradientId} />
      </div>
      <div>
        <div
          style={{
            fontFamily: "'Inter', 'Montserrat', 'Segoe UI', sans-serif",
            fontWeight: 800,
            fontSize: isSidebar ? 15 : 28,
            color: wordmarkColor,
            letterSpacing: isSidebar ? "-0.3px" : "-0.5px",
            lineHeight: 1,
          }}
        >
          COMPASS
        </div>
        {label && (
          <div
            style={{
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              fontWeight: 400,
              fontSize: isSidebar ? 9 : 16,
              color: "#00DF89",
              letterSpacing: isSidebar ? "3px" : "6px",
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            {label}
          </div>
        )}
        {edition && (
          <div
            style={{
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              fontWeight: 600,
              fontSize: isSidebar ? 8 : 10,
              color: "#A3AED0",
              letterSpacing: isSidebar ? "2px" : "3px",
              textTransform: "uppercase",
              marginTop: isSidebar ? 3 : 4,
            }}
          >
            {edition}
          </div>
        )}
      </div>
    </div>
  );
}

export default CompassLogo;
