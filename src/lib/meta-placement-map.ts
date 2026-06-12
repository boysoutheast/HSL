/**
 * Meta Placement Map — curated tokens to MAPI publisher_platforms + positions.
 *
 * Live write/readback validation 2026-06-12 (act_620404546493153):
 * VERIFIED — instagram_feed (stream), instagram_reels (reels),
 * facebook_feed (feed): Meta accepted, readback matched token-for-token.
 * ⚠️ Remaining 12 tokens still INFERRED (R10: official enum NOT_FOUND) —
 * validate each on first live use.
 * publisher_platforms MUST always be sent explicitly for manual placement:
 * omitting it makes Meta default to ALL platforms including WhatsApp →
 * error 4399008 ("WhatsApp status requires Instagram Stories").
 *
 * UI default: Automatic (omit all placement fields).
 */

export interface PlacementMapping {
  publisher_platforms: string
  positions_field: string
  position_value: string
}

export const PLACEMENT_TOKENS: Record<string, PlacementMapping> = {
  facebook_feed:          { publisher_platforms: 'facebook',       positions_field: 'facebook_positions',      position_value: 'feed' },
  facebook_stories:       { publisher_platforms: 'facebook',       positions_field: 'facebook_positions',      position_value: 'story' },
  facebook_reels:         { publisher_platforms: 'facebook',       positions_field: 'facebook_positions',      position_value: 'facebook_reels' },
  facebook_video_feeds:  { publisher_platforms: 'facebook',       positions_field: 'facebook_positions',      position_value: 'video_feeds' },
  facebook_marketplace:   { publisher_platforms: 'facebook',       positions_field: 'facebook_positions',      position_value: 'marketplace' },
  facebook_search:        { publisher_platforms: 'facebook',       positions_field: 'facebook_positions',      position_value: 'search' },
  instagram_feed:         { publisher_platforms: 'instagram',      positions_field: 'instagram_positions',      position_value: 'stream' },
  instagram_stories:      { publisher_platforms: 'instagram',      positions_field: 'instagram_positions',      position_value: 'story' },
  instagram_reels:        { publisher_platforms: 'instagram',      positions_field: 'instagram_positions',      position_value: 'reels' },
  instagram_explore:      { publisher_platforms: 'instagram',      positions_field: 'instagram_positions',      position_value: 'explore' },
  instagram_profile_feed: { publisher_platforms: 'instagram',      positions_field: 'instagram_positions',      position_value: 'profile_feed' },
  messenger_inbox:        { publisher_platforms: 'messenger',      positions_field: 'messenger_positions',      position_value: 'messenger_home' },
  messenger_stories:      { publisher_platforms: 'messenger',      positions_field: 'messenger_positions',      position_value: 'story' },
  audience_network_native:    { publisher_platforms: 'audience_network', positions_field: 'audience_network_positions', position_value: 'classic' },
  audience_network_rewarded:  { publisher_platforms: 'audience_network', positions_field: 'audience_network_positions', position_value: 'rewarded_video' },
}

export const PLACEMENT_TOKEN_LIST = Object.keys(PLACEMENT_TOKENS)

/**
 * Convert array of placement tokens → targeting spec placements block.
 * Returns null when automatic (empty tokens = omit placements).
 */
export function buildPlacementTargeting(tokens: string[]): Record<string, unknown> | null {
  if (!tokens || tokens.length === 0) return null

  const platforms = new Set<string>()
  const positions: Record<string, string[]> = {}

  for (const token of tokens) {
    const mapping = PLACEMENT_TOKENS[token]
    if (!mapping) continue

    platforms.add(mapping.publisher_platforms)
    if (!positions[mapping.positions_field]) {
      positions[mapping.positions_field] = []
    }
    if (!positions[mapping.positions_field].includes(mapping.position_value)) {
      positions[mapping.positions_field].push(mapping.position_value)
    }
  }

  return {
    publisher_platforms: Array.from(platforms),
    ...positions,
  }
}
