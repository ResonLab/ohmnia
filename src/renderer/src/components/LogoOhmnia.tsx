interface Props {
  taille?: number
}

/**
 * Logo Ohmnia : un Ω (ohm) stylisé dont la base se prolonge en piste de circuit
 * imprimé, inscrit dans un écusson arrondi.
 */
export default function LogoOhmnia({ taille = 32 }: Props): React.JSX.Element {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="ohmnia-fond" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1BE7B6" />
          <stop offset="1" stopColor="#0E9CD9" />
        </linearGradient>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#ohmnia-fond)" />

      {/* Ω central */}
      <path
        d="M20 47c6-3 7.5-7 5-13.5C22.5 26 25 17 32 17s9.5 9 7 16.5C36.5 40 38 44 44 47"
        stroke="#062B33"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pieds du Ω */}
      <path d="M15.5 47h7M41.5 47h7" stroke="#062B33" strokeWidth="4.6" strokeLinecap="round" />

      {/* Pistes de circuit + nœuds */}
      <circle cx="12" cy="20" r="2.6" fill="#062B33" />
      <path d="M12 20h6" stroke="#062B33" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="52" cy="20" r="2.6" fill="#062B33" />
      <path d="M52 20h-6" stroke="#062B33" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
