import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',use:{baseURL:'http://127.0.0.1:4178'},webServer:{command:'npm run preview -- --port 4178',url:'http://127.0.0.1:4178',reuseExistingServer:false},reporter:'list'});
