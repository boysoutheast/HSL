export interface MonitorSettings {
  checkIntervalMinutes: number
  minimumDecisionAgeMinutes: number
  deadEarlyAgeMinutes: number
  stuckThresholdPercentPerHour: number
  growingThresholdPercentPerHour: number
  hotThresholdPercentPerHour: number
  stuckConfirmationCount: number
  hotLockDurationMinutes: number
  maxPostPerDay: number
  minimumGapUploadMinutes: number
}

export function calculateGrowthPerHour(
  viewsNow: number,
  viewsPrevious: number,
): number {
  if (viewsPrevious <= 0) return 0
  return ((viewsNow - viewsPrevious) / viewsPrevious) * 100
}

export function determineMonitorStatus(params: {
  postAgeMinutes: number
  growthPerHour: number
  consecutiveStuckCount: number
  lockedUntil: Date | null
  lastPostAt: Date | null
  postsToday: number
  settings: MonitorSettings
}): { status: string; reason: string } {
  const {
    postAgeMinutes,
    growthPerHour,
    consecutiveStuckCount,
    lockedUntil,
    lastPostAt,
    postsToday,
    settings,
  } = params

  const now = new Date()

  // If locked (HOT), stay locked until lock expires
  if (lockedUntil && lockedUntil > now) {
    return {
      status: 'LOCKED_HOT',
      reason: `Post is HOT. Locked until ${lockedUntil.toISOString()}`,
    }
  }

  // Max posts per day reached
  if (postsToday >= settings.maxPostPerDay) {
    return {
      status: 'WAITING',
      reason: `Max posts per day (${settings.maxPostPerDay}) reached`,
    }
  }

  // Minimum gap between uploads
  if (lastPostAt) {
    const minutesSinceLastPost =
      (now.getTime() - lastPostAt.getTime()) / (1000 * 60)
    if (minutesSinceLastPost < settings.minimumGapUploadMinutes) {
      const remaining = Math.ceil(
        settings.minimumGapUploadMinutes - minutesSinceLastPost,
      )
      return {
        status: 'WAITING',
        reason: `Minimum gap not reached. ${remaining} minutes remaining`,
      }
    }
  }

  // No post yet — ready to upload
  if (!lastPostAt) {
    return {
      status: 'READY_UPLOAD',
      reason: 'No previous post. Ready for first upload.',
    }
  }

  // Post too young to make a decision
  if (postAgeMinutes < settings.minimumDecisionAgeMinutes) {
    return {
      status: 'MONITORING',
      reason: `Post is ${postAgeMinutes} minutes old. Minimum decision age is ${settings.minimumDecisionAgeMinutes} minutes.`,
    }
  }

  // Dead early: post is young and has very low growth
  if (
    postAgeMinutes <= settings.deadEarlyAgeMinutes &&
    growthPerHour < settings.stuckThresholdPercentPerHour
  ) {
    return {
      status: 'READY_UPLOAD',
      reason: `Post died early. Growth ${growthPerHour.toFixed(2)}%/hr below stuck threshold at age ${postAgeMinutes} min.`,
    }
  }

  // HOT: very high growth
  if (growthPerHour >= settings.hotThresholdPercentPerHour) {
    return {
      status: 'LOCKED_HOT',
      reason: `Post is HOT with ${growthPerHour.toFixed(2)}%/hr growth. Locking for ${settings.hotLockDurationMinutes} minutes.`,
    }
  }

  // STUCK: consecutive stuck confirmations
  if (
    growthPerHour < settings.stuckThresholdPercentPerHour &&
    consecutiveStuckCount >= settings.stuckConfirmationCount
  ) {
    return {
      status: 'READY_UPLOAD',
      reason: `Post stuck for ${consecutiveStuckCount} consecutive checks. Growth: ${growthPerHour.toFixed(2)}%/hr`,
    }
  }

  // GROWING
  if (growthPerHour >= settings.growingThresholdPercentPerHour) {
    return {
      status: 'MONITORING',
      reason: `Post growing at ${growthPerHour.toFixed(2)}%/hr`,
    }
  }

  // Default: still monitoring
  return {
    status: 'MONITORING',
    reason: `Growth rate ${growthPerHour.toFixed(2)}%/hr. Watching for trend.`,
  }
}
