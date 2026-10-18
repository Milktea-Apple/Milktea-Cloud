export function CupArt({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 520"
      className={className}
      role="img"
      aria-label="一杯插着吸管的奶茶"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cupCream" x1="180" y1="190" x2="220" y2="480" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF9EF" />
          <stop offset="0.65" stopColor="#F7E8D4" />
          <stop offset="1" stopColor="#EDD7BC" />
        </linearGradient>
        <linearGradient id="cupTea" x1="210" y1="300" x2="210" y2="462" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D6A26A" />
          <stop offset="1" stopColor="#B87A45" />
        </linearGradient>
        <linearGradient id="cupStraw" x1="260" y1="30" x2="290" y2="190" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E2AC74" />
          <stop offset="1" stopColor="#C4864B" />
        </linearGradient>
        <linearGradient id="cupLid" x1="130" y1="160" x2="290" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFDF8" />
          <stop offset="1" stopColor="#EFE0CC" />
        </linearGradient>
        <radialGradient id="cupShadow" cx="0.5" cy="0.5" r="0.5">
          <stop stopColor="#8A5C33" stopOpacity="0.25" />
          <stop offset="1" stopColor="#8A5C33" stopOpacity="0" />
        </radialGradient>
        <clipPath id="cupClip">
          <path d="M118 196h184l-15.5 248.5c-.6 10.2-9.2 18-19.4 18h-114.2c-10.2 0-18.8-7.8-19.4-18L118 196Z" />
        </clipPath>
        <filter id="cupBlur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="15" />
        </filter>
      </defs>

      <ellipse cx="210" cy="478" rx="150" ry="34" fill="url(#cupShadow)" filter="url(#cupBlur)" />
      <ellipse cx="210" cy="200" rx="128" ry="56" fill="#FFF6E8" opacity="0.42" filter="url(#cupBlur)" />

      {/* straw */}
      <g transform="rotate(8 285 120)">
        <rect x="274" y="24" width="25" height="190" rx="12.5" fill="url(#cupStraw)" />
        <rect x="274" y="24" width="8" height="190" rx="4" fill="#F0C08B" opacity="0.6" />
        <rect x="286" y="24" width="4" height="190" fill="#A96831" opacity="0.35" />
      </g>

      {/* lid */}
      <ellipse cx="210" cy="184" rx="108" ry="26" fill="#E4CEB2" />
      <rect x="102" y="164" width="216" height="24" rx="12" fill="url(#cupLid)" />
      <ellipse cx="210" cy="164" rx="108" ry="24" fill="#FFFCF5" />
      <ellipse cx="210" cy="163" rx="88" ry="15" fill="#F3E3CF" opacity="0.6" />

      {/* cup body */}
      <path
        d="M118 196h184l-15.5 248.5c-.6 10.2-9.2 18-19.4 18h-114.2c-10.2 0-18.8-7.8-19.4-18L118 196Z"
        fill="url(#cupCream)"
      />
      <g clipPath="url(#cupClip)">
        <path d="M92 316h236v190H92z" fill="url(#cupTea)" />
        <ellipse cx="210" cy="318" rx="128" ry="20" fill="#E0B37D" />
        <ellipse cx="210" cy="318" rx="128" ry="9" fill="#F2CE9F" opacity="0.65" />

        {/* boba */}
        <g fill="#4A2C1A">
          <circle cx="158" cy="424" r="14" />
          <circle cx="196" cy="440" r="15" />
          <circle cx="238" cy="428" r="14.5" />
          <circle cx="268" cy="446" r="12" />
          <circle cx="176" cy="460" r="12.5" />
          <circle cx="216" cy="462" r="13" />
          <circle cx="250" cy="461" r="11" />
          <circle cx="140" cy="450" r="10" />
        </g>
        <g fill="#7B4B2B" opacity="0.55">
          <circle cx="154" cy="419" r="4" />
          <circle cx="192" cy="435" r="4.2" />
          <circle cx="234" cy="423" r="4" />
          <circle cx="172" cy="455" r="3.4" />
          <circle cx="212" cy="457" r="3.6" />
        </g>

        {/* label */}
        <g>
          <rect x="141" y="248" width="138" height="54" rx="14" fill="#FFFDF8" opacity="0.93" />
          <rect x="141" y="248" width="138" height="54" rx="14" stroke="#D9BE9B" strokeOpacity="0.7" />
          <text
            x="210"
            y="272"
            textAnchor="middle"
            fill="#3B2A1D"
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize="17"
            fontWeight="600"
            letterSpacing="0.5"
          >
            Milktea
          </text>
          <text
            x="210"
            y="288"
            textAnchor="middle"
            fill="#B47338"
            fontFamily="Arial, sans-serif"
            fontSize="7.5"
            fontWeight="700"
            letterSpacing="4"
          >
            CLOUD
          </text>
        </g>

        {/* shine */}
        <path
          d="M136 212c-6 60-7 120-2 180 2 24 5 40 8 52"
          stroke="#FFFFFF"
          strokeOpacity="0.5"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M152 212c-3 40-4 80-2 120"
          stroke="#FFFFFF"
          strokeOpacity="0.28"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>

      {/* rim */}
      <path d="M118 196h184" stroke="#E7D2B6" strokeWidth="8" strokeLinecap="round" />
      <path d="M120 196h180" stroke="#FFF9EF" strokeWidth="3" strokeLinecap="round" />

      {/* floating pearls */}
      <g fill="#4A2C1A">
        <circle cx="76" cy="354" r="7" opacity="0.8" />
        <circle cx="346" cy="300" r="5" opacity="0.65" />
        <circle cx="328" cy="380" r="9" opacity="0.75" />
      </g>
      <g fill="#FFF7EA" opacity="0.7">
        <circle cx="74" cy="352" r="1.8" />
        <circle cx="325" cy="377" r="2" />
      </g>
    </svg>
  );
}
