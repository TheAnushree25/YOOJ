import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./pages/HomeView.vue";

/**
 * Two pages, and the second is loaded on demand.
 *
 * `/solutions` carries its own ground and its own choreography, none of which
 * the front page needs — splitting it out keeps the first paint carrying only
 * what the first page actually shows.
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/solutions", name: "solutions", component: () => import("./pages/AlephView.vue") },
    // The page answered to /aleph until now, so that address keeps working
    // rather than falling through to the catch-all and landing on the front
    // page with no explanation.
    { path: "/aleph", redirect: "/solutions" },
    // Anything else is the front page rather than a dead end.
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  // Every view drives its own scroll engine and starts at the top; letting the
  // router restore a position as well fights it.
  scrollBehavior: () => ({ top: 0 }),
});
