import {required} from './config.js';
const columns={
  blog_posts:'id slug title description social_excerpt category body images sources status review_nonce review_issued_at ai_generated editorial_note rejection_note email_sent_at linkedin_post_id linkedin_claimed_at pinterest_pin_id pinterest_claimed_at published_at created_at updated_at'.split(' '),
  blog_jobs:'slot post_id state lease_until error updated_at'.split(' '),
  blog_integrations:'name encrypted_token member_id expires_at board_id'.split(' ')
};
// Translate the internal database operations into parameterised PostgreSQL queries.
// Identifiers are selected from fixed allowlists; all values are bound parameters.
export function sqlOperation(path,options={}){
  const url=new URL(path,'https://database.invalid/'), table=url.pathname.slice(1),params=url.searchParams;
  const data=options.body?JSON.parse(options.body):{},method=options.method||'GET';
  if(table==='rpc/blog_claim_job')return {text:'SELECT * FROM public.blog_claim_job($1,$2::uuid)',values:[data.p_slot,data.p_post_id]};
  if(table==='rpc/blog_login_attempt')return {text:'SELECT public.blog_login_attempt($1) AS attempts',values:[data.p_key],scalar:'attempts'};
  const allowed=columns[table];if(!allowed)throw new Error('Unsupported database operation');
  const column=name=>{if(!allowed.includes(name))throw new Error('Invalid database column');return `"${name}"`;};
  const values=[];const bind=(value,name)=>{values.push(['images','sources'].includes(name)?JSON.stringify(value):value);return '$'+values.length+(['images','sources'].includes(name)?'::jsonb':'');};
  const fields=Object.keys(data),identifier=`public."${table}"`;
  if(method==='POST'){
    if(!fields.length)throw new Error('Empty database insert');
    let text=`INSERT INTO ${identifier} (${fields.map(column).join(',')}) VALUES (${fields.map(name=>bind(data[name],name)).join(',')})`;
    if(params.has('on_conflict')){const key=params.get('on_conflict');column(key);text+=` ON CONFLICT (${column(key)}) DO UPDATE SET ${fields.filter(name=>name!==key).map(name=>`${column(name)}=EXCLUDED.${column(name)}`).join(',')}`;}
    return {text:text+' RETURNING *',values};
  }
  const filters=[];
  for(const [name,value] of params){if(['select','order','limit','offset'].includes(name))continue;const key=column(name);if(value==='is.null')filters.push(`${key} IS NULL`);else if(value.startsWith('eq.'))filters.push(`${key}=${bind(value.slice(3),name)}`);else throw new Error('Invalid database filter');}
  const where=filters.length?' WHERE '+filters.join(' AND '):'';
  if(method==='PATCH'){
    if(!fields.length||!filters.length)throw new Error('Updates require fields and a filter');
    const assignments=fields.map(name=>`${column(name)}=${bind(data[name],name)}`);
    return {text:`UPDATE ${identifier} SET ${assignments.join(',')}${where} RETURNING *`,values};
  }
  if(method!=='GET')throw new Error('Unsupported database method');
  let text=`SELECT ${params.has('select')?params.get('select').split(',').map(column).join(','):'*'} FROM ${identifier}${where}`;
  if(params.has('order')){const [name,direction]=params.get('order').split('.');if(!['asc','desc'].includes(direction))throw new Error('Invalid ordering');text+=` ORDER BY ${column(name)} ${direction.toUpperCase()}`;}
  for(const name of ['limit','offset'])if(params.has(name)){const n=Number(params.get(name));if(!Number.isInteger(n)||n<0||n>12000)throw new Error('Invalid pagination');text+=` ${name.toUpperCase()} ${bind(n)}`;}
  return {text,values};
}
export async function neonDb(path,options){
  const {neon}=await import('@neondatabase/serverless');
  const query=sqlOperation(path,options);
  try{
    const rows=await neon(required('DATABASE_URL')).query(query.text,query.values,{fetchOptions:{signal:AbortSignal.timeout(15000)}});
    return query.scalar?rows[0][query.scalar]:JSON.parse(JSON.stringify(rows));
  }catch(error){
    // Never log a database connection string, query values or a private draft.
    console.error('Neon request failed',error.code||'connection');
    throw Object.assign(new Error('Database request failed'),{status:error.code==='23505'?409:503,publicMessage:error.code==='23505'?'This URL is already in use. Choose another slug.':'Storage is temporarily unavailable.'});
  }
}
