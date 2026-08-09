export function buildEvidencePath(fileName:string,input:{companyId:string;userId:string;missionId:string},id=crypto.randomUUID()){
  const raw=fileName.split('.').pop()||'jpg'
  const ext=raw.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'jpg'
  return`${input.companyId}/${input.missionId}/${input.userId}/${id}.${ext}`
}
