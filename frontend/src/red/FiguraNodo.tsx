import { useId } from 'react'
import type { NodoRed } from '../api/dominio'

/** Ilustraciones simbólicas: no representan niveles, caudales ni lecturas. */
export function FiguraNodo({ nodo }: { nodo: NodoRed }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const pintura = (nombre: string) => `url(#${id}-${nombre})`
  const espacio = nodo.clase === 'ESPACIO'

  function figura() {
    if (espacio && nodo.tipo === 'ZONA_RIEGO') return (
      <>
        <path d="M0 60H43V87H77" className="figura-conducto" />
        <ellipse cx="92" cy="98" rx="62" ry="12" fill="#e1efdf" stroke="none" />
        <path d="M40 98Q32 78 40 76Q50 80 49 97M49 99Q49 69 57 72Q64 83 59 98M121 99Q116 74 125 72Q133 82 132 99M133 99Q135 84 145 83Q149 93 142 99" fill={pintura('verde')} stroke="#4a805b" strokeWidth="1.6" />
        <path d="M85 96V76H99V96" fill={pintura('metal')} />
        <rect x="78" y="70" width="28" height="8" rx="4" fill="#d1e9e7" />
        <path d="M87 65Q79 44 60 43M98 65Q110 44 129 47M92 62V36" fill="none" stroke="#5cacc9" strokeWidth="2.5" strokeDasharray="5 7" strokeLinecap="round" />
        <path d="M65 60L59 57M120 61L126 58" stroke="#81c8da" strokeWidth="3" strokeLinecap="round" />
      </>
    )

    if (espacio) return (
      <>
        <path d="M0 60H35" className="figura-conducto" />
        <path d="M35 40H132V100H35Z" fill={pintura('fachada')} />
        <path d="M132 40L149 32V92L132 100Z" fill="#c5d9df" />
        <path d="M28 37L133 17L153 28L133 48L28 48Z" fill={pintura('azul')} />
        <path d="M133 48V39L153 28V38Z" fill="#236385" />
        <rect x="63" y="59" width="45" height="41" rx="2" fill="#407796" />
        {nodo.tipo === 'BAÑO' ? <g fill="#f6ffff" stroke="none">
          <circle cx="77" cy="69" r="3" /><path d="M73 74H81V87H79V95H75V87H73Z" />
          <circle cx="95" cy="69" r="3" /><path d="M92 74H98L102 87H98V95H92V87H88Z" />
        </g> : <g fill="#dbf5ff" stroke="none">
          <rect x="71" y="67" width="12" height="13" rx="1" /><rect x="89" y="67" width="12" height="13" rx="1" />
          <rect x="81" y="85" width="10" height="15" />
        </g>}
        <path d="M27 101H147" stroke="#90b3b1" strokeWidth="3" strokeLinecap="round" />
        <path d="M29 100Q18 86 25 81Q35 79 39 93Q40 83 47 87Q53 93 48 100M127 100Q121 89 128 86Q135 84 139 93Q144 83 150 88Q155 95 150 100" fill={pintura('verde')} stroke="#648d60" strokeWidth="1.5" />
      </>
    )

    switch (nodo.tipo) {
      case 'CISTERNA':
      case 'TANQUE':
        return (
          <>
            <ellipse cx="78" cy="106" rx="55" ry="7" fill="#dbe9ee" stroke="none" />
            <path d="M27 29V87C27 106 128 106 128 87V29Z" fill={pintura('deposito')} />
            <ellipse cx="77.5" cy="29" rx="50.5" ry="15" fill={pintura('metal')} />
            <path d="M35 41V84" stroke="#fff" strokeWidth="4" opacity=".7" strokeLinecap="round" />
            <path d="M28 81C48 94 107 94 127 81" stroke="#9ac5d3" fill="none" />
            <path d="M63 11V19C63 25 93 25 93 19V11" fill="#6ba9c1" />
            <ellipse cx="78" cy="11" rx="15" ry="4.5" fill="#cee8f1" />
            <path d="M67 60Q78 43 85 60C95 75 60 76 67 60Z" fill="#80c8dc" stroke="#4b96b0" strokeWidth="1.5" />
            <path d="M120 59H137V60H160" className="figura-conducto" />
            <rect x="117" y="53" width="13" height="14" rx="4" fill={pintura('metal')} />
          </>
        )
      case 'TUBERIA':
        return (
          <>
            <path d="M0 60H160" className="figura-conducto" />
            <ellipse cx="80" cy="87" rx="63" ry="5" fill="#dbe9ee" stroke="none" />
            <rect x="17" y="45" width="126" height="30" rx="5" fill={pintura('azul')} />
            <path d="M24 50H136" stroke="#e6faff" strokeWidth="3" opacity=".8" />
            <rect x="17" y="42" width="10" height="36" rx="3" fill={pintura('metal')} />
            <rect x="133" y="42" width="10" height="36" rx="3" fill={pintura('metal')} />
            <path d="M70 60H93M87 54L94 60L87 66" fill="none" stroke="#e5faff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )
      case 'MEDIDOR':
        return (
          <>
            <path d="M0 60H160" className="figura-conducto" />
            <circle cx="80" cy="60" r="39" fill={pintura('metal')} />
            <circle cx="80" cy="60" r="32" fill="#f9fdff" />
            <path d="M56 64A25 25 0 1 1 104 64" stroke="#9cc9d7" strokeWidth="3" fill="none" />
            <path d="M58 49L62 51M67 38L69 43M80 35V41M93 39L90 44M102 50L98 52" stroke="#39728a" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M80 60L92 47" stroke="#c66b58" strokeWidth="3" strokeLinecap="round" />
            <circle cx="80" cy="60" r="4" fill="#275d74" />
            <rect x="65" y="74" width="30" height="7" rx="2" fill="#daeaf0" stroke="none" />
          </>
        )
      case 'UNION':
        return (
          <>
            <path d="M0 60H160" className="figura-conducto" />
            <path d="M62 45H98V75H96V96H64V75H62Z" fill={pintura('turquesa')} />
            <rect x="30" y="45" width="100" height="30" rx="5" fill={pintura('turquesa')} />
            <path d="M39 50H121M70 76V92" stroke="#a6e0df" strokeWidth="3" />
            <rect x="30" y="42" width="10" height="36" rx="3" fill={pintura('metal')} />
            <rect x="120" y="42" width="10" height="36" rx="3" fill={pintura('metal')} />
            <rect x="62" y="89" width="36" height="10" rx="3" fill={pintura('metal')} />
          </>
        )
      case 'VALVULA':
        return (
          <>
            <path d="M0 60H160" className="figura-conducto" />
            <path d="M74 23V49H86V23" fill={pintura('metal')} />
            <rect x="29" y="46" width="102" height="28" rx="6" fill={pintura('turquesa')} />
            <path d="M65 46L71 37H89L95 46V74L89 82H71L65 74Z" fill={pintura('turquesa')} />
            <rect x="28" y="42" width="11" height="36" rx="3" fill={pintura('metal')} />
            <rect x="121" y="42" width="11" height="36" rx="3" fill={pintura('metal')} />
            <ellipse cx="80" cy="21" rx="27" ry="9" fill="#f3d8ce" stroke="#a94e40" strokeWidth="3" />
            <path d="M55 21H105M67 14L93 28M67 28L93 14" stroke="#b86150" strokeWidth="2.5" />
            <circle cx="80" cy="21" r="3" fill="#b86150" stroke="none" />
          </>
        )
      default:
        return (
          <>
            <path d="M0 60H160" className="figura-conducto" />
            <path d="M80 26L110 43V77L80 94L50 77V43Z" fill={pintura('metal')} />
            <circle cx="80" cy="60" r="14" fill="#eff9fa" />
            <path d="M73 60H87M80 53V67" stroke="#42788b" strokeWidth="2.5" />
          </>
        )
    }
  }

  return (
    <svg viewBox="0 0 160 120" className="figura-red" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-metal`} x2="0" y2="1">
          <stop stopColor="#f4fcff" /><stop offset=".45" stopColor="#bfdfeb" /><stop offset="1" stopColor="#7db0c4" />
        </linearGradient>
        <linearGradient id={`${id}-deposito`} x2="1" y2="0">
          <stop stopColor="#b6d6e4" /><stop offset=".32" stopColor="#edf8fb" /><stop offset=".7" stopColor="#cae4ed" /><stop offset="1" stopColor="#8cb9cb" />
        </linearGradient>
        <linearGradient id={`${id}-azul`} x2="0" y2="1">
          <stop stopColor="#9cdaf2" /><stop offset=".4" stopColor="#6bb8d9" /><stop offset="1" stopColor="#397da7" />
        </linearGradient>
        <linearGradient id={`${id}-turquesa`} x2="0" y2="1">
          <stop stopColor="#9cd5d5" /><stop offset=".5" stopColor="#559fa6" /><stop offset="1" stopColor="#2c737f" />
        </linearGradient>
        <linearGradient id={`${id}-verde`} x2="0" y2="1">
          <stop stopColor="#a7d390" /><stop offset="1" stopColor="#73a96f" />
        </linearGradient>
        <linearGradient id={`${id}-fachada`} x2="0" y2="1">
          <stop stopColor="#fffdf4" /><stop offset="1" stopColor="#e5e9e0" />
        </linearGradient>
      </defs>
      <g stroke="#285a70" strokeWidth="2" strokeLinejoin="round">{figura()}</g>
    </svg>
  )
}
