import {test,expect} from '@playwright/test';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('migración de WhatsApp valida formato y conserva perfiles existentes',async()=>{
 const db=new PGlite();try{
  await db.exec("create table public.profiles(id integer primary key,name text);insert into public.profiles values(1,'Delegado');");
  await db.exec(readFileSync('supabase/migrations/003_delegate_whatsapp.sql','utf8'));
  expect((await db.query<{whatsapp:string}>('select whatsapp from profiles where id=1')).rows[0].whatsapp).toBe('');
  await db.query('update profiles set whatsapp=$1 where id=1',['+54 9 (11) 5550-0101']);
  for(const value of ['1155500101','https://wa.me/123','+123','+0012345678'])await expect(db.query('update profiles set whatsapp=$1 where id=1',[value])).rejects.toThrow();
  await db.query("update profiles set whatsapp='' where id=1");
 }finally{await db.close();}
});
