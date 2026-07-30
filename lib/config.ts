export const appConfig={name:'RouteHub',defaultRouteMode:'locked' as const,completionRadiusFeet:300}

export function hasSupabaseConfig(){return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}
