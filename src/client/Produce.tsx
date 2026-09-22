export function Produce({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={`produce-art ${compact ? "compact" : ""}`}
      viewBox="0 0 480 310"
      role="img"
      aria-label="Illustration of fresh tomatoes packed in a produce crate"
    >
      <defs>
        <linearGradient id="tomato" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ed7750" />
          <stop offset="1" stopColor="#c04c31" />
        </linearGradient>
        <linearGradient id="crate" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#d8b38c" />
          <stop offset="1" stopColor="#b98a5c" />
        </linearGradient>
      </defs>
      <ellipse
        cx="260"
        cy="267"
        rx="171"
        ry="24"
        fill="#263f2f"
        opacity=".09"
      />
      <path d="M65 135 266 73 421 119 221 188Z" fill="#806441" />
      <path d="M77 134 266 85 407 122 220 177Z" fill="#38543a" />
      {[
        [122, 127, 29],
        [177, 110, 28],
        [235, 99, 26],
        [292, 109, 28],
        [349, 126, 29],
        [299, 148, 31],
        [237, 150, 31],
        [174, 147, 30],
        [219, 124, 27],
      ].map(([x, y, r], i) => (
        <g key={i}>
          <ellipse
            cx={x + 3}
            cy={y + 5}
            rx={r}
            ry={r * 0.8}
            fill="#1b3023"
            opacity=".2"
          />
          <circle cx={x} cy={y} r={r} fill="url(#tomato)" />
          <path
            d={`M${x - 11} ${y - 16}l12 3 8-10-2 13 10 4-14 0-8 8 2-12Z`}
            fill="#456743"
          />
          <path
            d={`M${x - 8} ${y - 10}q-11 4-10 12`}
            stroke="#ffb18a"
            opacity=".6"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      ))}
      <path d="M66 136 220 187 220 278 75 224Z" fill="#b08860" />
      <path d="M220 187 422 122 410 218 220 278Z" fill="url(#crate)" />
      <path
        d="M65 136 221 186 221 204 68 155ZM71 171 221 221 221 239 73 190ZM75 206 221 256 221 278 77 225Z"
        fill="#d3a77b"
      />
      <path
        d="M219 187 423 122 421 144 220 206ZM219 222 418 159 416 181 220 242ZM219 257 413 196 410 219 220 280Z"
        fill="#e0bc92"
      />
      <path d="M235 185v88M396 140l-8 85" stroke="#b78c62" strokeWidth="13" />
      <path d="M89 150l5 81M198 185v79" stroke="#a78158" strokeWidth="11" />
      <path d="M275 192 358 166 357 218 275 244Z" fill="#f6f3dd" />
      <path
        d="M287 206 344 188M287 213l38-12M287 226l53-17"
        stroke="#45624a"
        strokeWidth="3"
      />
      <circle cx="116" cy="253" r="25" fill="url(#tomato)" />
      <path d="m107 234 10 6 7-9-2 11 10 4-12-1-8 7 1-10Z" fill="#456743" />
      <path d="M365 66c20-28 50-20 43 2-7 21-36 16-43-2" fill="#749164" />
      <path d="m368 66 28-2" stroke="#456743" strokeWidth="2" />
    </svg>
  );
}
