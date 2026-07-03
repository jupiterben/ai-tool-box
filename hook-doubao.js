try{
window.__msgResp="pending";
var cid="38433840752978178";
fetch("/chat/messages?conversation_id="+cid+"&limit=20&aid=497858&device_platform=web",{method:"GET",credentials:"include",headers:{"Content-Type":"application/json"}}).then(function(r){return r.text();}).then(function(t){window.__msgResp=t.slice(0,2000);}).catch(function(e){window.__msgResp="err:"+e.message;});
"fetching"
}catch(e){String(e)}