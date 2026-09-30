// Props for controls that are visible but not working yet: outside V1's scope,
// or waiting for a later build stage. They stay focusable and announce why.
export const placeholder = (why: string) => ({
  'aria-disabled': true,
  title: why,
  type: 'button' as const,
})

export const OUT_OF_SCOPE = 'Not part of version 1'
