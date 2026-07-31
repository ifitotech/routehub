import test from 'node:test'; import assert from 'node:assert/strict';
import {recalculatePositions,reorderMissions,insertUrgent,pauseCurrent,canReorder} from '../lib/route-planner.ts';
const base=[{id:'a',position:1,status:'pending',type:'pickup',destination_address:'Proveedor'},{id:'b',position:2,status:'pending',type:'delivery',origin_name:'previous_route',destination_address:'Cliente A'},{id:'c',position:3,status:'pending',type:'delivery',origin_name:'previous_route',destination_address:'Cliente B'}];
test('recalcula posiciones y bloquea completadas',()=>{assert.equal(recalculatePositions(base)[2].position,3);assert.equal(canReorder({...base[0],status:'completed'}),false)});
test('inserta urgente al inicio disponible',()=>{const out=insertUrgent(base,{id:'u',position:0,status:'pending',type:'return',destination_address:'Sucursal'});assert.deepEqual(out.map(x=>x.id),['u','a','b','c']);assert.deepEqual(out.map(x=>x.position),[1,2,3,4])});
test('reordena misiones',()=>{const out=reorderMissions(base,2,0);assert.deepEqual(out.map(x=>x.id),['c','a','b'])});
test('pausa la misión activa',()=>{const out=pauseCurrent([{...base[0],status:'active'},base[1]]);assert.equal(out[0].status,'paused')});
