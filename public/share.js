// Opens a reviewable composer or device share sheet. Nothing posts automatically.
window.DriftShare=(()=>{
  let dialog,photoFile,photoUrl,lastFocus;
  function create(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.className='drift-share-dialog';dialog.setAttribute('aria-label','Share from DRIFT');
    dialog.innerHTML=`<div class="modal-head"><h2>SHARE FROM THE FIELD</h2><button type="button" data-close>CLOSE</button></div>
      <p data-guidance></p><label>Caption<textarea data-caption rows="4" maxlength="2200"></textarea></label>
      <p data-link></p><img data-preview alt="Photo selected for sharing" hidden />
      <label data-note-option hidden><input type="checkbox" data-note-check /> Include this private journal note</label>
      <label data-photo-option hidden><input type="checkbox" data-photo-check /> Include this private journal photo</label>
      <div class="drift-share-actions"><button type="button" data-native>SHARE TO APPS…</button><button type="button" data-photo disabled>SHARE PHOTO…</button><button type="button" data-copy>COPY CAPTION + LINK</button><button type="button" data-download disabled>DOWNLOAD PHOTO</button></div>
      <p>Instagram and other photo apps: share the photo, or download it and paste your copied caption. Available apps depend on your device.</p>
      <div class="drift-share-actions" data-socials></div><p role="status" data-status></p>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=null;lastFocus?.focus?.();});
  }
  function open({title='DRIFT',text='',url='https://drift.loudestriot.com/',file=null,privateNote=null,privatePhoto=false}={}){
    create();lastFocus=document.activeElement;photoFile=file;
    const caption=dialog.querySelector('[data-caption]'),note=dialog.querySelector('[data-note-check]'),photo=dialog.querySelector('[data-photo-check]');
    caption.value=text;note.checked=false;photo.checked=!privatePhoto;
    dialog.querySelector('[data-note-option]').hidden=privateNote===null;
    dialog.querySelector('[data-photo-option]').hidden=!file||!privatePhoto;
    dialog.querySelector('[data-guidance]').textContent=privateNote!==null?'Choose what to share. Private note and photo are excluded until you select them. Exact pin coordinates are never added.':'Review your caption and choose an app. You finish posting there.';
    dialog.querySelector('[data-link]').textContent=url;
    dialog.querySelector('[data-status]').textContent='';
    const preview=dialog.querySelector('[data-preview]');
    if(photoUrl)URL.revokeObjectURL(photoUrl);
    photoUrl=file?URL.createObjectURL(file):null;preview.hidden=!file;if(file)preview.src=photoUrl;else preview.removeAttribute('src');
    const status=message=>dialog.querySelector('[data-status]').textContent=message;
    const usePhoto=()=>!!photoFile&&photo.checked;
    function update(){
      dialog.querySelector('[data-photo]').disabled=!usePhoto()||!navigator.share||!navigator.canShare?.({files:[photoFile]});
      dialog.querySelector('[data-download]').disabled=!usePhoto();
      const socials=dialog.querySelector('[data-socials]');socials.replaceChildren();
      const value=caption.value+'\n'+url;
      for(const [label,href] of [['THREADS','https://www.threads.net/intent/post?text='+encodeURIComponent(value)],['BLUESKY','https://bsky.app/intent/compose?text='+encodeURIComponent(value)],['X','https://twitter.com/intent/tweet?text='+encodeURIComponent(caption.value.slice(0,240))+'&url='+encodeURIComponent(url)],['FACEBOOK','https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(url)]]){
        const a=document.createElement('a');a.textContent=label;a.href=href;a.target='_blank';a.rel='noopener noreferrer';socials.append(a);
      }
    }
    note.onchange=()=>{caption.value=note.checked?text+'\n\n'+privateNote:text;update();};photo.onchange=update;caption.oninput=update;
    dialog.querySelector('[data-native]').onclick=async()=>{
      if(!navigator.share){status('Use a social button or copy the caption and link.');return;}
      try{await navigator.share({title,text:caption.value,url});status('Share sheet closed. Finish posting in your chosen app.');}catch(error){if(error.name!=='AbortError')status('Sharing is unavailable here. Copy the caption and link instead.');}
    };
    dialog.querySelector('[data-photo]').onclick=async()=>{
      try{await navigator.share({files:[photoFile],title,text:caption.value+'\n'+url});}catch(error){if(error.name!=='AbortError')status('Could not share this photo. Download it and copy the caption instead.');}
    };
    dialog.querySelector('[data-copy]').onclick=async()=>{
      try{await navigator.clipboard.writeText(caption.value+'\n'+url);status('Caption and link copied.');}catch{caption.focus();caption.select();status('Copy the selected caption, then copy the link shown above.');}
    };
    dialog.querySelector('[data-download]').onclick=()=>{
      if(!usePhoto())return;const a=document.createElement('a');a.href=photoUrl;a.download=photoFile.name;document.body.append(a);a.click();a.remove();
    };
    update();dialog.showModal();
  }
  return {open};
})();
