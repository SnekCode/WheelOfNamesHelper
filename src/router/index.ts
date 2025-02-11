import { createRouter, createWebHistory } from 'vue-router';
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

const router = createRouter({
    history: createWebHistory(),
    routes,
});

export default router;
