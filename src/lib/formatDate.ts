const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
const relativeTimeFormatter = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
    { unit: 'year', seconds: 365 * 24 * 3600 },
    { unit: 'month', seconds: 30 * 24 * 3600 },
    { unit: 'week', seconds: 7 * 24 * 3600 },
    { unit: 'day', seconds: 24 * 3600 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
]

export function formatDateTime(isoDate: string) {
    return dateTimeFormatter.format(new Date(isoDate))
}

export function formatRelativeTime(isoDate: string, now = new Date()) {
    const elapsedSeconds = Math.round((new Date(isoDate).getTime() - now.getTime()) / 1000)
    if (Math.abs(elapsedSeconds) < 60) return 'à l’instant'
    const matchingUnit = RELATIVE_UNITS.find(({ seconds }) => Math.abs(elapsedSeconds) >= seconds) ?? RELATIVE_UNITS.at(-1)!
    return relativeTimeFormatter.format(Math.round(elapsedSeconds / matchingUnit.seconds), matchingUnit.unit)
}
