<script setup lang="ts">
import { RouterView } from "vue-router";
import { usePointer } from "./composables/usePointer";
import CustomCursor from "./components/chrome/CustomCursor.vue";

/**
 * The shell.
 *
 * Only what genuinely outlives a page lives here. The cursor is the clearest
 * case: the reset hides the system pointer on every page, so a cursor mounted
 * inside a view would blink out of existence for the length of a route change
 * and leave the reader with nothing on screen to aim.
 *
 * Everything else — the ground, the header, the scroll engine — is a property
 * of the page being read, and each view brings its own. The two pages do not
 * share a palette, so a single backdrop hoisted up here would have to be told
 * which page it was behind, which is the same coupling in a worse place.
 */
const { px, py, down, fine } = usePointer();
</script>

<template>
  <RouterView />
  <CustomCursor :x="px" :y="py" :down="down" :enabled="fine" />
</template>
