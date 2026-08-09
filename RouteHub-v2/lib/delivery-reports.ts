import {getSupabase} from './supabase'
import {currentMembership} from './data'
import {reportableDeliveryStatuses} from './report-status'
export{isReportableDeliveryStatus,reportableDeliveryStatuses}from'./report-status'
export async function listDeliveryReports(){const membership=await currentMembership();return getSupabase().from('routes').select('id,driver_id,destination_name,destination_address,status,completed_at,completion_lat,completion_lng,completion_accuracy,completion_distance_m,completion_method,completion_warning,completion_photo_path').eq('company_id',membership.company_id).in('status',[...reportableDeliveryStatuses]).order('completed_at',{ascending:false})}
