import test from 'node:test'
import assert from 'node:assert/strict'
const canMove=status=>!['completed','cancelled'].includes(status)
const relink=missions=>missions.map((m,i)=>({...m,position:i+1,origin:i?missions[i-1].destination:m.origin}))
const reorder=(missions,from,to)=>{if(!canMove(missions[from].status))return missions;const next=[...missions];const[item]=next.splice(from,1);next.splice(to,0,item);return relink(next)}
const urgent=(missions,item)=>relink([{...item,priority:'urgent'},...missions])
const seed=[{id:'1',status:'pending',origin:'Branch',destination:'Supplier'},{id:'2',status:'pending',origin:'Supplier',destination:'Customer A'},{id:'3',status:'completed',origin:'Customer A',destination:'Customer B'}]
test('reorders and relinks origins',()=>{const result=reorder(seed,1,0);assert.equal(result[1].origin,result[0].destination);assert.deepEqual(result.map(x=>x.position),[1,2,3])})
test('inserts urgent mission first',()=>{const result=urgent(seed,{id:'u',status:'pending',origin:'Current',destination:'Branch'});assert.equal(result[0].priority,'urgent');assert.equal(result[0].position,1)})
test('completed mission cannot move',()=>assert.deepEqual(reorder(seed,2,0),seed))
