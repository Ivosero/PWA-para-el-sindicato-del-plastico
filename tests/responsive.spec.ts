import { test, expect } from '@playwright/test';
test('roles y vistas en cinco tamaños', async ({ page }) => {
  test.setTimeout(90000);
  const names: Record<string, string | RegExp> = {
    inicio: 'Mi espacio', padron: 'Padrón de afiliados', agenda: /^Agenda gremial/,
    beneficios: 'Beneficios e información', vacaciones: 'Mis vacaciones',
    cobertura: 'Cobertura por edificio', admin: 'Administración',
  };
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const role of ['delegado', 'secretario', 'admin']) {
      await page.goto('/');
      await expect(page.getByRole('heading', {name:'Hola, Lucía.'})).toBeVisible();
      if(role!=='delegado')await page.getByRole('combobox', {name:'Cambiar perfil de muestra'}).selectOption(role);
      await expect(page.getByRole('combobox', {name:'Cambiar perfil de muestra'})).toHaveValue(role);
      const views = ['inicio','padron','agenda','beneficios','vacaciones',...(role!=='delegado'?['cobertura']:[]),...(role==='admin'?['admin']:[])];
      for (const view of views) {
        if(width<=680)await page.getByRole('button',{name:/Abrir men/}).click();
        await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('button',{name:names[view],exact:typeof names[view]==='string'}).click();
        await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), {message:`${role}/${view}/${width}`}).toBe(true);
      }
      if(width<=680){await page.getByRole('button',{name:/Abrir men/}).click();await page.locator('.nav-profile').click();}
      else await page.getByRole('button',{name:'Mi perfil',exact:true}).click();
      await expect(page.getByRole('button',{name:'Editar mi información'})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.getByRole('button',{name:/^Notificaciones,/}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({width:1440,height:1050});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Hola, Lucía.'})).toBeVisible();
  await page.screenshot({path:'evidence/desktop.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'evidence/mobile.png',fullPage:true,animations:'disabled'});
});
