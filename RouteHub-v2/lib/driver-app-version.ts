/** Driver build stamp shown in Settings.
 *  0.1bN = product train
 *  YYYY-MM-DD.N = calendar day + change number that day (reset N to 1 each morning)
 *  Bump BUILD_N on every Driver production push. */
export const DRIVER_TRAIN = '0.1b6'
export const DRIVER_BUILD_DATE = '2026-08-30'
export const DRIVER_BUILD_N = 1
export const DRIVER_APP_VERSION = `${DRIVER_TRAIN} · ${DRIVER_BUILD_DATE}.${DRIVER_BUILD_N}`
