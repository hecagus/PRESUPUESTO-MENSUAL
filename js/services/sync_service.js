/* V10.4/V10.5 - Sync, backup, restore y deteccion de conflictos. */
import { LocalRepository } from '../repositories/local_repository.js';
import { CloudRepository } from '../repositories/cloud_repository.js';

const stamp = x => Number(x?._sync?.updatedAt || x?.updatedAt || 0);
export const SyncService = {
  async sync(uid, localState, { strategy='newest' }={}) {
    if (!uid) return { state:localState, status:'LOCAL_ONLY' };
    const cloud = await CloudRepository.load(uid);
    if (!cloud) {
      const saved=await CloudRepository.save(uid,localState,{source:'local'});
      return {state:saved,status:'UPLOADED'};
    }
    const lt=stamp(localState), ct=stamp(cloud);
    if (strategy==='local') { await CloudRepository.save(uid,localState,{source:'local-force'}); return {state:localState,status:'LOCAL_WINS'}; }
    if (strategy==='cloud') { LocalRepository.save(cloud); return {state:cloud,status:'CLOUD_WINS'}; }
    if (lt && ct && lt!==ct) return {state:localState,cloud,status:'CONFLICT',localUpdatedAt:lt,cloudUpdatedAt:ct};
    const winner=ct>lt?cloud:localState;
    if(ct>lt) LocalRepository.save(winner); else if(lt>ct) await CloudRepository.save(uid,winner,{source:'sync'});
    return {state:winner,status:ct>lt?'DOWNLOADED':lt>ct?'UPLOADED':'IN_SYNC'};
  },
  backup(state) { return LocalRepository.export({...state,_backup:{createdAt:new Date().toISOString(),version:1}}); },
  restore(json) { return LocalRepository.import(json); },
  async resolveConflict(uid, localState, cloudState, winner) {
    if(winner==='cloud'){LocalRepository.save(cloudState);return cloudState;}
    await CloudRepository.save(uid,localState,{source:'conflict-resolution'});return localState;
  }
};
