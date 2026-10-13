import { createServer } from 'node:http';

// Loopback-only JSON API for the independently runnable reference lifecycle.
export async function serveReferenceHost(host) {
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
    try {
      if(req.headers.origin) throw new Error('CROSS_ORIGIN_DENIED');
      if(req.method!=='POST') throw new Error('POST_REQUIRED');
      let body='';for await(const chunk of req){body+=chunk;if(body.length>8192) throw new Error('BODY_TOO_LARGE');}
      const value=JSON.parse(body), token=req.headers.authorization?.replace(/^Bearer /,'');
      let result;
      switch(req.url){
        case '/challenge': result=host.challenge(value.address);break;
        case '/login': result=await host.login(value.id,value.signature);break;
        case '/missions': result=await host.create(token,value);break;
        case '/join': result=await host.join(token,value.id);break;
        case '/complete': result=await host.complete(token,value.id,value.hash);break;
        case '/claim': result=await host.claim(token,value.id);break;
        default:throw new Error('NOT_FOUND');
      }
      res.end(JSON.stringify(result));
    }catch(error){res.statusCode=400;res.end(JSON.stringify({error:/^[A-Z_]+$/.test(error.message)?error.message:'REQUEST_REJECTED'}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
