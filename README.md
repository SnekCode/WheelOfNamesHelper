<p align="center">
    <h1 align="center">Streamer Wheel Of Names Helper</h1>
</p>
<p align="center">
    <a href="https://vitejs.dev/">
    <img src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" />
    </a>
    <a href="https://vuejs.org">
      <img src="https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=2361DAFB"
    </a>
    <a href="https://www.electronjs.org/">
      <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white">
    </a>
    <a href="https://www.typescriptlang.org/">
      <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white">
    </a>
    <a href="https://github.com/SnekCode/WheelOfNamesHelper/releases">
      <img src="https://img.shields.io/github/v/release/SnekCode/WheelOfNamesHelper?style=for-the-badge&logo=github">
    </a>
</p>

## About

This application is designed to enhance the interaction between Twitch and Youtube streamers and their viewers by providing a dynamic and engaging way to manage viewer participation through a wheel of names. The application offers a variety of features to streamline the process of adding, managing, and tracking viewer entries.

### Current Features
* **Twitch and Youtube Authentication**: Log in to either Twitch or Youtube or Both to enable chat commands
* **Wheel Request Counter**: Keep track of the number of wheel requests.
* **Wheel Counter Reset Button**: Reset the current count without affecting the overall state.
* **Remove Not Claimed Button**: Removes any viewer that has not used the command !wheel since resetting the double down feature. Basically a "New Stream" button
* **Double Down Feature**: Viewers can use the `!wheel` command to double their chances for new streams.
* **Filter User Search Bar**: Search for viewers even if they have 0 chances.
* **Viewer Grid Layout**: Display viewers with chances in a grid layout.
* **Increment and Decrement Buttons**: Fine control over each viewer's chances with increment and decrement buttons.
* **Stateful**: The list of viewers and their chances is maintained even when the application closes.
* **Manual Viewer Addition**: Manually add viewer names and chances.
* **WheelOfNames Wrapper Window**: Integration of the Wheel of Names website into the app allows for instant updates from Twitch and Youtube Chats

### Current Chat Commands
* **`!wheel`**: Adds the user's display name to the list with 1 chance or doubles when available.
* **`!remove`**: Allows viewers to remove all their chances.
* **`!odds`**: Sends a chat message to the correct platform with viewer's odds at winning.


### Technologies Used
* **Vite**: Fast and modern build tool for web projects.
* **Vue.js**: Progressive JavaScript framework for building user interfaces.
* **Electron**: Framework for building cross-platform desktop applications with web technologies.
* **TypeScript**: Typed superset of JavaScript that compiles to plain JavaScript.

### Getting Started
To get started with Streamer Wheel Of Names Helper, download the latest release from the [GitHub releases page](https://github.com/SnekCode/WheelOfNamesHelper/releases) and follow the installation instructions provided.


## Development

The application is built using:

* [Electron](https://www.electronjs.org/)
* [Vue](https://vuejs.org/)
* [Vite](https://vitejs.dev/)
* [TypeScript](https://www.typescriptlang.org/)

To build the application from source, you will need to have Node.js and npm installed on your computer. Once you have installed Node.js and npm, you can download the source code for the application from the [GitHub repository](https://github.com/SnekCode/WheelOfNamesHelper) and run the following commands:

```
npm install
npm run dev
```

This will start the application in development mode and allow you to make changes to the code.

## Deployment
Ensure your github token is valid
1. set an env var `GH_TOKEN` locally in terminal or in a `electron-builder.env` file
1. git commit and push to the `master` branch
1. create a tag. Ensure you have updated `package.json`
1. `npm run build`
1. `npm run publish`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.