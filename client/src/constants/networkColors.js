const MTN_COLORS = {
  pillActive:
    'border-[#FFCB05] bg-[#FFCB05] !text-gray-900 shadow-sm hover:-translate-y-0.5 hover:border-[#e6b800] hover:bg-[#e6b800] hover:!text-gray-900 hover:shadow-md focus:!text-gray-900 active:translate-y-0',
  pillHover: 'hover:border-[#FFCB05] hover:bg-[#FFCB05]/15 hover:text-gray-900 hover:shadow-sm',
  summaryBox:
    'border-amber-800/60 bg-gradient-to-br from-amber-900/15 via-amber-800/10 to-yellow-900/20 shadow-sm ring-1 ring-amber-900/10',
  accent: 'text-amber-950',
};

export const NETWORK_BRAND_COLORS = {
  MTN: MTN_COLORS,
  'MTN AFA': MTN_COLORS,
  Telecel: {
    pillActive:
      'border-[#E40520] bg-[#E40520] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#c9041c] hover:bg-[#c9041c] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#E40520] hover:bg-[#E40520]/10 hover:text-[#E40520] hover:shadow-sm',
    summaryBox:
      'border-red-900/50 bg-gradient-to-br from-red-950/20 via-red-900/10 to-red-800/15 shadow-sm ring-1 ring-red-900/10',
    accent: 'text-red-950',
  },
  AirtelTigo: {
    pillActive:
      'border-[#ED1C24] bg-[#ED1C24] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#c91820] hover:bg-[#c91820] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#ED1C24] hover:bg-[#ED1C24]/10 hover:text-[#ED1C24] hover:shadow-sm',
    summaryBox:
      'border-blue-900/50 bg-gradient-to-br from-blue-950/20 via-red-950/10 to-blue-900/15 shadow-sm ring-1 ring-blue-900/10',
    accent: 'text-blue-950',
  },
  'AirtelTigo Big Time': {
    pillActive:
      'border-[#0066B3] bg-[#0066B3] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#005599] hover:bg-[#005599] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#0066B3] hover:bg-[#0066B3]/10 hover:text-[#0066B3] hover:shadow-sm',
    summaryBox:
      'border-blue-900/50 bg-gradient-to-br from-blue-950/20 to-blue-800/15 shadow-sm ring-1 ring-blue-900/10',
    accent: 'text-blue-950',
  },
  'BECE Checker': {
    pillActive:
      'border-[#1B5E20] bg-[#1B5E20] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#144a18] hover:bg-[#144a18] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#1B5E20] hover:bg-[#1B5E20]/10 hover:text-[#1B5E20] hover:shadow-sm',
    summaryBox:
      'border-green-900/50 bg-gradient-to-br from-green-950/20 to-emerald-900/15 shadow-sm ring-1 ring-green-900/10',
    accent: 'text-green-950',
  },
  'WASSCE Checker': {
    pillActive:
      'border-[#1B5E20] bg-[#1B5E20] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#144a18] hover:bg-[#144a18] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#1B5E20] hover:bg-[#1B5E20]/10 hover:text-[#1B5E20] hover:shadow-sm',
    summaryBox:
      'border-green-900/50 bg-gradient-to-br from-green-950/20 to-emerald-900/15 shadow-sm ring-1 ring-green-900/10',
    accent: 'text-green-950',
  },
  'WAEC Checkers': {
    pillActive:
      'border-[#1B5E20] bg-[#1B5E20] !text-white shadow-sm hover:-translate-y-0.5 hover:border-[#144a18] hover:bg-[#144a18] hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
    pillHover: 'hover:border-[#1B5E20] hover:bg-[#1B5E20]/10 hover:text-[#1B5E20] hover:shadow-sm',
    summaryBox:
      'border-green-900/50 bg-gradient-to-br from-green-950/20 to-emerald-900/15 shadow-sm ring-1 ring-green-900/10',
    accent: 'text-green-950',
  },
};

const DEFAULT_COLORS = {
  pillActive:
    'border-blue-600 bg-blue-600 !text-white shadow-sm hover:-translate-y-0.5 hover:border-blue-700 hover:bg-blue-700 hover:!text-white hover:shadow-md focus:!text-white active:translate-y-0',
  pillHover: 'hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm',
  summaryBox:
    'border-blue-900/50 bg-gradient-to-br from-blue-950/20 to-blue-800/15 shadow-sm ring-1 ring-blue-900/10',
  accent: 'text-blue-950',
};

export function getNetworkBrandColors(category) {
  return NETWORK_BRAND_COLORS[category] || DEFAULT_COLORS;
}
