<template>
    <header class="header">
        <label class="title">yaml-eslint-parser</label>
        <a
            href="https://github.com/ota-meshi/yaml-eslint-parser"
            class="github-link"
            >GitHub</a
        >
    </header>
    <main class="main">
        <AstExplorer />
    </main>
</template>

<script>
import AstExplorer from "./components/AstExplorer.vue"

export default {
    name: "App",
    components: {
        AstExplorer,
    },
}
</script>
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
    width: 4em;
    display: flex;
    align-items: center;
}
.main {
    position: relative;
    height: calc(100vh - 32px - 16px);
}
</style>
