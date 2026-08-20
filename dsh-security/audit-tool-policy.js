export const name = 'dsh-security-code-audit-tool-policy'
export const inject = ['tools']

const NETWORK_TEST_TOOLS = Object.freeze([
  'dsh_web_fuzzer',
  'dsh_mitm_capture',
])

// Keep the code-audit tool catalog honest. The resource-center plugin owns
// these tools globally, so the preset must explicitly remove them from this
// agent scope instead of relying on prompt instructions.
export function apply(ctx) {
  ctx.tools.restrict({ deny: NETWORK_TEST_TOOLS })
}

