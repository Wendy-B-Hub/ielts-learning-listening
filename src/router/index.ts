import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import DictationView from '../views/DictationView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/dictation', component: DictationView },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
