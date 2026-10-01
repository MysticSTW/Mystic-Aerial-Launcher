import { toast as sonnerToast } from 'sonner'

const STYLE_PAYLOAD_MARKERS = [
	'data-sonner-toaster',
	'toast-icon-margin-start',
	':where(html[dir="ltr"])',
]

function normalizeToastMessage(message: unknown) {
	if (typeof message !== 'string') {
		return message
	}

	const normalized = message.trim()

	if (
		STYLE_PAYLOAD_MARKERS.some((marker) =>
			normalized.includes(marker)
		)
	) {
		return 'Unexpected style payload blocked. Please retry the last action.'
	}

	if (normalized.length > 280) {
		return `${normalized.slice(0, 280)}...`
	}

	return normalized
}

type SonnerToastArgs = Parameters<typeof sonnerToast>

export const toast = (...args: SonnerToastArgs) => {
	const [message, options] = args
	return sonnerToast(
		normalizeToastMessage(message) as SonnerToastArgs[0],
		options,
	)
}
