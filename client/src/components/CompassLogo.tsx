/**
 * CompassLogo — SVG brand mark for Compass Planning.
 *
 * Variants:
 *   "full"    — icon + "COMPASS" + "PLANNING" wordmark (login panel, wide areas)
 *   "sidebar" — icon + stacked text (sidebar header, compact areas)
 *   "icon"    — icon only (favicon-style, mobile)
 */

interface Props {
  variant?: "full" | "sidebar" | "icon";
  /** Sub-label beneath the wordmark, e.g. "Advisor Edition" */
  edition?: string;
  /** Use white wordmark text for dark backgrounds */
  light?: boolean;
  className?: string;
}

export function CompassLogo({ variant = "full", edition, light = false, className = "" }: Props) {
  const wordmarkColor = light ? "#FFFFFF" : "#1B2559";
  const icon = (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="cpGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0052FF" />
          <stop offset="100%" stopColor="#00DF89" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="100" cy="100" r="85" fill="none" stroke="url(#cpGrad)" strokeWidth="12" />
      {/* Cardinal ticks */}
      <line x1="100" y1="28"  x2="100" y2="44"  stroke="#0052FF" strokeWidth="7" strokeLinecap="round" />
      <line x1="100" y1="156" x2="100" y2="172" stroke="#A3AED0" strokeWidth="5" strokeLinecap="round" />
      <line x1="28"  y1="100" x2="44"  y2="100" stroke="#A3AED0" strokeWidth="5" strokeLinecap="round" />
      <line x1="156" y1="100" x2="172" y2="100" stroke="#A3AED0" strokeWidth="5" strokeLinecap="round" />
      {/* Compass needle — growth direction */}
      <polygon points="100,100 148,52 122,42" fill="url(#cpGrad)" />
      <polygon points="100,100 52,148 78,158"  fill="#A3AED0" opacity="0.4" />
      {/* Centre pin */}
      <circle cx="100" cy="100" r="11" fill="#FFFFFF" />
      <circle cx="100" cy="100" r="6"  fill="#0052FF" />
    </svg>
  );

  if (variant === "icon") {
    return (
      <div className={`flex-shrink-0 ${className}`} style={{ width: 40, height: 40 }}>
        {icon}
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        <div style={{ width: 36, height: 36, flexShrink: 0 }}>{icon}</div>
        <div>
          <div
            style={{
              fontFamily: "'Inter', 'Montserrat', 'Segoe UI', sans-serif",
              fontWeight: 800,
              fontSize: 15,
              color: wordmarkColor,
              letterSpacing: "-0.3px",
              lineHeight: 1,
            }}
          >
            COMPASS
          </div>
          <div
            style={{
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              fontWeight: 400,
              fontSize: 9,
              color: "#00DF89",
              letterSpacing: "3px",
              lineHeight: 1,
              marginTop: 2,
            }}
          >
            PLANNING
          </div>
          {edition && (
            <div
              style={{
                fontFamily: "'Inter', 'Segoe UI', sans-serif",
                fontWeight: 600,
                fontSize: 8,
                color: "#A3AED0",
                letterSpacing: "2px",
                textTransform: "uppercase",
                marginTop: 3,
              }}
            >
              {edition}
            </div>
          )}
        </div>
      </div>
    );
  }

  // "full" — horizontal lockup for login panel / wide areas
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div style={{ width: 56, height: 56, flexShrink: 0 }}>{icon}</div>
      <div>
        <div
          style={{
            fontFamily: "'Inter', 'Montserrat', 'Segoe UI', sans-serif",
            fontWeight: 800,
            fontSize: 28,
            color: wordmarkColor,
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}
        >
          COMPASS
        </div>
        <div
          style={{
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            fontWeight: 400,
            fontSize: 16,
            color: "#00DF89",
            letterSpacing: "6px",
            lineHeight: 1,
            marginTop: 2,
          }}
        >
          PLANNING
        </div>
        {edition && (
          <div
            style={{
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              fontWeight: 600,
              fontSize: 10,
              color: "#A3AED0",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            {edition}
          </div>
        )}
      </div>
    </div>
  );
}
