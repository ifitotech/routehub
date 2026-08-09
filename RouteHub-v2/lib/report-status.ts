export const reportableDeliveryStatuses=['completed','issue','cancelled'] as const
export function isReportableDeliveryStatus(status:string){return reportableDeliveryStatuses.includes(status as typeof reportableDeliveryStatuses[number])}
