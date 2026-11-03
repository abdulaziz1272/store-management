// Pages and who may open them.
// meta.roles = which roles may open the page (empty = every logged-in user)
// meta.public = the page can be opened without login

import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
  { path: '/', component: () => import('../views/DashboardView.vue') },
  { path: '/checkout', component: () => import('../views/CheckoutView.vue') },
  { path: '/sales', component: () => import('../views/SalesView.vue') },
  { path: '/products', component: () => import('../views/ProductsView.vue') },
  { path: '/stock', component: () => import('../views/StockView.vue') },
  {
    path: '/movements',
    component: () => import('../views/MovementsView.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  {
    path: '/purchases',
    component: () => import('../views/PurchasesView.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  {
    path: '/transfers',
    component: () => import('../views/TransfersView.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  { path: '/customers', component: () => import('../views/CustomersView.vue') },
  {
    path: '/suppliers',
    component: () => import('../views/SuppliersView.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  {
    path: '/reports',
    component: () => import('../views/ReportsView.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  {
    path: '/audit',
    component: () => import('../views/AuditView.vue'),
    meta: { roles: ['admin', 'manager'] },
  },
  { path: '/branches', component: () => import('../views/BranchesView.vue'), meta: { roles: ['admin'] } },
  { path: '/units', component: () => import('../views/UnitsView.vue'), meta: { roles: ['admin'] } },
  { path: '/users', component: () => import('../views/UsersView.vue'), meta: { roles: ['admin'] } },
  { path: '/profile', component: () => import('../views/ProfileView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // First visit: ask the server if we are already logged in (cookie)
  if (!auth.ready) {
    await auth.fetchMe();
  }

  if (to.meta.public) {
    // A logged-in user does not need the login page
    if (auth.isLoggedIn && to.path === '/login') {
      return '/';
    }

    return true;
  }

  if (!auth.isLoggedIn) {
    return '/login';
  }

  const allowedRoles = to.meta.roles;

  if (allowedRoles && !allowedRoles.includes(auth.role)) {
    return '/';
  }

  return true;
});

export default router;
