# Privacy Policy for WheelOfNamesHelper

**Effective Date: September 28, 2026**

WheelOfNamesHelper ("the application") is a desktop application for streamers that integrates with services including Twitch, YouTube, and Discord to manage viewer participation in raffles and Wheel of Names workflows.

## 1. Information the Application Processes

Depending on the integrations enabled by the streamer, WheelOfNamesHelper may process:

- **Twitch:** usernames, display names, and chat messages or commands needed to manage wheel participation.
- **YouTube:** channel information, live broadcast information, usernames, and live chat messages or commands needed to identify streams and manage wheel participation.
- **Discord:** Discord user IDs, usernames/display names, guild and voice-channel information, voice-state information, and role information needed to configure Discord participation and determine when a user is participating through a configured voice channel.
- **Application state:** participant names, identifiers, wheel weights/chances, configuration settings, and authentication/configuration information required for enabled integrations.

WheelOfNamesHelper does not require the Discord Message Content privileged gateway intent for its current Discord workflow. It does use the Discord Presence privileged gateway intent to determine whether a participating Discord member is using a mobile or desktop client. This distinction is used by the raffle winner workflow to avoid attempting an unsupported voice-channel move for mobile participants and to label Discord entries appropriately.

## 2. How Information Is Used

Information is processed only to provide application functionality, including:

- Connecting to streamer accounts and configured communities.
- Detecting participation commands or activity on supported services.
- Adding, updating, or removing participants from the wheel.
- Applying streamer-configured raffle weights or chances.
- Identifying configured Discord guilds and voice channels and responding to voice-channel participation.
- Displaying integration and raffle state to the streamer.

Information is not sold or used for advertising or user profiling. WheelOfNamesHelper does not use user data to train machine-learning or AI models.

## 3. Storage and Processing

WheelOfNamesHelper is primarily a local desktop application. Application configuration and state may be stored locally on the streamer's device so that the application can retain settings and wheel state between sessions.

Data received from Twitch, YouTube, and Discord is processed by the application as needed to provide the enabled features. WheelOfNamesHelper does not operate a service intended to centrally archive users' Discord messages, presence history, or activity history.

Authentication credentials or tokens required by integrations are handled by the application for the purpose of connecting to those services. Users should protect access to the device on which WheelOfNamesHelper is installed.

## 4. Sharing of Information

WheelOfNamesHelper does not sell personal information. Data may necessarily be transmitted to or received from Twitch, Google/YouTube, Discord, and Wheel of Names when the user enables or interacts with those services. Those services are governed by their own terms and privacy policies.

## 5. Data Retention and Deletion

Locally persisted application settings and wheel state remain on the streamer's device until changed, cleared, or the application's local data is removed. Transient service data that is not part of persisted application state is not intentionally retained as a historical activity archive.

A streamer can remove participants from the wheel and can remove the application's local data by clearing or uninstalling the application. Access granted through third-party services can also be revoked through the applicable service.

## 6. Discord Data

For Discord integration, WheelOfNamesHelper uses data necessary to configure and operate streamer-selected voice-channel raffle workflows. The application may process a participating member's Discord ID and display name and voice-state/channel information to add or remove that member from a configured raffle.

The current workflow does not use Discord message content for Discord participation. It uses Discord Presence client-status data to determine whether an active participant is using a mobile or desktop Discord client. This information affects winner handling and display behavior. Presence data is used for this operational purpose and is not intended to create a historical record of a user's presence or activity.

## 7. Security

WheelOfNamesHelper is designed to minimize the data it requests and processes. Users are responsible for maintaining the security of the device running the application and for managing access granted to connected third-party accounts.

## 8. Third-Party Services

Use of Twitch, YouTube/Google, Discord, and Wheel of Names is also subject to the policies and terms of those respective services.

## 9. Changes to This Policy

This Privacy Policy may be updated as WheelOfNamesHelper changes. Material changes will be reflected by updating the effective date above.

## 10. Contact

Questions or concerns about this Privacy Policy can be submitted through the WheelOfNamesHelper GitHub repository or the project's support Discord linked from the WheelOfNamesHelper website.
