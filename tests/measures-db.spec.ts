import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("migración: permisos reales, parte único, auditoría y cierre", async () => {
  test.setTimeout(90000);
  const db = new PGlite();
  const ids = {
    d1: "10000000-0000-4000-8000-000000000001",
    d2: "10000000-0000-4000-8000-000000000002",
    d3: "10000000-0000-4000-8000-000000000003",
    secretary: "10000000-0000-4000-8000-000000000004",
    admin: "10000000-0000-4000-8000-000000000005",
    measure: "10000000-0000-4000-8000-000000000006",
  };
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid primary key,role text,active boolean,building text);
 create function public.current_role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=auth.uid() and active$$;
 create function public.is_manager() returns boolean language sql stable security definer set search_path='' as $$select coalesce(public.current_role() in ('admin','secretario'),false)$$;
 grant usage on schema public,auth to authenticated,anon;
 insert into public.profiles values ('${ids.d1}','delegado',true,'A'),('${ids.d2}','delegado',true,'B'),('${ids.d3}','delegado',true,'A'),('${ids.secretary}','secretario',true,'A'),('${ids.admin}','admin',true,'A');`);
    await db.exec(
      readFileSync("supabase/migrations/002_industrial_measures.sql", "utf8"),
    );
    async function as(id: string) {
      await db.exec(
        `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
      );
    }
    await as(ids.secretary);
    const scope = JSON.stringify([
      { name: "A", reporter_ids: [ids.d1, ids.d3] },
      { name: "B", reporter_ids: [ids.d2] },
    ]);
    await db.query(
      "insert into public.industrial_measures(id,title,date,buildings) values($1,$2,$3,$4)",
      [ids.measure, "Medida de prueba", "2026-11-18", scope],
    );
    await as(ids.d1);
    await expect(
      db.query(
        "insert into public.industrial_measures(title,date,buildings) values($1,$2,$3)",
        ["Prohibida", "2026-11-18", scope],
      ),
    ).rejects.toThrow();
    const upsert = `insert into public.adhesion_reports(measure_id,building,total,adherents,user_id) values($1,$2,$3,$4,$5) on conflict(measure_id,building) do update set total=excluded.total,adherents=excluded.adherents,user_id=excluded.user_id`;
    await db.query(upsert, [ids.measure, "A", 100, 70, ids.d2]);
    const first = await db.query<{ user_id: string }>(
      "select user_id from public.adhesion_reports",
    );
    expect(first.rows[0].user_id).toBe(ids.d1);
    await expect(
      db.query(upsert, [ids.measure, "A", 100, 101, ids.d1]),
    ).rejects.toThrow();
    await expect(
      db.query(upsert, [ids.measure, "B", 100, 50, ids.d1]),
    ).rejects.toThrow();
    await as(ids.d3);
    await db.query(upsert, [ids.measure, "A", 100, 80, ids.d3]);
    expect(
      (await db.query("select * from public.adhesion_reports")).rows,
    ).toHaveLength(1);
    await as(ids.d2);
    expect(
      (await db.query("select * from public.adhesion_reports")).rows,
    ).toHaveLength(0);
    await expect(
      db.query(upsert, [ids.measure, "A", 80, 40, ids.d2]),
    ).rejects.toThrow();
    await db.query(upsert, [ids.measure, "B", 50, 0, ids.d2]);
    expect(
      (await db.query("select * from public.adhesion_report_history")).rows,
    ).toHaveLength(0);
    await as(ids.admin);
    expect(
      (await db.query("select * from public.adhesion_reports")).rows,
    ).toHaveLength(2);
    const history = await db.query(
      "select * from public.adhesion_report_history",
    );
    expect(history.rows).toHaveLength(3);
    await expect(
      db.query(upsert, [ids.measure, "A", 100, 90, ids.admin]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "update public.industrial_measures set buildings=$1 where id=$2",
        [JSON.stringify([{ name: "B", reporter_ids: [ids.d1] }]), ids.measure],
      ),
    ).rejects.toThrow();
    await db.query(
      "update public.industrial_measures set closed=true where id=$1",
      [ids.measure],
    );
    await expect(
      db.query(
        "update public.industrial_measures set closed=false where id=$1",
        [ids.measure],
      ),
    ).rejects.toThrow();
    await as(ids.d1);
    await expect(
      db.query(upsert, [ids.measure, "A", 100, 90, ids.d1]),
    ).rejects.toThrow();
  } finally {
    await db.close();
  }
});
