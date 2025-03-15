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
const discordEnabled = ref<boolean>(false);
const followMode = ref<boolean>(false);
const discord_weights = ref<number>(1);
const discord_bot_ready = ref<boolean>(false);

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
    discordEnabled.value = toggle;
    userToggleDiscord.value = toggle;
});

ipcRenderer.invoke('getStore', 'discord_followMode').then((mode) => {
    followMode.value = mode;
});

ipcRenderer.invoke('getStore', 'discord_weights').then((weights) => {
    if (weights) {
        discord_weights.value = weights;
    }
});

ipcRenderer.invoke('getStore', 'discord_bot_ready').then((bot_ready) => {
    discord_bot_ready.value = bot_ready;
});

// updater / listener
ipcRenderer.on('storeUpdate', (event, storeName, data) => {
    console.log(storeName);
    if(storeName.includes('discord_channels')) {
        channels.value = channels.value.splice(0, channels.value.length, ...data);
    }
    if(storeName === 'discord_userVoiceChannel') {
        userVoiceChannel.value = data;
    }
    if(storeName === "discore_enable") {
        discordEnabled.value = data;
    }
    if(storeName === "discord_userGuilds") {
        console.log(data[0]);
        
        // userguilds is a Map
        userGuilds.value = Array.from(data[0].values());
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

const handleWeights = (value: number) => {
    discord_weights.value = value;
    ipcRenderer.invoke('setStore', 'discord_weights', value);
};
</script>

<template>
    <div class="container">
        <!-- show install link to the bot -->
        <a
            href="https://discord.com/oauth2/authorize?client_id=1348170053509447800&scope=bot&permissions=8"
            target="_blank"
            rel="noopener noreferrer"
            @click="() => ipcRenderer.send('discord_install')"
            >{{discord_bot_ready ? "Install to another server": "Install the Discord Bot"}}</a>
        <!-- close button top right as a X that navigates to the root path -->
        <router-link to="/">
            <button class="close-button">Close</button>
        </router-link>
        <div v-if="discord_bot_ready" class="options_container">
            <!-- enabled? -->
            <div class="option">
                <input type="checkbox" :checked="userToggleDiscord" @change="handleToggleDiscord" />
                <!-- display inline this label only -->
                <label style="display: inline-block">Enables the Discord integration</label>
            </div>
            <div v-if="userToggleDiscord" class="option">
                <label>Select the Guild you are using:</label>
                <!-- select a guild -->
                <select :value="selectedGuild" @change="handleSelectGuild(($event.target as HTMLSelectElement).value)">
                    <option value="" selected>Select a guild</option>
                    <option v-for="guild in userGuilds" :key="guild.id" :value="guild.id">{{ guild.name }}</option>
                </select>
            </div>

            <!-- display channels -->
            <div v-if="channels.length > 0 && selectedGuild && userToggleDiscord" class="option">
                <!-- select with channels as options -->
                <div>
                    <label>Select the Voice Channel you play in:</label>
                    <small>This is the channel viewers will be moved to upon a win</small>
                </div>
                <select
                    :value="userVoiceChannel"
                    @change="handleSelectPlayChannel(($event.target as HTMLSelectElement).value)"
                >
                    <option value="" selected>Select a channel</option>
                    <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                        {{ channel.name }}
                    </option>
                </select>
                <div style="margin-top: 10px; margin-left: 30px">
                    <label>Follow Mode</label>
                    <input :checked="followMode" @change="handleFollowMode" type="checkbox" />
                    <small>When enabled, the above channel will update automatically</small>
                </div>
            </div>
            <div v-if="channels.length > 0 && selectedGuild && userToggleDiscord" class="option">
                <div>
                    <label>Select the Voice Channel your viewers join:</label>
                    <small>This is the channel viewers will join to be added to the Wheel</small>
                </div>
                <select
                    :value="viewersChannel"
                    @change="handleSelectViewersChannel(($event.target as HTMLSelectElement).value)"
                >
                    <option value="" selected>Select a channel</option>
                    <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                        {{ channel.name }}
                    </option>
                </select>
            </div>
            <div v-if="selectedGuild && userToggleDiscord" class="option">
                <label>Discord Weights</label>
                <small>Adjust the weight of Discord in the Wheel</small>
                <div>
                    <small style="color: aquamarine; padding-left: 5px; padding-right: 5px"
                        >{{ discord_weights }}
                    </small>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        :value="discord_weights"
                        @input="(event) => {
                    discord_weights = parseInt((event.target as HTMLInputElement).value);
                }"
                        @change="(event)=> {
                    console.log(event);
                    
                    handleWeights(parseInt((event.target as HTMLInputElement).value))
                    }"
                    />
                </div>
            </div>
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
