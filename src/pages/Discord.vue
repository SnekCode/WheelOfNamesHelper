<script setup lang="ts">
import { ref } from 'vue';

// get userGuilds from the store
const { store, ipcRenderer, contextData } = window;

const selectedGuild = ref<string | null>(null);
const userGuilds = ref<any[]>([]);
const channels = ref<any[]>([]);
const userVoiceChannel = ref<string | null>(null);
const viewersChannel = ref<string | null>(null);
const userToggleDiscord = ref<boolean>(false);
const followMode = ref<boolean>(false);

// getters
ipcRenderer.invoke('getStore', 'discord_userGuilds').then((guilds) => {
    userGuilds.value = guilds;
});

ipcRenderer.invoke('getStore', 'discord_selectedGuild').then((guildId) => {
    selectedGuild.value = guildId;
    if (guildId) {
        handleGetChannels(guildId);
    }
});

ipcRenderer.invoke('getStore', 'discord_userVoiceChannel').then((channel) => {
    userVoiceChannel.value = channel;
});

ipcRenderer.invoke('getStore', 'discord_viewersChannel').then((channel) => {
    viewersChannel.value = channel;
});

ipcRenderer.invoke('getStore', 'discord_toggle').then((toggle) => {
    userToggleDiscord.value = toggle;
});

ipcRenderer.invoke('getStore', 'discord_followMode').then((mode) => {
    followMode.value = mode;
});

// updater / listener
ipcRenderer.on('storeUpdate', (event, storeName, data) => {
    if (storeName === 'discord_userVoiceChannel') {
        userVoiceChannel.value = data;
    }
});

// handle functions
const handleSelectGuild = (guildId: string) => {
    selectedGuild.value = guildId;
    handleGetChannels(guildId);
    ipcRenderer.invoke('setStore', 'discord_selectedGuild', guildId);
};

const handleGetChannels = (guildId: string) => {
    ipcRenderer.invoke('getStore', `discord_channels-${guildId}`).then((fetchedChannels) => {
        console.log(channels);
        channels.value.splice(0, channels.value.length, ...fetchedChannels);
    });
};

const handleSelectPlayChannel = (channelId: string) => {
    ipcRenderer.invoke('setStore', 'discord_userVoiceChannel', channelId);
    console.log(channelId);
};

const handleSelectViewersChannel = (channelId: string) => {
    ipcRenderer.invoke('setStore', 'discord_viewersChannel', channelId);
    console.log(channelId);
};

const handleToggleDiscord = () => {
    userToggleDiscord.value = !userToggleDiscord.value;
    ipcRenderer.invoke('setStore', 'discord_toggle', userToggleDiscord.value);
};

const handleFollowMode = () => {
    followMode.value = !followMode.value;
    ipcRenderer.invoke('setStore', 'discord_followMode', followMode.value);
};
</script>

<template>
    <!-- close button top right as a X that navigates to the root path -->
    <router-link to="/">
        <button class="close-button">Close</button>
    </router-link>
    <div class="container">
        <!-- enabled? -->
        <div class="option">
            <input type="checkbox" :checked="userToggleDiscord" @change="handleToggleDiscord" />
            <!-- display inline this label only -->
            <label style="display: inline-block">Enables the Discord integration</label>
        </div>
        <div class="option">
            <label>Select the Guild you are using:</label>
            <!-- select a guild -->
            <select :value="selectedGuild" @change="handleSelectGuild(($event.target as HTMLSelectElement).value)">
                <option value="" disabled selected>Select a guild</option>
                <option v-for="guild in userGuilds" :key="guild.id" :value="guild.id">{{ guild.name }}</option>
            </select>
        </div>

        <!-- display channels -->
        <div v-if="channels.length > 0" class="option">
            <!-- select with channels as options -->
            <div>
                <label>Select the Voice Channel you play in:</label>
                <small>This is the channel viewers will be moved to upon a win</small>
            </div>
            <select
                :value="userVoiceChannel"
                @change="handleSelectPlayChannel(($event.target as HTMLSelectElement).value)"
            >
                <option value="" disabled selected>Select a channel</option>
                <option v-for="channel in channels" :key="channel.id" :value="channel.id">{{ channel.name }}</option>
            </select>
            <div style="margin-top: 10px; margin-left: 30px">
                <label>Follow Mode</label>
                <input :checked="followMode" @change="handleFollowMode" type="checkbox" />
                <small>When enabled, the above channel will update automatically</small>
            </div>
        </div>
        <div v-if="channels.length > 0" class="option">
            <div>
                <label>Select the Voice Channel your viewers join:</label>
                <small>This is the channel viewers will join to be added to the Wheel</small>
            </div>
            <select
                :value="viewersChannel"
                @change="handleSelectViewersChannel(($event.target as HTMLSelectElement).value)"
            >
                <option value="" disabled selected>Select a channel</option>
                <option v-for="channel in channels" :key="channel.id" :value="channel.id">{{ channel.name }}</option>
            </select>
        </div>
    </div>
</template>

<style scoped>
.container {
    padding: 20px;
    font-family: Consolas, 'Courier New', monospace;
    color: #d4d4d4;
    text-align: left;
}

.option {
    margin-bottom: 20px;
    padding: 10px;
    border-radius: 3px;
    border: 1px solid transparent;
}

.option:hover {
    background-color: #1c1c1c;
    border-radius: 3px;
    border: 1px solid #3c3c3c;
}

label {
    display: block;
    margin-bottom: 5px;
    font-size: 14px;
}

select,
input[type='checkbox'] {
    font-size: 14px;
    padding: 5px;
    background-color: #3c3c3c;
    color: #d4d4d4;
    border: 1px solid #3c3c3c;
    border-radius: 3px;
}

select:focus,
input[type='checkbox']:focus {
    outline: none;
    border-color: #007acc;
}

.close-button {
    position: absolute;
    top: 5px;
    right: 5px;
    background-color: #3c3c3c;
    color: #d4d4d4;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    border-radius: 3px;
}

.close-button:hover {
    background-color: #007acc;
}
</style>
