/**
 * A route position has meaning only inside one operational queue. Keeping the
 * identity here prevents UI code from mixing drivers, branches, or dates.
 */
export type QueueScopedRoute={
  company_id:string
  branch_id?:string|null
  route_date:string
  driver_id:string
}

export type RouteQueue<T extends QueueScopedRoute>={key:string;routes:T[]}

export function routeQueueKey(route:QueueScopedRoute){
  return [route.company_id,route.branch_id??'__no_branch__',route.route_date,route.driver_id].join('::')
}

export function sameRouteQueue(left:QueueScopedRoute,right:QueueScopedRoute){
  return routeQueueKey(left)===routeQueueKey(right)
}

export function groupRouteQueues<T extends QueueScopedRoute>(routes:T[]):RouteQueue<T>[] {
  const queues=new Map<string,T[]>()
  routes.forEach(route=>{
    const key=routeQueueKey(route)
    queues.set(key,[...(queues.get(key)||[]),route])
  })
  return [...queues.entries()].map(([key,items])=>({key,routes:items}))
}
