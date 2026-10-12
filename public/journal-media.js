// Journal images stay in device storage; never uploaded with waypoints.
window.DriftMedia=(()=>{
  let database;
  function open(){
    if(!database)database=new Promise((resolve,reject)=>{
      const request=indexedDB.open('drift-journal-media',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('photos');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Photo storage is blocked. Close other DRIFT tabs and retry.'));
    }).catch(error=>{database=null;throw error;});
    return database;
  }
  async function operation(mode,action){
    const db=await open();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('photos',mode),request=action(transaction.objectStore('photos'));
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error||new Error('Photo storage unavailable'));
    });
  }
  return {
    put:(id,blob)=>operation('readwrite',store=>store.put(blob,id)),
    get:id=>operation('readonly',store=>store.get(id)),
    remove:id=>operation('readwrite',store=>store.delete(id)),
    async export(ids){
      const photos={};
      for(const id of new Set(ids)){
        const blob=await this.get(id);if(!blob)throw new Error('A journal photo could not be read. Retry or export without photos.');
        photos[id]=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
      }
      return photos;
    }
  };
})();
