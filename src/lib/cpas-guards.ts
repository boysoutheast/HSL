export function hasSoftStop(campaignName: string): boolean {
  return / - stop$/i.test(campaignName.trim())
}

export function assertNotStopped(campaignName: string): void {
  if (hasSoftStop(campaignName)) {
    throw new Error(`Campaign "${campaignName}" has soft-stop suffix — write blocked`)
  }
}

export function assertHermesScope(campaignName: string): void {
  if (!campaignName.toLowerCase().includes('hermes')) {
    throw new Error(`Campaign "${campaignName}" is outside Hermes write scope`)
  }
}
