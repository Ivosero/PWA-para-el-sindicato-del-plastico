import {test,expect} from '@playwright/test';
test('recorrido de aulas, persistencia, agenda y navegación',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Un espacio que nos une.'})).toBeVisible();
 await page.getByRole('button',{name:'Ingresar a Aulas Virtuales'}).click();
 await page.getByRole('textbox',{name:'Buscar una capacitación'}).fill('inyección');
 await expect(page.locator('.course-item')).toHaveCount(1);
 await page.locator('.course-item').click();await page.getByRole('button',{name:'Marcar como recorrida'}).click();
 await page.getByRole('button',{name:'Cerrar ventana'}).click();await page.reload();
 await expect(page.locator('.course-item.orange')).toContainText('1 de 3 recorridas');
 await page.locator('.sidebar').getByRole('button',{name:'Agenda',exact:true}).click();
 await page.getByRole('button',{name:'Me interesa'}).first().click();await page.reload();
 await expect(page.getByRole('button',{name:'Agendado · Quitar'})).toHaveCount(1);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Sumar al calendario'}).first().click();expect((await download).suggestedFilename()).toBe('agenda-plastico-muestra.ics');
 await page.locator('.sidebar').getByRole('button',{name:'Mi espacio',exact:true}).click();
 await page.screenshot({path:'evidence/desktop.png',fullPage:true});expect(errors).toEqual([]);
});
test('adaptación sin desborde en cinco tamaños',async({page})=>{
 for(const width of [360,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  for(const view of ['inicio','aulas','agenda','beneficios','credencial']){
   await page.goto('/#'+view);await expect(page.locator('h1')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} en ${width}`).toBe(true);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.screenshot({path:'evidence/mobile.png',fullPage:true});
 await page.getByRole('navigation',{name:'Navegación móvil'}).getByRole('button',{name:'Aulas',exact:true}).click();await expect(page.locator('.course-item')).toHaveCount(3);
});
test('instalación y shell disponible sin conexión',async({page,context})=>{
 await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.reload();await expect(page.locator('h1')).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);await page.reload();await expect(page.locator('h1')).toBeVisible();
 await page.getByRole('button',{name:'Ingresar a Aulas Virtuales'}).click();await expect(page.locator('.course-item')).toHaveCount(3);
});
