<script setup lang="ts">
// @ts-expect-error
import AstExplorer from "./components/AstExplorer.vue"
import SnsBar from "./components/SnsBar.vue"
</script>

<template>
  <header class="header">
      <label class="title">yaml-eslint-parser</label>
      <SnsBar />
      <a
          href="https://github.com/ota-meshi/yaml-eslint-parser"
          class="github-link"
          >View on GitHub</a
      >
  </header>
  <main class="main">
      <AstExplorer />
  </main>
</template>

<style scoped>
.header {
    height: 32px;
    display: flex;
    border-bottom: 1px #ddd solid;
}
.title {
    font-size: 120%;
    flex-grow: 1;
    display: flex;
    align-items: center;
}
.github-link {
    display: flex;
    align-items: center;
}
.main {
    position: relative;
    height: calc(100vh - 32px - 16px);
}
</style>
