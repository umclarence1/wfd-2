const MTN_COLORS = {
  pillActive:
    'border-[#FFCB05] bg-[#FFCB05] !text-gray-900 shadow-sm hover:-translate-y-0.5 hover:border-[#e6b800] hover:bg-[#e6b800] hover:!text-gray-900 hover:shadow-md focus:!text-gray-900 active:translate-y-0',
  pillHover: 'hover:border-[#FFCB05] hover:bg-[#FFCB05]/15 hover:text-gray-900 hover:shadow-sm',
  boxActive: 'border-[#FFCB05] bg-[#FFCB05] !text-gray-900 shadow-sm',
  boxHover: 'hover:border-[#FFCB05] hover:bg-[#FFCB05]/20',
  summaryBox: 'border-amber-200 bg-amber-50 shadow-sm',
  accent: 'text-gray-900',
  inputFocus:
    'focus:border-[#FFCB05] focus:ring-2 focus:ring-[#FFCB05]/45 hover:border-[#FFCB05]',
};

export const NETWORK_BRAND_COLORS = {
  MTN: MTN_COLORS,
  'MTN AFA': MTN_COLORS,
  Telecel: {
    pillActive:
      'border-[#E40520] bg-[#E40520] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#c9041c] hover:bg-[#c9041c] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#E40520] hover:bg-[#E40520]/10 hover:text-[#E40520] hover:shadow-sm',
    boxActive: 'border-[#E40520] bg-[#E40520] !text-white shadow-sm',
    boxHover: 'hover:border-[#E40520] hover:bg-red-50',
    summaryBox: 'border-red-200 bg-red-50 shadow-sm',
    accent: 'text-[#E40520]',
    inputFocus:
      'focus:border-[#E40520] focus:ring-2 focus:ring-[#E40520]/35 hover:border-[#E40520]',
  },
  AirtelTigo: {
    pillActive:
      'border-[#ED1C24] bg-[#ED1C24] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#c91820] hover:bg-[#c91820] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#ED1C24] hover:bg-[#ED1C24]/10 hover:text-[#ED1C24] hover:shadow-sm',
    boxActive: 'border-[#ED1C24] bg-[#ED1C24] !text-white shadow-sm',
    boxHover: 'hover:border-[#ED1C24] hover:bg-red-50',
    summaryBox: 'border-blue-200 bg-blue-50 shadow-sm',
    accent: 'text-blue-950',
    inputFocus:
      'focus:border-[#ED1C24] focus:ring-2 focus:ring-[#ED1C24]/35 hover:border-[#ED1C24]',
  },
  'AirtelTigo Big Time': {
    pillActive:
      'border-[#0066B3] bg-[#0066B3] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#005599] hover:bg-[#005599] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#0066B3] hover:bg-[#0066B3]/10 hover:text-[#0066B3] hover:shadow-sm',
    boxActive: 'border-[#0066B3] bg-[#0066B3] !text-white shadow-sm',
    boxHover: 'hover:border-[#0066B3] hover:bg-sky-50',
    summaryBox: 'border-blue-200 bg-blue-50 shadow-sm',
    accent: 'text-blue-950',
    inputFocus:
      'focus:border-[#0066B3] focus:ring-2 focus:ring-[#0066B3]/35 hover:border-[#0066B3]',
  },
  'BECE Checker': {
    pillActive:
      'border-[#1B5E20] bg-[#1B5E20] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#144a18] hover:bg-[#144a18] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#1B5E20] hover:bg-[#1B5E20]/10 hover:text-[#1B5E20] hover:shadow-sm',
    boxActive: 'border-emerald-600 bg-emerald-600 !text-white shadow-sm',
    boxHover: 'hover:border-emerald-400 hover:bg-emerald-50',
    summaryBox: 'border-green-200 bg-green-50 shadow-sm',
    accent: 'text-green-950',
    inputFocus:
      'focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/30 hover:border-[#1B5E20]',
  },
  'WASSCE Checker': {
    pillActive:
      'border-[#1B5E20] bg-[#1B5E20] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#144a18] hover:bg-[#144a18] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#1B5E20] hover:bg-[#1B5E20]/10 hover:text-[#1B5E20] hover:shadow-sm',
    boxActive: 'border-emerald-600 bg-emerald-600 !text-white shadow-sm',
    boxHover: 'hover:border-emerald-400 hover:bg-emerald-50',
    summaryBox: 'border-green-200 bg-green-50 shadow-sm',
    accent: 'text-green-950',
    inputFocus:
      'focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/30 hover:border-[#1B5E20]',
  },
  'WAEC Checkers': {
    pillActive:
      'border-[#1B5E20] bg-[#1B5E20] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#144a18] hover:bg-[#144a18] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#1B5E20] hover:bg-[#1B5E20]/10 hover:text-[#1B5E20] hover:shadow-sm',
    boxActive: 'border-emerald-600 bg-emerald-600 !text-white shadow-sm',
    boxHover: 'hover:border-emerald-400 hover:bg-emerald-50',
    summaryBox: 'border-green-200 bg-green-50 shadow-sm',
    accent: 'text-green-950',
    inputFocus:
      'focus:border-[#1B5E20] focus:ring-2 focus:ring-[#1B5E20]/30 hover:border-[#1B5E20]',
  },
};

const DEFAULT_COLORS = {
  pillActive:
    'border-emerald-600 bg-emerald-600 !text-white shadow-sm hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-700 hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
  pillHover: 'hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm',
  boxActive: 'border-[#FFCB05] bg-[#FFCB05] !text-gray-900 shadow-sm',
  boxHover: 'hover:border-emerald-400 hover:bg-emerald-50',
  summaryBox: 'border-emerald-200 bg-emerald-50 shadow-sm',
  accent: 'text-emerald-950',
  inputFocus: 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 hover:border-blue-400',
};

export function getNetworkBrandColors(category) {
  return NETWORK_BRAND_COLORS[category] || DEFAULT_COLORS;
}
