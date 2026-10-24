/* Solo para pruebas Node: subconjunto mínimo de IndexedDB con commits/abort atómicos. */
const clone=v=>v===undefined?undefined:structuredClone(v);
export function fakeIndexedDB({failOnRecord=false}={}){
  const databases=new Map();
  const makeStore=(tx,name)=>{
    const table=tx.stage.get(name);
    const request=fn=>tx.enqueue(fn);
    return {
      get(key){return request(()=>clone(table.get(key)));},
      put(value){
        return request(()=>{
          if(name==='records'&&failOnRecord)throw Error('SIMULATED_IDB_WRITE_FAILURE');
          const key=value.owner&&name!=='records'?value.owner:value.key;
          table.set(key,clone(value));return key;
        });
      },
      delete(key){return request(()=>table.delete(key));},
      createIndex(){},
      index(indexName){
        if(indexName!=='by_owner')throw Error('FAKE_INDEX');
        return {
          getAll(owner){return request(()=>[...table.values()].filter(x=>x.owner===owner).map(clone));},
          openCursor(owner){
            const out={result:null,error:null,onsuccess:null,onerror:null};
            const keys=[...table].filter(([,v])=>v.owner===owner).map(([k])=>k);
            let pos=0;
            function step(){
              tx.enqueue(()=>{
                if(pos>=keys.length){out.result=null;return null;}
                const key=keys[pos++];
                out.result={key,value:clone(table.get(key)),delete:()=>{table.delete(key);},continue:step};
                return out.result;
              },out);
            }
            step();return out;
          }
        };
      }
    };
  };
  return {
    _databases:databases,
    open(name){
      const request={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null,onblocked:null};
      queueMicrotask(()=>{
        let db=databases.get(name),fresh=false;
        if(!db){fresh=true;db={tables:new Map()};databases.set(name,db);}
        const instance={
          objectStoreNames:{contains:n=>db.tables.has(n)},
          createObjectStore(n){db.tables.set(n,new Map());return {createIndex(){}};},
          close(){},
          transaction(names,mode){
            const tx={oncomplete:null,onabort:null,onerror:null,error:null,aborted:false,pending:0,commitQueued:false,
              stage:new Map(names.map(n=>[n,new Map([...db.tables.get(n)].map(([k,v])=>[k,clone(v)]))])),
              objectStore(n){if(!this.stage.has(n))throw Error('FAKE_STORE');return makeStore(this,n);},
              abort(){if(this.aborted)return;this.aborted=true;queueMicrotask(()=>this.onabort?.());},
              enqueue(fn,provided){
                if(this.aborted)throw Error('FAKE_ABORTED');
                this.pending++;
                const req=provided||{result:null,error:null,onsuccess:null,onerror:null};
                queueMicrotask(()=>{
                  if(!this.aborted){
                    try{const value=fn();if(!provided)req.result=value;req.onsuccess?.();}
                    catch(err){req.error=err;this.error=err;req.onerror?.();this.abort();}
                  }
                  this.pending--;
                  if(!this.pending&&!this.aborted&&!this.commitQueued){
                    this.commitQueued=true;
                    queueMicrotask(()=>{
                      this.commitQueued=false;
                      if(this.pending||this.aborted)return;
                      if(mode==='readwrite')for(const [n,rows] of this.stage)db.tables.set(n,rows);
                      this.oncomplete?.();
                    });
                  }
                });
                return req;
              }
            };
            return tx;
          }
        };
        request.result=instance;
        try{if(fresh)request.onupgradeneeded?.();request.onsuccess?.();}
        catch(e){request.error=e;request.onerror?.();}
      });
      return request;
    }
  };
}
