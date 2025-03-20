<script setup lang="ts">
import { ref } from 'vue';

// get userGuilds from the store
const { ipcRenderer } = window;

const selectedGuild = ref<string | null>(null);
const userGuilds = ref<any[]>([]);
const channels = ref<any[]>([]);
const userVoiceChannel = ref<string | null>(null);
const viewersChannel = ref<string | null>(null);
const userToggleDiscord = ref<boolean>(false);
const discordEnabled = ref<boolean>(false);
const discordAuthenticated = ref<boolean>(false);
const followMode = ref<boolean>(false);
const discord_weights = ref<number>(1);
const discord_bot_ready = ref<boolean>(false);

const discordInviteLink = "https://discord.gg/qcffQKmYTV"

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

ipcRenderer.invoke('getStore', 'discord_authenticated').then((value) => {
    discordAuthenticated.value = value;
});

// updater / listener
ipcRenderer.on('storeUpdate', (event, storeName, data) => {
    console.log(storeName);
    if (storeName.includes('discord_channels')) {
        channels.value = channels.value.splice(0, channels.value.length, ...data);
    }
    if (storeName === 'discord_userVoiceChannel') {
        userVoiceChannel.value = data;
    }
    if (storeName === 'discord_authenticated') {
        console.log('discord_authenticated', data);

        discordAuthenticated.value = data;
    }
    if (storeName === 'discord_userGuilds') {
        if (data && data[0]) {
            userGuilds.value = Array.from(data[0].values());
        }
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
    userVoiceChannel.value = channelId;
    console.log(channelId);
};

const handleSelectViewersChannel = (channelId: string) => {
    ipcRenderer.invoke('setStore', 'discord_viewersChannel', channelId);
    viewersChannel.value = channelId;
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

const reloadPage = () => {
    window.location.reload();
};
</script>

<template>
    <div class="container">
        <!-- show install link to the bot -->
        <!-- close button top right as a X that navigates to the root path -->
        <router-link to="/">
            <button class="close-button">Close</button>
        </router-link>
        <div v-if="discord_bot_ready && discordAuthenticated" class="options_container">
            <!-- enabled? -->
            <div class="option" @click="handleToggleDiscord">
                <input type="checkbox" :checked="userToggleDiscord" />
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
                <div @click="handleFollowMode" style="margin-top: 10px; margin-left: 30px">
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
                    <small style="padding-left: 5px; padding-right: 5px"
                        >{{ discord_weights }}
                    </small>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        :value="discord_weights"
                        @input="(event: Event) => {
                    discord_weights = parseInt((event.target as HTMLInputElement).value);
                }"
                        @change="(event: Event)=> {
                    console.log(event);
                    
                    handleWeights(parseInt((event.target as HTMLInputElement).value))
                    }"
                    />
                </div>
            </div>
        </div>
        <div v-if="discordAuthenticated">
            <a
                href="https://discord.com/oauth2/authorize?client_id=1348170053509447800&scope=bot&permissions=8"
                target="_blank"
                rel="noopener noreferrer"
                @click="
                    () => {
                        ipcRenderer.send('discord_install');
                    }
                "
                >{{ discord_bot_ready ? 'Install to another server' : 'Install the Discord Bot' }}</a
            >
            <!-- add refresh page button -->
            <button style="margin-left: 20px" v-if="!discord_bot_ready" @click="reloadPage">Refresh</button>
            <div v-if="channels.length === 0">
                <small>Ensure you have a role named "Wheel Bot User"</small>
                <label>If you need a custom role reach out to @snekcode discord -- link below</label>
            </div>
        </div>
        <div v-else>
            Log in to Discord to continue
            <label
            >If you still see this message
            <a :href="discordInviteLink" target="_blank" rel="noopener noreferrer">Join My Discord</a> for
            access</label
            >
        </div>
        <div v-if="discordAuthenticated" style="margin-top: 1rem">
            <label>Join my Discord for support and updates</label>
            <a :href="discordInviteLink" target="_blank" rel="noopener noreferrer">Join Discord</a>
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

@media (prefers-color-scheme: light){
    .option:hover {
        background-color: #f0f0f0;
        border-radius: 3px;
        border: 1px solid #3c3c3c;
    }

    .container {
        /* background-color: #f0f0f0; */
        color: #3c3c3c;
    }

    select, input[type='checkbox'] {
        background-color: #f0f0f0;
        color: #3c3c3c;
        border: 1px solid #3c3c3c;
    }

    .close-button {
        background-color: #007ACC86;
        color: #000000;
    }

    .close-button:hover {
        background-color: #007acc;
    }

    .option {
        /* background-color: #f0f0f0; */
        border-radius: 3px;
        border: 1px solid transparent;
    }

    label {
        color: #3c3c3c;
    }

    select:focus, input[type='checkbox']:focus {
        outline: none;
        border-color: #007acc;
    }

    a {
        color: #007acc;
    }

    a:hover {
        color: #0056b3;
    }

    small {
        color: #3c3c3c;
    }

    input[type='range'] {
        background-color: #f0f0f0;
        color: #3c3c3c;
        border: 1px solid #3c3c3c;
    }

    input[type='range']:focus {
        outline: none;
        border-color: #007acc;
    }

    input[type='range']::-webkit-slider-thumb {
        background-color: #007acc;
    }

    input[type='range']::-webkit-slider-thumb:hover {
        background-color: #0056b3;
    }

    input[type='range']::-webkit-slider-thumb:active {
        background-color: #003d80;
    }
    
}
</style>
