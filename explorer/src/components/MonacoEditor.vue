<template>
    <div class="root"></div>
</template>

<script>
const editorLoaded = new Promise((resolve) => {
    window.require(["vs/editor/editor.main"], (r) => {
        resolve(r)
    })
})
export default {
    name: "MonacoEditor",
    props: {
        modelValue: {
            type: String,
            default: "",
        },
        language: {
            type: String,
            default: "json",
        },
        readOnly: Boolean,
    },
    emits: ["update:modelValue"],
    watch: {
        modelValue(newValue) {
            const vm = this
            if (vm.editor) {
                if (newValue !== vm.editor.getValue()) {
                    vm.editor.setValue(newValue)
                }
            }
        },
    },
    async mounted() {
        const monaco = await editorLoaded
        const vm = this
        const options = Object.assign(
            {
                value: vm.modelValue,
                readOnly: vm.readOnly,
                theme: "vs-dark",
                language: vm.language,
                automaticLayout: true,
                fontSize: 14,
                // tabSize: 2,
                minimap: {
                    enabled: false,
                },
            },
            vm.options,
        )

        vm.editor = monaco.editor.create(vm.$el, options)
        vm.editor.onDidChangeModelContent((evt) => {
            const value = vm.editor.getValue()
            if (vm.modelValue !== value) {
                vm.$emit("update:modelValue", value, evt)
            }
        })
    },
}
</script>
<style scoped>
.root {
    width: 100%;
    height: 100%;
}
</style>
