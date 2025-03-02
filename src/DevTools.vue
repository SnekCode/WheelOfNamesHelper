<script setup lang="ts">
import { ref } from 'vue';
import CryptoJS from 'crypto-js';
import { Service } from '../Shared/enums';



const { store, ipcRenderer, contextData } = window;

    // message
    const message = ref<string>("!wheel");
    // random name boolean
    const randomName = ref<boolean>(false);
    // display name
    const displayName = ref<string>("Jeff");
    // drop down for service based on chatService enum
    const service = ref<string>(Service.YouTube);

// Function to generate a random name with random numbers and characters
const generateRandomName = () => {
    const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank"];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    const randomChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `${randomName}${randomNum}${randomChar}`;
};

const generateChannelId = (name: string, service: string) => {
    const secretKey = "your-secret-key"; // Replace with your actual secret key
    return CryptoJS.HmacSHA256(name + service, secretKey).toString(CryptoJS.enc.Hex);
};

    // create a simple form to allow me to select the platform so i can simulate messages from different platforms twitch and youtube
    //event: IpcMainInvokeEvent, message: string, displayname: string, channelId: string, service: Service

    const handleSendMessage = () => {
        // create random name if randomName is true
        if (randomName.value) {
            // generate a random name
            displayName.value = generateRandomName();
        }
        const channelId = generateChannelId(displayName.value, service.value);
        console.log(channelId);
        
        ipcRenderer.invoke("chatService", message.value, displayName.value, channelId, service.value);
    }
</script>

<template>
    <div class="form-container">
        <!-- message box -->
        <label for="message">Message:</label>
        <input type="text" id="message" v-model="message" />
        <!-- check box for random name else input field -->
        <label for="randomName">Random Name:</label>
        <input type="checkbox" id="randomName" v-model="randomName" />
        <label v-if="!randomName" for="displayName">Display Name:</label>
        <input type="text" id="displayName" v-if="!randomName" v-model="displayName" />
        <!-- options for service -->
        <label for="service">Service:</label>
        <select id="service" v-model="service">
            <option v-for="service in Service" :key="service" :value="service">{{ service }}</option>
        </select>
        <button @click="handleSendMessage">Send Message</button>
    </div>
</template>

<style>
.form-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
</style>