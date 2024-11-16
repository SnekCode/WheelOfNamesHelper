<script setup lang="ts">
import { ref } from 'vue';

const showModal = ref(false);
const releaseNotesHtml = ref('');

const { ipcRenderer } = window;

const fetchReleaseNotes = async () => {
    const [bool, htmlContent] = await ipcRenderer.invoke("releaseNotes");
    if (bool) {
        releaseNotesHtml.value = htmlContent;
        showModal.value = true;
        console.log({htmlContent});
        
    } else {
        console.error('Failed to fetch release notes');
    }
};

const closeModal = () => {
    ipcRenderer.send('releaseNotes', true);
    showModal.value = false;
};

ipcRenderer.on('releaseNotes', (_, data) => {
    const [bool, htmlContent] = data;
    if (bool) {
        releaseNotesHtml.value = htmlContent;
        showModal.value = true;
    }
});

fetchReleaseNotes();
</script>

<template>
  <div>
    <div v-if="showModal" class="modal">
      <div class="modal-content">
        <div v-html="releaseNotesHtml"></div>
        <button @click="closeModal">Close</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background-color: #242424;
  padding: 20px;
  border-radius: 5px;
  max-width: 500px;
  width: 100%;
  position: relative;
  max-height: 80vh; /* Adjust the value as needed */
  overflow-y: auto;
}

.modal-content button {
  position: fixed;
  top: 10px;
  right: 10px;
  /* Additional styling if needed */
}

::v-deep h2 {
  /* your styles for h2 */
  text-align: center;
}

::v-deep h3 {
  /* your styles for h3 */
  text-align: left;
}

::v-deep h4 {
  /* your styles for h4 */
  text-align: left;
}

::v-deep li {
  text-align: left;
}
</style>