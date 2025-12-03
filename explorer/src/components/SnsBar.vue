<script lang="ts" setup>
import { onMounted } from "vue";

let timeoutId: any = null;

onMounted(() => {
  setup();
});

/**
 * setup
 */
function setup() {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  timeoutId = setTimeout(() => {
    (function (d, s, id) {
      const [fjs] = d.getElementsByTagName(s);
      if (d.getElementById(id)) {
        return;
      }
      const js = d.createElement("script");
      js.id = id;
      js.src = "https://buttons.github.io/buttons.js";
      fjs!.parentNode!.insertBefore(js, fjs);
    })(document, "script", "gh-buttons");
  }, 500);
}
</script>

<template>
  <div class="sns-bar">
    <div class="sns">
      <a
        class="github-button"
        href="https://github.com/ota-meshi/yaml-eslint-parser"
        data-show-count="true"
        aria-label="Star ota-meshi/yaml-eslint-parser on GitHub"
        >Star</a
      >
      <a href="https://www.npmjs.com/package/yaml-eslint-parser">
        <img
          src="https://img.shields.io/npm/v/yaml-eslint-parser.svg"
          alt="npm"
        />
      </a>
    </div>
  </div>
</template>

<style scoped>
.sns-bar {
  display: flex;
  align-items: flex-end;
  padding-left: 8px;
  padding-right: 8px;
}
.sns-bar .sns {
  display: flex;
  align-items: flex-start;
}

.sns-bar .sns > * {
  vertical-align: top !important;
  margin-left: 4px;
  height: 23px !important;
}
</style>
