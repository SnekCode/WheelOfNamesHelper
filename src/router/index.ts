import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import App from '@/App.vue';
import DevTools from '@/DevTools.vue';

const routes = [
    {
        path: '/',
        name: 'App',
        component: App,
    },
    {
        path: '/devtools',
        name: 'DevTools',
        component: DevTools,
    },
];

const isElectron = window.location. origin === "file://"
console.log("isElectron", isElectron);


const router = createRouter({
    history: isElectron ? createWebHashHistory() : createWebHistory(),
    routes,
});

export default router;
